import { supabase } from './supabaseClient';

/**
 * 1. Sync Sheet "DATA" -> master_data (ข้อมูลอ้างอิง)
 */
export const syncMasterDataToSupabase = async (masterDataArray) => {
    try {
        console.log('Syncing to master_data...', masterDataArray.length, 'records');

        // ล้างข้อมูลเก่า
        const { error: deleteError } = await supabase.from('master_data').delete().not('barcode', 'is', null);
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

            const barcode = String(row['Barcode No.'] || row.barcode || row.Barcode || row.BARCODE || '').trim();
            if (barcode) {
                uniqueMap.set(barcode, {
                    barcode: barcode,
                    product_name_la: getVal(['product_name_la', 'Item Name', 'Product Name', 'ລາຍການ', 'ITEM NAME']),
                    category_1: getVal(['category_1', 'category1', 'CATEGORIES 1', 'Category 1', 'Category-1']),
                    category_2: getVal(['category_2', 'category2', 'CATEGORIES 2', 'Category 2', 'Category-2']),
                    qty: Number(row.qty || row.Qty || row.QTY || 0)
                });
            }
        });

        const finalData = Array.from(uniqueMap.values());

        // 3. Insert new data in chunks (Optimized for 30,000+ records)
        const chunkSize = 1000;
        for (let i = 0; i < finalData.length; i += chunkSize) {
            const { error: insertError } = await supabase.from('master_data').insert(finalData.slice(i, i + chunkSize));
            if (insertError) throw insertError;
        }

        return { success: true };
    } catch (error) {
        console.error('Master Sync Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Fetch ALL Master Data from Supabase (Handling pagination)
 * ดึงข้อมูลทั้งหมดโดยไม่จำกัดแค่ 1,000 แถว
 */
export const fetchMasterFromSupabase = async () => {
    try {
        let allData = [];
        let curPage = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('master_data')
                .select('*')
                .range(curPage * pageSize, (curPage + 1) * pageSize - 1);

            if (error) throw error;

            if (data.length > 0) {
                allData = [...allData, ...data];
                curPage++;
            } else {
                hasMore = false;
            }

            // Safety break 
            if (curPage > 100) break;
        }

        return allData;
    } catch (error) {
        console.error('Fetch Error:', error);
        return null;
    }
};

/**
 * 2. Sync ผลการตรวจสอบ -> location_inventory (ข้อมูลหน้างานจริง)
 */
export const syncLocationResultsToSupabase = async (validatedResults) => {
    try {
        console.log('Saving results to location_inventory...', validatedResults.length, 'records');

        await supabase.from('location_inventory').delete().not('id', 'is', null);

        const dataToInsert = validatedResults.map(res => ({
            barcode_no: res.barcode,
            item_name: res.masterItemName || res.itemName || '',
            rack_location: res.rackLocation,
            category_1_actual: res.category1,
            category_2_actual: res.category2,
            qty: Number(res.qty || 0),
            validation_status: res.status === 'passed' ? 'ຖືກຕ້ອງ' : res.status === 'mismatch' ? 'ບໍ່ກົງກັນ' : 'ບໍ່ຄົບຖ້ວນ',
            remarks: res.reason || ''
        }));

        const chunkSize = 200;
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
            const { error: insertError } = await supabase.from('location_inventory').insert(dataToInsert.slice(i, i + chunkSize));
            if (insertError) throw insertError;
        }

        return { success: true };
    } catch (error) {
        console.error('Location Sync Error:', error);
        return { success: false, error: error.message };
    }
};
