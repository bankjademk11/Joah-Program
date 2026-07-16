import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ODOO_URL = "https://lod.kokkokm.com";

// ── Branch definitions ────────────────────────────────────────
// Add or remove branches here. Each entry is synced in sequence.
const BRANCHES = [
    { odoo_id: 249, branch_id: 'ຕະຫຼາດລາວ' },
    { odoo_id: 248, branch_id: 'ສີວິໄລ' },
    { odoo_id: 273, branch_id: 'ເມກ້າມໍ' },
];

// ── Shared helpers ────────────────────────────────────────────
async function syncBranch(
    branch: { odoo_id: number; branch_id: string },
    supabase: ReturnType<typeof createClient>,
    odooHeaders: Record<string, string>
) {
    console.log(`\n=== Syncing branch: ${branch.branch_id} (Odoo ID: ${branch.odoo_id}) ===`);

    // 1. Get last processed ID
    const { data: logs } = await supabase
        .from('odoo_sync_logs')
        .select('last_processed_id, status')
        .eq('branch_id', branch.branch_id)
        .order('sync_started_at', { ascending: false })
        .limit(1);

    let lastProcessedId: number | null = null;
    if (logs && logs.length > 0 && logs[0].status === 'success' && logs[0].last_processed_id) {
        lastProcessedId = logs[0].last_processed_id;
    }
    console.log(`Last processed ID: ${lastProcessedId}`);

    // 2. Fetch delta sales from Odoo
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = `${todayStr} 00:00:00`;

    const domain: any[] = [
        ['company_id', '=', branch.odoo_id],
        ['order_id.date_order', '>=', startOfToday]
    ];
    if (lastProcessedId) {
        domain.push(['id', '>', lastProcessedId]);
    }

    const salesResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: odooHeaders,
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
                model: 'pos.order.line',
                method: 'search_read',
                args: [domain],
                kwargs: {
                    fields: ['id', 'product_id', 'qty', 'price_unit', 'price_subtotal_incl', 'create_date'],
                    order: 'id asc',
                    limit: 2000
                }
            }
        })
    });

    const salesData = await salesResponse.json();
    const odooSales: any[] = salesData.result || [];

    if (odooSales.length === 0) {
        console.log(`No new sales for ${branch.branch_id}.`);
        return { branch: branch.branch_id, deducted: 0, items: 0, skipped: true };
    }

    const newMaxId = Math.max(...odooSales.map((item: any) => item.id));
    const productIds = [...new Set(odooSales.map((item: any) => item.product_id[0]))];

    // 3. Fetch barcodes
    const barcodeResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: odooHeaders,
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
                model: 'product.product',
                method: 'search_read',
                args: [[['id', 'in', productIds]]],
                kwargs: { fields: ['id', 'barcode'] }
            }
        })
    });

    const barcodeData = await barcodeResponse.json();
    const barcodeMap: Record<number, string> = {};
    (barcodeData.result || []).forEach((p: any) => {
        if (p.barcode) barcodeMap[p.id] = p.barcode;
    });

    // 4. Aggregate sales by barcode
    const salesSummary: Record<string, any> = {};
    odooSales.forEach((item: any) => {
        const productId = item.product_id[0];
        const realBarcode = barcodeMap[productId];
        const rawName = item.product_id[1];
        if (realBarcode) {
            if (!salesSummary[realBarcode]) {
                salesSummary[realBarcode] = { barcode: realBarcode, name: rawName, qty_sold: 0 };
            }
            salesSummary[realBarcode].qty_sold += item.qty;
        }
    });

    const uniqueBarcodes = Object.keys(salesSummary);

    // 5. Fetch store stock for this branch
    const { data: storeItems } = await supabase
        .from('store_inventory')
        .select('*')
        .eq('branch_id', branch.branch_id)
        .in('barcode_no', uniqueBarcodes);

    // 6. Cascade deduction
    let totalQtyDeducted = 0;
    const syncDetails: any[] = [];
    const updatePromises: any[] = [];

    const storeItemsByBarcode: Record<string, any[]> = {};
    (storeItems || []).forEach((item: any) => {
        if (!storeItemsByBarcode[item.barcode_no]) {
            storeItemsByBarcode[item.barcode_no] = [];
        }
        storeItemsByBarcode[item.barcode_no].push(item);
    });

    uniqueBarcodes.forEach(barcode => {
        const sold = salesSummary[barcode];
        let remainingToDeduct = sold.qty_sold;

        const rowsForBarcode = storeItemsByBarcode[barcode] || [];
        rowsForBarcode.sort((a, b) => (b.store_qty || 0) - (a.store_qty || 0));

        const totalOldQty = rowsForBarcode.reduce((sum, r) => sum + (r.store_qty || 0), 0);

        if (rowsForBarcode.length > 0) {
            for (let i = 0; i < rowsForBarcode.length; i++) {
                if (remainingToDeduct <= 0) break;

                const row = rowsForBarcode[i];
                const rowQty = row.store_qty || 0;
                const isLastRow = i === rowsForBarcode.length - 1;

                let deductFromThis = 0;
                if (rowQty >= remainingToDeduct || isLastRow) {
                    deductFromThis = remainingToDeduct;
                } else {
                    deductFromThis = rowQty;
                }

                remainingToDeduct -= deductFromThis;
                const newRowQty = rowQty - deductFromThis;

                updatePromises.push(
                    supabase.from('store_inventory').update({
                        store_qty: newRowQty,
                        sales_qty: (row.sales_qty || 0) + deductFromThis,
                        last_updated: new Date().toISOString()
                    }).eq('id', row.id)
                );
            }
            totalQtyDeducted += sold.qty_sold;

            syncDetails.push({
                barcode_no: barcode,
                item_name: sold.name,
                qty_sold: sold.qty_sold,
                old_store_qty: totalOldQty,
                new_store_qty: totalOldQty - sold.qty_sold,
                status: 'success'
            });
        } else {
            syncDetails.push({
                barcode_no: barcode,
                item_name: sold.name,
                qty_sold: sold.qty_sold,
                old_store_qty: 0,
                new_store_qty: 0,
                status: 'not_found'
            });
        }
    });

    await Promise.all(updatePromises);

    // 7. Save log
    const { data: logEntry, error: logErr } = await supabase
        .from('odoo_sync_logs')
        .insert([{
            sync_started_at: new Date().toISOString(),
            sync_completed_at: new Date().toISOString(),
            total_items_sold: uniqueBarcodes.length,
            total_qty_deducted: totalQtyDeducted,
            status: 'success',
            branch_id: branch.branch_id,
            last_processed_id: newMaxId
        }])
        .select();

    if (logErr) throw logErr;

    if (logEntry && logEntry[0] && syncDetails.length > 0) {
        const detailsToInsert = syncDetails.map(d => ({ ...d, log_id: logEntry[0].id }));
        await supabase.from('odoo_sync_details').insert(detailsToInsert);
    }

    console.log(`✅ ${branch.branch_id}: Deducted ${totalQtyDeducted} items across ${uniqueBarcodes.length} SKUs.`);
    return { branch: branch.branch_id, deducted: totalQtyDeducted, items: uniqueBarcodes.length, skipped: false };
}

