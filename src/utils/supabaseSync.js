import { supabase } from './supabaseClient';

// PSN branches share the SAME master_data (stored under ໂພນສີນວນ A)
// location_inventory remains SEPARATE per A/B
const PSN_BRANCHES = ['ໂພນສີນວນ A', 'ໂພນສີນວນ B', 'ໂພນສີນວນ'];
const isPSN = (branch) => PSN_BRANCHES.includes(branch);

// Master data ของ PSN ทุก variant ให้ดึงจาก A เสมอ
export const normalizeMasterBranch = (branch) =>
    isPSN(branch) ? 'ໂພນສີນວນ A' : branch;

const applyBranchFilter = (query, branch) =>
    isPSN(branch)
        ? query.in('branch_id', PSN_BRANCHES)
        : query.eq('branch_id', branch);

/**
 * 1. Sync Sheet "DATA" -> master_data (ข้อมูลอ้างอิง)
 */
export const syncMasterDataToSupabase = async (masterDataArray, branchId) => {
    try {
        if (!branchId) throw new Error('branch_id is required for sync');
        // PSN A และ B ใช้ master_data ชุดเดียวกัน เก็บภายใต้ A เสมอ
        const branch = normalizeMasterBranch(branchId);
        console.log(`Syncing master_data → branch: ${branch} (requested: ${branchId}), ${masterDataArray.length} records`);

        // Clear only THIS branch's master data
        const { error: deleteError } = await supabase.from('master_data').delete().eq('branch_id', branch);
        if (deleteError) throw deleteError;

        // คัดกรองเอาเฉพาะ Barcode ไม่ซ้ำ
        const uniqueMap = new Map();
        masterDataArray.forEach(row => {
            const getVal = (keys) => {
                for (const k of keys) {
                    const v = row[k];
                    if (v === 0 || v === '0') return '0';
                    if (v && String(v).trim() !== '') return String(v).trim();
                }
                return '';
            };

            const barcode = String(row['Barcode No.'] || row.barcode || row.barcode_no || row.Barcode || row.BARCODE || '').trim();
            if (barcode) {
                const itemNameValue = getVal(['Product Name(LA)', 'Item Name', 'product_name_la', 'item_name', 'Product Name', 'ລາຍການ', 'ITEM NAME', 'product_name']);
                uniqueMap.set(barcode, {
                    barcode: barcode,
                    product_name_la: itemNameValue,
                    item_name: itemNameValue,
                    category_1: getVal(['category_1', 'category1', 'CATEGORIES 1', 'Category 1', 'Category-1', 'category_1_actual']),
                    category_2: getVal(['category_2', 'category2', 'CATEGORIES 2', 'Category 2', 'Category-2', 'category_2_actual']),
                    qty: Number(row.qty ?? row.Qty ?? row.QTY ?? row.Quantity ?? row.quantity ?? 0),
                    branch_id: branch
                });
            }
        });

        const finalData = Array.from(uniqueMap.values());

        // Insert new data in chunks
        const chunkSize = 1000;
        for (let i = 0; i < finalData.length; i += chunkSize) {
            const { error: insertError } = await supabase.from('master_data').insert(finalData.slice(i, i + chunkSize));
            if (insertError) throw insertError;
        }

        return { success: true, synced: finalData.length };
    } catch (error) {
        console.error('Master Sync Error:', error);
        return { success: false, error: error.message };
    }
};

export const fetchMasterFromSupabase = async (branchId) => {
    try {
        // PSN A และ B ดึง master_data จาก A เสมอ
        const branch = normalizeMasterBranch(branchId || 'ຕະຫຼາດລາວ');
        let allData = [];
        let curPage = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            // ใช้ .eq() ตรงๆ ไม่ผ่าน applyBranchFilter เพราะ branch ถูก normalize แล้ว
            const { data, error } = await supabase
                .from('master_data')
                .select('*')
                .eq('branch_id', branch)
                .order('barcode', { ascending: true })
                .range(curPage * pageSize, (curPage + 1) * pageSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                curPage++;
            } else {
                hasMore = false;
            }

            if (curPage > 100) break;
        }

        return allData;
    } catch (error) {
        console.error('Fetch Master Error:', error);
        return null;
    }
};

