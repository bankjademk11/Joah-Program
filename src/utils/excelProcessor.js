import * as XLSX from 'xlsx';
import { BRANCH_RACK_RULES } from './rackUtils';

/**
 * อ่านไฟล์ Excel และแปลงเป็น Workbook
 */
export const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                resolve(workbook);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * ອ່ານໄຟລ໌ Excel ຈາກ URL (ສຳລັບຖານຂໍ້ມູນພາຍໃນ)
 */
export const readExcelFromUrl = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('ບໍ່ສາມາດໂຫຼດໄຟລ໌ຖານຂໍ້ມູນໄດ້');
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    return workbook;
};

/**
 * ดึงชื่อ Sheet ทั้งหมดจาก Workbook
 */
export const getSheetNames = (workbook) => {
    return workbook.SheetNames;
};

/**
 * แปลง Sheet เป็น JSON โดยใช้ Header จากแถวแรก
 */
export const sheetToJSON = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, {
        raw: false, // แปลงทุกอย่างเป็น string เพื่อป้องกัน Scientific Notation
        defval: '' // ค่า default สำหรับ cell ว่าง
    });
};

/**
 * Normalize ข้อมูล Barcode (Trim และแปลงเป็น String)
 */
const normalizeBarcode = (barcode) => {
    if (barcode === null || barcode === undefined) return '';
    return String(barcode).replace(/\s+/g, '');
};

/**
 * Normalize value for comparison (Handles '01' vs '1', and trims)
 * Converts to uppercase to ensure case-insensitive matching for categories.
 */
const normalizeForComparison = (val) => {
    if (val === 0 || val === '0' || val === null || val === undefined) return '';

    let s = String(val).trim();

    // Treat visual placeholders as empty for logic comparison
    if (s === '' || s === 'Empty' || s === 'ບໍ່ມີຂໍ້ມູນ') return '';

    // Remove leading zeros only if it's a pure number string (Excel style)
    if (/^\d+$/.test(s)) {
        return String(Number(s));
    }
    
    // Always return uppercase for text comparisons (e.g. STATIONERY vs stationery)
    return s.toUpperCase();
};

/**
 * สร้าง Hash Map จากข้อมูล DATA Sheet เพื่อ O(1) lookup
 */
const createMasterDataMap = (dataRows) => {
    const map = new Map();

    dataRows.forEach((row) => {
        const barcode = normalizeBarcode(row['Barcode No.'] || row['Barcode'] || row['BARCODE'] || row['barcode']);

        if (barcode) {
            // ฟังก์ชันช่วยดึงค่าแบบรักษาเลข 0
            const safeGet = (keys) => {
                for (const key of keys) {
                    const val = row[key];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        return String(val).trim();
                    }
                    if (val === 0 || val === '0') return '0';
                }
                return '';
            };

            map.set(barcode, {
                category1: safeGet(['category_1', 'CATEGORIES 1', 'Category 1', 'Category-1']),
                category2: safeGet(['category_2', 'CATEGORIES 2', 'Category 2', 'Category-2']),
                itemName: safeGet(['product_name_la', 'Item Name', 'Product Name', 'ລາຍການ', 'ITEM NAME']),
                qty: Number(row.qty || row.Qty || row.QTY || row['Quantity'] || 0),
                updatedBy: row.updated_by,
                updatedAt: row.updated_at
            });
        }
    });

    return map;
};

/**
 * ตรวจสอบและ Validate ข้อมูล Location กับ DATA
 * 
 * Logic:
 * - สีฟ้า: Barcode ไม่พบใน DATA หรือ Categories ใน DATA เป็นค่าว่าง
 * - สีแดง: Categories ไม่ตรงกัน
 * - ปกติ: ข้อมูลถูกต้องทั้งหมด
 */