// ── Main handler ──────────────────────────────────────────────
serve(async (_req) => {
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const ODOO_DB = Deno.env.get("ODOO_DB") ?? "";
        const ODOO_USER = Deno.env.get("ODOO_USER") ?? "";
        const ODOO_PASSWORD = Deno.env.get("ODOO_PASSWORD") ?? "";

        if (!supabaseUrl || !supabaseKey || !ODOO_DB || !ODOO_USER || !ODOO_PASSWORD) {
            throw new Error("Missing environment variables. Please check your secrets.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // ── Authenticate once, reuse for all branches ──
        console.log("Authenticating with Odoo...");
        const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: { db: ODOO_DB, login: ODOO_USER, password: ODOO_PASSWORD }
            })
        });

        const authData = await authResponse.json();
        if (authData.error || !authData.result?.uid) {
            throw new Error("Odoo authentication failed");
        }

        let session_id: string | null = null;
        const setCookieHeader = authResponse.headers.get('set-cookie');
        if (setCookieHeader) {
            const match = setCookieHeader.match(/session_id=([^;]+)/);
            if (match) session_id = match[1];
        }

        if (!session_id) throw new Error("Could not retrieve session_id from Odoo");

        const odooHeaders = {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${session_id}`
        };

        // ── Sync each branch in sequence ──
        const results = [];
        for (const branch of BRANCHES) {
            try {
                const result = await syncBranch(branch, supabase, odooHeaders);
                results.push(result);
            } catch (branchError: any) {
                console.error(`❌ Branch ${branch.branch_id} failed:`, branchError.message);
                results.push({ branch: branch.branch_id, error: branchError.message, skipped: false });
            }
        }

        const totalDeducted = results.reduce((s, r) => s + (r.deducted || 0), 0);
        const totalItems = results.reduce((s, r) => s + (r.items || 0), 0);

        console.log(`\n🏁 All branches synced. Total deducted: ${totalDeducted}, Total SKUs: ${totalItems}`);

        return new Response(JSON.stringify({
            message: "Multi-branch sync completed",
            results,
            total_deducted: totalDeducted,
            total_items: totalItems
        }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("SYNC FAILED:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