/**
 * 2. Sync ผลการตรวจสอบ -> location_inventory (ข้อมูลหน้างานจริง)
 */
export const syncLocationResultsToSupabase = async (validatedResults, branchId) => {
    try {
        if (!branchId) throw new Error('branch_id is required for location sync');
        const branch = branchId;
        console.log('🚀 Starting Full Sync to location_inventory for branch:', branch, validatedResults.length, 'records');

        // 1. Clear only THIS branch's old data
        await supabase.from('location_inventory').delete().eq('branch_id', branch);

        // 2. Prepare Data for ALL items (include branch_id)
        const dataToInsert = validatedResults.map(res => ({
            barcode_no: res.barcode,
            item_name: res.masterItemName || res.itemName || '',
            rack_location: res.rackLocation,
            category_1_actual: res.category1,
            category_2_actual: res.category2,
            qty: Number(res.qty || 0),
            validation_status: res.status === 'passed' ? 'ຖືກຕ້ອງ' : res.status === 'mismatch' ? 'ບໍ່ກົງກັນ' : (res.status === 'missing' || res.status === 'incomplete' ? 'ບໍ່ຄົບຖ້ວນ' : 'ປົກກະຕິ'),
            remarks: res.reason || '',
            branch_id: branch
        }));

        // 3. Batch Insert (Chunked for performance with 12k+ records)
        const chunkSize = 2000;
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
            const { error: insertError } = await supabase.from('location_inventory').insert(dataToInsert.slice(i, i + chunkSize));
            if (insertError) throw insertError;
        }

        console.log('✅ Sync Complete: All records saved for branch:', branch);

        return {
            success: true,
            synced: dataToInsert.length,
            skipped: 0
        };
    } catch (error) {
        console.error('Location Sync Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 3. ເພີ່ມຂໍ້ມູນໃໝ່ເຂົ້າ location_inventory (Single Insert)
 */
export const addLocationRecord = async (record, branchId) => {
    try {
        if (!branchId) throw new Error('branch_id is required for addLocationRecord');
        const branch = branchId;
        const { data, error } = await supabase
            .from('location_inventory')
            .insert([{
                barcode_no: record.barcode_no,
                item_name: record.item_name,
                rack_location: record.rack_location,
                category_1_actual: record.category_1_actual,
                category_2_actual: record.category_2_actual,
                qty: Number(record.qty || 0),
                validation_status: record.validation_status || 'ປົກກະຕິ',
                remarks: record.remarks || '',
                uploaded_by: record.uploaded_by || 'Unknown',
                branch_id: branch
            }])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Add Location Record Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 4. ບັນທຶກປະຫວັດການປ່ຽນແປງ (Audit Log)
 * Updated to match actual inventory_history schema
 */
export const logInventoryHistory = async ({
    barcode, itemName, oldQty, newQty, updatedBy, reason,
    oldRack, newRack, oldCat1, newCat1, oldCat2, newCat2, branchId
}) => {
    try {
        const historyRecord = {
            barcode,
            item_name: itemName,
            old_qty: Number(oldQty || 0),
            new_qty: Number(newQty || 0),
            old_rack: oldRack || null,
            new_rack: newRack || null,
            old_category_1: oldCat1 || null,
            new_category_1: newCat1 || null,
            old_category_2: oldCat2 || null,
            new_category_2: newCat2 || null,
            change_reason: reason || '',
            details: reason || '',
            updated_by: updatedBy || 'Unknown',
            updated_at: new Date().toISOString(),
            branch_id: branchId || 'ຕະຫຼາດລາວ'
        };

        const { data, error } = await supabase
            .from('inventory_history')
            .insert([historyRecord])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const fetchLocationFromSupabase = async (branchId) => {
    try {
        const branch = branchId || 'ຕະຫຼາດລາວ';
        let allData = [];
        let curPage = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await applyBranchFilter(
                supabase.from('location_inventory').select('*').order('id', { ascending: true }),
                branch
            ).range(curPage * pageSize, (curPage + 1) * pageSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                curPage++;
            } else {
                hasMore = false;
            }

            if (curPage > 100) break;
        }

        return allData;
    } catch (error) {
        console.error('Fetch Location Error:', error);
        return null;
    }
};

/**
 * 5. Sync Odoo Data -> odoo_stocks
 */
export const syncOdooToSupabase = async (odooDataArray, branchId) => {
    try {
        if (!branchId) throw new Error('branch_id is required for odoo sync');
        const branch = branchId;
        console.log('Syncing to odoo_stocks for branch:', branch, odooDataArray.length, 'records');

        // Clear only THIS branch's old Odoo data
        await supabase.from('odoo_stocks').delete().eq('branch_id', branch);

        const uniqueMap = new Map();

        odooDataArray.forEach((row, idx) => {
            if (idx === 0) console.log('Odoo Row 1 Keys:', Object.keys(row));

            let barcode = String(row.barcode || row['Barcode'] || row['Barcode No.'] || row['EAN13'] || row['Code'] || row['Internal Reference'] || '').trim();
            if (!barcode) return;

            let qty = 0;
            const numericKeys = ['qty', 'quantity', 'on hand', 'available', 'free to use', 'count', 'total'];

            if (row.qty !== undefined) qty = row.qty;
            else if (row['Quantity'] !== undefined) qty = row['Quantity'];
            else if (row['Odoo Qty'] !== undefined) qty = row['Odoo Qty'];
            else {
                const keyFound = Object.keys(row).find(k => {
                    const lower = k.toLowerCase();
                    return numericKeys.some(n => lower.includes(n)) && !lower.includes('cost') && !lower.includes('price');
                });
                if (keyFound) qty = row[keyFound];
            }

            if (qty === null || qty === undefined || qty === '') qty = 0;
            qty = Number(qty);
            if (isNaN(qty)) qty = 0;
            const name = row.product_name || row['Product Name'] || row.item_name || row['Name'] || '';

            if (uniqueMap.has(barcode)) {
                const existing = uniqueMap.get(barcode);
                existing.qty_odoo += qty;
            } else {
                uniqueMap.set(barcode, {
                    barcode: barcode,
                    product_name: name,
                    qty_odoo: qty,
                    branch_id: branch
                });
            }
        });

        const dataToInsert = Array.from(uniqueMap.values());

        const chunkSize = 1000;
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
            const { error } = await supabase.from('odoo_stocks').insert(dataToInsert.slice(i, i + chunkSize));
            if (error) throw error;
        }

        return { success: true, synced: dataToInsert.length };
    } catch (error) {
        console.error('Odoo Sync Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 7. Clear Odoo Data
 */
export const clearOdooData = async (branchId) => {
    try {
        if (!branchId) throw new Error('branch_id is required for clearOdoo');
        const branch = branchId;
        const { error } = await supabase.from('odoo_stocks').delete().eq('branch_id', branch);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Clear Odoo Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 6. Fetch Odoo Data
 */
/**
 * 6. Fetch Odoo Data
 */
export const fetchOdooFromSupabase = async (branchId) => {
    try {
        const branch = branchId || 'ຕະຫຼາດລາວ';
        let allData = [];
        let curPage = 0;
        const pageSize = 2000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await applyBranchFilter(
                supabase.from('odoo_stocks').select('*'),
                branch
            ).range(curPage * pageSize, (curPage + 1) * pageSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                curPage++;
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (error) {
        console.error('Fetch Odoo Error:', error);
        return [];
    }
};