export const validateData = (locationRows, dataRows, odooRows = [], targetBranch = 'ສີວິໄລ') => {
    const masterMap = createMasterDataMap(dataRows);

    // Create Odoo Map for fast lookup
    const odooMap = new Map();
    odooRows.forEach(row => {
        const bc = normalizeBarcode(row.barcode || row.Barcode || row['Barcode No.']);
        if (bc) odooMap.set(bc, Number(row.qty || row.qty_odoo || 0));
    });

    const results = [];
    let stats = {
        total: 0,
        passed: 0,
        mismatch: 0, // สีแดง
        missing: 0,  // สีฟ้า
        zeroQty: 0,  // สินค้าเป็น 0
        hasQty: 0,   // สินค้ามีจำนวน
    };

    locationRows.forEach((row, index) => {
        // Debug: พิมพ์ข้อมูลแถวแรกออกมาดู structure
        if (index === 0) console.log('First Row Data:', row);

        const barcode = normalizeBarcode(
            row['Barcode No.'] || row['Barcode'] || row['BARCODE'] || row['barcode']
        );
        const rackLocation = (row['Rack Location'] || row['Location'] || '').trim();

        // ດຶງຊື່ສິນຄ້າຈາກ Location Sheet
        const itemName = (row['Item Name'] || row['item_name'] || row['ITEM NAME'] || '').trim();

        // ດຶງຂໍ້ມູນ Category ໂດຍເຊັກລະອຽດ (ຖ້າເປັນ 0 ຕ້ອງໄດ້ 0)
        const getRaw = (key) => {
            const val = row[key];
            if (val === 0 || val === '0') return '0';
            return (val !== undefined && val !== null) ? String(val).trim() : '';
        };
        const category1 = getRaw('Category-1') || getRaw('Category 1') || getRaw('CATEGORIES 1') || '';
        const category2 = getRaw('Category-2') || getRaw('Category 2') || getRaw('CATEGORIES 2') || '';

        // พยายามดึง QTY จากหลายๆ ชื่อที่เป็นไปได้ (ไม่ทำ numeric scan เพราะจะหยิบ Barcode ผิด)
        let qty = 0;
        const possibleQtyKeys = [
            'QTY', 'Qty', 'qty',
            'Quantity', 'quantity', 'QUANTITY',
            'จํานวน', 'จำนวน', 'ຈຳນວນ',
            'Total', 'TOTAL', 'total',
            'Count', 'COUNT', 'count',
            'Amount', 'AMOUNT',
            'ລວມ', 'ລວມທັງໝົດ'
        ];

        let foundQtyKey = null;
        for (const key of Object.keys(row)) {
            const trimmedKey = key.trim(); // ← trim space ออกก่อนเปรียบเทียบ
            if (possibleQtyKeys.includes(trimmedKey) || trimmedKey.toUpperCase() === 'QTY') {
                qty = row[key];
                foundQtyKey = key;
                break;
            }
        }

        // Debug: แถวแรกแสดง keys ทั้งหมด เพื่อตรวจสอบชื่อ header ที่แท้จริง
        if (index === 0) {
            console.log('📋 Excel Headers:', Object.keys(row));
            console.log('🎯 Found QTY Key:', foundQtyKey, '→ value:', qty);
            if (!foundQtyKey) {
                console.warn('⚠️ QTY column NOT FOUND! Headers are:', Object.keys(row).join(', '));
            }
        }

        // เพิ่มการตรวจจับสินค้าที่เป็น 0
        const numericQty = parseFloat(qty) || 0;
        if (numericQty === 0) stats.zeroQty++;
        else if (numericQty > 0) stats.hasQty++;

        // ดึงข้อมูล Date (Column H)
        let inputDate = '';
        const possibleDateKeys = ['Date', 'date', 'Time', 'time', 'วันที', 'วันที่', 'Last Update'];

        // 1. หาตามชื่อ Key
        for (const key of Object.keys(row)) {
            if (possibleDateKeys.includes(key) || key.toUpperCase() === 'DATE') {
                inputDate = row[key];
                break;
            }
        }

        // 2. ถ้าไม่เจอ ให้ลองดึงจาก Column Index ที่ 7 (Column H)
        if (!inputDate) {
            const values = Object.values(row);
            if (values.length > 7) {
                inputDate = values[7]; // Index 7 = Column H
            }
            // Fallback: เช็ค __EMPTY_7
            if (!inputDate && row['__EMPTY_7']) inputDate = row['__EMPTY_7'];
        }

        let status = 'normal';
        let color = null;
        let reason = '';

        stats.total++;

        const masterData = masterMap.get(barcode);
        const odooQty = odooMap.has(barcode) ? odooMap.get(barcode) : null;

        // --- Dynamic Rack Validation based on rackUtils.js ---
        const checkRackMatch = (cat1, rack) => {
            if (!cat1 || !rack) return { match: true };
            const branchRules = BRANCH_RACK_RULES[targetBranch] || BRANCH_RACK_RULES['ສີວິໄລ'];
            const rules = branchRules[cat1.toUpperCase().trim()];

            if (!rules) return { match: true };

            let isMatch = false;
            let expectedLabels = [];
            let allZonesForLabel = [];
            let maxLevelForLabel = 0;
            let maxSectionsForLabel = 0;
            let hasFloorZone = false;

            rules.forEach(rule => {
                const format = rule.format || 'legacy';
                const zones = rule.zones.join('|');
                const firstZone = rule.zones[0];
                const lastZone = rule.zones[rule.zones.length - 1];

                let pattern;
                let label = '';

                switch (format) {
                    case 'shelf':
                        pattern = new RegExp(`^(${zones})-B[1-${rule.maxBay || 3}]-L[1-${rule.maxLevel || 4}]-(\\d+)$`, 'i');
                        label = `${firstZone}-B1-L1 → ${lastZone}-B${rule.maxBay || 3}-L${rule.maxLevel || 4}`;
                        break;
                    case 'display':
                        pattern = new RegExp(`^(${zones})-M(\\d+)$`, 'i');
                        label = `${firstZone}-M1 → ${firstZone}-M${rule.maxModule || 14}`;
                        break;
                    case 'standalone':
                        pattern = new RegExp(`^(${zones})-(\\d+)$`, 'i');
                        label = `${firstZone}-1 → ${firstZone}-${rule.maxModule || 8}`;
                        break;
                    case 'floor':
                        pattern = new RegExp(`^(${zones})(\\d+)$`, 'i');
                        label = `${firstZone}1 → ${firstZone}${rule.maxModule || 10}`;
                        break;
                    case 'tll_new':
                        // TLL New Format: A01-1, A01-2, ... (Zone-Level only)
                        if (rule.maxLevel === 0) {
                            pattern = new RegExp(`^(${zones})$`, 'i');
                            label = rule.zones.join(', ');
                            hasFloorZone = true;
                        } else {
                            pattern = new RegExp(`^(${zones})-[1-9]\\d*$`, 'i');
                            label = `${firstZone}-1 → ${lastZone}-${rule.maxLevel || 4}`;
                        }
                        break;
                    case 'tll_shelf':
                        pattern = new RegExp(`^(${zones})-[1-${rule.maxLevel || 4}]-[1-${rule.maxSections || 5}]$`, 'i');
                        label = `${firstZone}-1-1 → ${lastZone}-${rule.maxLevel || 4}-${rule.maxSections || 5}`;
                        break;
                    case 'tll_floor': {
                        // Allow optional "ໂລພື້ນ " prefix so raw zones like K01 are matched
                        const floorPatternStr = rule.zones.map(z => z.replace('ໂລພື້ນ ', '(?:ໂລພື້ນ\\\\s*)?')).join('|');
                        pattern = new RegExp(`^(${floorPatternStr})$`, 'i');
                        label = rule.zones.join(', ');
                        hasFloorZone = true;
                        break;
                    }
                    case 'exact': {
                        pattern = new RegExp(`^(${zones})$`, 'i');
                        if (rule.label) {
                            label = rule.label;
                        } else if (rule.zones.length > 3) {
                            label = `${rule.zones[0]} → ${rule.zones[rule.zones.length - 1]}`;
                        } else {
                            label = rule.zones.join(', ');
                        }
                        hasFloorZone = true; // Prevents legacy combining logic which might mess it up
                        break;
                    }
                    default:
                        if (rule.maxLevel === 0) {
                            pattern = new RegExp(`^(${zones})$`, 'i');
                            label = rule.zones.join(', ');
                            hasFloorZone = true;
                        } else {
                            pattern = new RegExp(`^(${zones})-L[1-${rule.maxLevel}]-[1-${rule.maxSections}]$`, 'i');
                            label = `${firstZone}-L1-1 → ${lastZone}-L${rule.maxLevel}-${rule.maxSections}`;
                        }
                }

                if (pattern.test(rack)) isMatch = true;
                expectedLabels.push(label);

                // Collect all zones and max values for building combined label
                allZonesForLabel.push(...rule.zones);
                if ((rule.maxLevel || 0) > maxLevelForLabel) maxLevelForLabel = rule.maxLevel || 0;
                if ((rule.maxSections || 0) > maxSectionsForLabel) maxSectionsForLabel = rule.maxSections || 0;
            });

            // Build a single clean combined label (no ຫຼື) for pure rack zones
            // Only fall back to ຫຼື when mixing floor zones + rack zones (e.g., KITCHEN)
            const ruleFormat = rules[0]?.format || 'legacy';
            let combinedLabel;
            if (ruleFormat === 'tll_new' && !hasFloorZone && maxLevelForLabel > 0) {
                // TLL New: combine into single range e.g. "A01-1 → A30-4"
                const firstAll = allZonesForLabel[0];
                const lastAll = allZonesForLabel[allZonesForLabel.length - 1];
                combinedLabel = `${firstAll}-1 → ${lastAll}-${maxLevelForLabel}`;
            } else if (ruleFormat === 'tll_new' && hasFloorZone && maxLevelForLabel > 0) {
                // TLL New mixed rack + floor
                const rackLabels = expectedLabels.filter(l => l.includes('→'));
                const floorLabels = expectedLabels.filter(l => !l.includes('→'));
                combinedLabel = [...new Set([...rackLabels, ...floorLabels])].join(' ຫຼື ');
            } else if (ruleFormat === 'legacy' && !hasFloorZone && maxLevelForLabel > 0) {
                // All rack groups → combine into single range e.g. "S01-L1-1 → S10-L5-4"
                const firstAll = allZonesForLabel[0];
                const lastAll = allZonesForLabel[allZonesForLabel.length - 1];
                combinedLabel = `${firstAll}-L1-1 → ${lastAll}-L${maxLevelForLabel}-${maxSectionsForLabel}`;
            } else if (ruleFormat === 'tll_shelf' && !hasFloorZone && maxLevelForLabel > 0) {
                const firstAll = allZonesForLabel[0];
                const lastAll = allZonesForLabel[allZonesForLabel.length - 1];
                combinedLabel = `${firstAll}-1-1 → ${lastAll}-${maxLevelForLabel}-${maxSectionsForLabel}`;
            } else if ((ruleFormat === 'legacy' || ruleFormat === 'tll_shelf') && hasFloorZone && maxLevelForLabel > 0) {
                // Mixed rack + floor: show rack range first, then floor zones
                const rackLabels = expectedLabels.filter(l => l.includes('→'));
                const floorLabels = expectedLabels.filter(l => !l.includes('→'));
                combinedLabel = [...new Set([...rackLabels, ...floorLabels])].join(' ຫຼື ');
            } else {
                combinedLabel = [...new Set(expectedLabels)].join(' ຫຼື ');
            }

            return {
                match: isMatch,
                expected: combinedLabel
            };
        };

        if (!masterData) {
            // ไม่พบ Barcode ใน DATA
            status = 'missing';
            color = 'blue';
            reason = 'ບໍ່ພົບ Barcode ໃນຖານຂໍ້ມູນອ້າງອີງ';
            stats.missing++;
        } else {
            const cat1Match = normalizeForComparison(category1) === normalizeForComparison(masterData.category1);
            const cat2Match = normalizeForComparison(category2) === normalizeForComparison(masterData.category2);

            // ตรวจสอบ Rack กับ Category หลัก (Master)
            const rackValidation = checkRackMatch(masterData.category1, rackLocation);

            // Check if Odoo Qty mismatches (if available)
            // Note: We prioritize displaying it, but let's make it alertable
            const odooMismatch = (odooQty !== null && Number(odooQty) !== numericQty);

            if (!masterData.category1 || !masterData.category2) {
                // Categories ใน DATA เป็นค่าว่าง
                status = 'incomplete';
                color = 'blue';
                reason = 'ຂໍ້ມູນໝວດໝູ່ໃນຖານຂໍ້ມູນບໍ່ຄົບຖ້ວນ';
                stats.missing++;
            } else if (!cat1Match || !cat2Match || !rackValidation.match) {
                // ถ้า Cat1, Cat2 ຫຼື Rack ບໍ່ຕົງ -> Mismatch (ສີແດງ)
                status = 'mismatch';
                color = 'red';

                const mismatchReasons = [];
                if (!cat1Match) mismatchReasons.push(`Cat-1 ບໍ່ກົງ (DB: ${masterData.category1})`);
                if (!cat2Match) mismatchReasons.push(`Cat-2 ບໍ່ກົງ (DB: ${masterData.category2})`);
                if (!rackValidation.match) mismatchReasons.push(`ວາງຜິດ Rack (ຄວນແມ່ນ ${rackValidation.expected})`);

                // Add Odoo info to reason but it's not the cause of "mismatch" status
                if (odooMismatch) mismatchReasons.push(`Odoo Qty Diff (Odoo: ${odooQty})`);

                reason = mismatchReasons.join(' | ');
                stats.mismatch++;
            } else {
                // ตรงกันทั้งหมด (Rack & Category Passed)
                // แม้ Odoo Qty ไม่ตรง ก็ยังถือว่า Passed ในส่วนของ 
                status = 'passed';
                stats.passed++;

                if (odooMismatch) {
                    reason = `Odoo Qty Diff (Odoo: ${odooQty})`;
                }
            }
        }

        results.push({
            id: row.id, // Preserve ID for potential database updates
            branch_id: row.branch_id, // Preserve branch for warehouse filter
            rowIndex: index + 1,
            barcode,
            itemName, // Item name from Location sheet
            rackLocation,
            category1,
            category2,
            qty,
            inputDate,
            status,
            color,
            reason,
            masterCategory1: masterData?.category1 || '',
            masterCategory2: masterData?.category2 || '',
            masterQty: masterData?.qty || 0,
            odooQty: odooQty, // Included in result
            masterItemName: masterData?.itemName || '',
            masterUpdatedAt: masterData?.updatedAt || '', // Renamed to keep separate
            masterUpdatedBy: masterData?.updatedBy || '', // Renamed to keep separate
            updatedAt: row.created_at || row.updated_at || '',
            uploadedBy: row.uploaded_by || 'Unknown', // Map uploaded_by from raw row
            originalRow: row
        });
    });

    return { results, stats };
};

/**
 * ตรวจสอบและแนะนำชื่อ Sheet ที่เหมาะสม
 */
export const suggestSheetMapping = (sheetNames) => {
    const suggestions = {
        locationSheet: null,
        dataSheet: null,
    };

    sheetNames.forEach((name) => {
        const lowerName = name.toLowerCase();

        if (lowerName.includes('location') || lowerName.includes('loc')) {
            suggestions.locationSheet = name;
        }

        if (lowerName.includes('data') || lowerName.includes('master')) {
            suggestions.dataSheet = name;
        }
    });

    return suggestions;
};
