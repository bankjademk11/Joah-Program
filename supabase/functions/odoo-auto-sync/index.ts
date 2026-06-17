import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ODOO_URL = "https://lod.kokkokm.com";
const BRANCH_ID = 249; // ຕະຫຼາດລາວ

serve(async (req) => {
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

        console.log("1. Authenticating with Odoo...");
        let uid = null;
        let session_id = null;

        const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: {
                    db: ODOO_DB,
                    login: ODOO_USER,
                    password: ODOO_PASSWORD
                }
            })
        });

        const authData = await authResponse.json();
        if (authData.error || !authData.result?.uid) {
            throw new Error("Odoo authentication failed");
        }

        uid = authData.result.uid;
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

        console.log("2. Fetching last processed ID from Supabase...");
        const { data: logs } = await supabase
            .from('test_pos_sync_logs')
            .select('last_processed_id, status')
            .order('sync_started_at', { ascending: false })
            .limit(1);

        let lastProcessedId = null;
        if (logs && logs.length > 0 && logs[0].status === 'success' && logs[0].last_processed_id) {
            lastProcessedId = logs[0].last_processed_id;
        }

        console.log(`3. Fetching Delta Sales from Odoo for Branch ${BRANCH_ID} (Last ID: ${lastProcessedId})...`);
        const todayStr = new Date().toISOString().split('T')[0];
        const startOfToday = `${todayStr} 00:00:00`;

        const domain = [
            ['company_id', '=', BRANCH_ID],
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
        const odooSales = salesData.result || [];

        if (odooSales.length === 0) {
            return new Response(JSON.stringify({ message: "Up to date! No new sales found.", deducted: 0 }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const newMaxId = Math.max(...odooSales.map((item: any) => item.id));
        const productIds = [...new Set(odooSales.map((item: any) => item.product_id[0]))];

        console.log("4. Fetching Product Barcodes...");
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
                    kwargs: {
                        fields: ['id', 'barcode']
                    }
                }
            })
        });

        const barcodeData = await barcodeResponse.json();
        const barcodeMap: Record<number, string> = {};
        (barcodeData.result || []).forEach((p: any) => {
            if (p.barcode) barcodeMap[p.id] = p.barcode;
        });

        console.log("5. Aggregating Sales...");
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

        console.log("6. Fetching Store Stock...");
        const { data: storeItems } = await supabase
            .from('test_taladlao_store')
            .select('*')
            .in('barcode_no', uniqueBarcodes);

        let totalQtyDeducted = 0;
        const syncDetails: any[] = [];
        const updatePromises: any[] = [];

        console.log("7. Calculating Deductions...");
        uniqueBarcodes.forEach(barcode => {
            const sold = salesSummary[barcode];
            const storeItem = storeItems?.find(s => s.barcode_no === barcode);

            if (storeItem) {
                const newQty = storeItem.qty - sold.qty_sold;
                totalQtyDeducted += sold.qty_sold;

                syncDetails.push({
                    barcode_no: barcode,
                    item_name: sold.name,
                    qty_sold: sold.qty_sold,
                    old_store_qty: storeItem.qty,
                    new_store_qty: newQty,
                    status: 'success'
                });

                updatePromises.push(
                    supabase.from('test_taladlao_store').update({ qty: newQty, last_updated: new Date().toISOString() }).eq('id', storeItem.id)
                );
            }
        });

        await Promise.all(updatePromises);

        console.log("8. Saving Logs...");
        const { data: logEntry, error: logErr } = await supabase
            .from('test_pos_sync_logs')
            .insert([{
                sync_started_at: new Date().toISOString(),
                sync_completed_at: new Date().toISOString(),
                total_items_sold: uniqueBarcodes.length,
                total_qty_deducted: totalQtyDeducted,
                status: 'success',
                branch_name: 'ຕະຫຼາດລາວ (TEST) [AUTO]',
                last_processed_id: newMaxId
            }])
            .select();

        if (logErr) throw logErr;

        if (logEntry && logEntry[0] && syncDetails.length > 0) {
            const detailsToInsert = syncDetails.map(d => ({ ...d, log_id: logEntry[0].id }));
            await supabase.from('test_pos_sync_details').insert(detailsToInsert);
        }

        console.log("SYNC SUCCESS! Total Deducted:", totalQtyDeducted);

        return new Response(JSON.stringify({ 
            message: "Sync Completed Successfully", 
            items_processed: uniqueBarcodes.length,
            deducted: totalQtyDeducted,
            newMaxId 
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
