
// --- Smart Automation Rules (Per-Branch Rack Layout) ---
// Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)
// Rules are organized by branch_id — each branch has its own layout

const MEGAMALL_ALL_RACKS = ["MFA01-1","MFA01-10","MFA01-2","MFA01-3","MFA01-4","MFA01-5","MFA01-6","MFA01-7","MFA01-8","MFA01-9","MFA02-1","MFA02-10","MFA02-2","MFA02-3","MFA02-4","MFA02-5","MFA02-6","MFA02-7","MFA02-8","MFA02-9","MFA03-1","MFA03-2","MFA03-3","MFA03-4","MFA03-5","MFA03-6","MFA04-+6","MFA04-1","MFA04-10","MFA04-2","MFA04-3","MFA04-4","MFA04-5","MFA04-7","MFA04-8","MFA04-9","MFA05-1","MFA05-10","MFA05-2","MFA05-3","MFA05-4","MFA05-5","MFA05-6","MFA05-7","MFA05-8","MFA05-9","MFA06-1","MFA06-2","MFA06-3","MFA06-5","MFA06-6","MFA07-1","MFA07-10","MFA07-2","MFA07-3","MFA07-4","MFA07-5","MFA07-6","MFA07-7","MFA07-8","MFA07-9","MFA08-1","MFA08-10","MFA08-2","MFA08-3","MFA08-4","MFA08-5","MFA08-6","MFA08-7","MFA08-8","MFA08-9","MFA09-1","MFA09-2","MFA09-3","MFA09-4","MFA09-5","MFA09-6","MFA10-1","MFA10-10","MFA10-2","MFA10-3","MFA10-4","MFA10-5","MFA10-6","MFA10-7","MFA10-8","MFA10-9","MFA11-1","MFA11-10","MFA11-2","MFA11-3","MFA11-4","MFA11-5","MFA11-6","MFA11-7","MFA11-8","MFA11-9","MFA12-1","MFA12-2","MFA12-3","MFA12-4","MFA12-5","MFA12-6","MFA13-1","MFA13-10","MFA13-2","MFA13-3","MFA13-4","MFA13-5","MFA13-6","MFA13-7","MFA13-8","MFA13-9","MFA14-1","MFA14-10","MFA14-2","MFA14-3","MFA14-4","MFA14-5","MFA14-6","MFA14-7","MFA14-8","MFA14-9","MFA15-1","MFA15-2","MFA15-3","MFA15-4","MFA15-5","MFA15-6","MFA6-4","MFB01-1","MFB01-2","MFB01-3","MFB01-4","MFB01-5","MFB01-6","MFB02-1","MFB02-2","MFB02-3","MFB02-4","MFB02-5","MFB02-6","MFB03-1","MFB03-2","MFB03-3","MFB03-4","MFB03-5","MFB03-6","MFB04-1","MFB04-2","MFB04-3","MFB04-4","MFB04-5","MFB04-6","MFB05-1","MFB05-2","MFB05-3","MFB05-4","MFB05-5","MFB05-6","MFB06-1","MFB06-2","MFB06-3","MFB06-4","MFB06-5","MFB06-6","MFB07-1","MFB07-2","MFB07-3","MFB07-4","MFB07-5","MFB07-6","MFB08-1","MFB08-2","MFB08-3","MFB08-4","MFB08-6","MFB085","MFB09-1","MFB09-2","MFB09-3","MFB09-4","MFB09-5","MFB09-6","MFC01-1","MFC01-2","MFC01-3","MFC01-4","MFC01-5","MFC01-6","MFC02-1","MFC02-2","MFC02-3","MFC02-4","MFC02-5","MFC02-6","MFC03-1","MFC03-2","MFC03-3","MFC03-4","MFC03-5","MFC03-6","MFC04-1","MFC04-2","MFC04-3","MFC04-4","MFC04-5","MFC04-6","MFC05-1","MFC05-2","MFC05-3","MFC05-4","MFC05-5","MFC05-6","MFC06-1","MFC06-2","MFC06-3","MFC06-4","MFC06-5","MFC06-6","MFC07-1","MFC07-2","MFC07-3","MFC07-4","MFC07-5","MFC07-6","MFC08-1","MFC08-2","MFC08-3","MFC08-4","MFC08-5","MFC08-6","MFC09-1","MFC09-2","MFC09-3","MFC09-4","MFC09-5","MFC09-6","MFD01-1","MFD01-2","MFD01-3","MFD01-4","MFD01-5","MFD01-6","MFD01-7","MFD01-8","MFD02-1","MFD02-2","MFD02-3","MFD02-4","MFD02-5","MFD02-6","MFD02-7","MFD02-8","MFD03-1","MFD03-2","MFD03-3","MFD03-4","MFD03-5","MFD03-6","MFD03-7","MFD03-8","MFE01-1","MFE01-2","MFE01-3","MFE01-4","MFE01-5","MFE01-6","MFE02-1","MFE02-10","MFE02-2","MFE02-3","MFE02-4","MFE02-5","MFE02-6","MFE02-7","MFE02-8","MFE02-9","MFE03-1","MFE03-10","MFE03-2","MFE03-3","MFE03-4","MFE03-5","MFE03-6","MFE03-7","MFE03-8","MFE03-9","MFE04-1","MFE04-10","MFE04-2","MFE04-3","MFE04-4","MFE04-5","MFE04-6","MFE04-7","MFE04-8","MFE04-9","MFE05-1","MFE05-10","MFE05-2","MFE05-3","MFE05-4","MFE05-5","MFE05-6","MFE05-7","MFE05-8","MFE05-9","MFE06-1","MFE06-10","MFE06-2","MFE06-3","MFE06-4","MFE06-5","MFE06-6","MFE06-7","MFE06-8","MFE06-9","MFE07-1","MFE07-10","MFE07-2","MFE07-3","MFE07-4","MFE07-5","MFE07-6","MFE07-7","MFE07-8","MFE07-9","MFF01-1","MFF01-2","MFF01-3","MFF01-4","MFF01-5","MFF01-6","MFF01-7","MFF01-8","MFF02-1","MFF02-2","MFF02-3","MFF02-4","MFF02-5","MFF02-6","MFF02-7","MFF02-8","MFF03-1","MFF03-2","MFF03-3","MFF03-4","MFF03-5","MFF03-6","MFF03-7","MFF03-8","MFF04-1","MFF04-2","MFF04-3","MFF04-4","MFF04-5","MFF04-6","MFF04-7","MFF04-8","MFF05-1","MFF05-2","MFF05-3","MFF05-4","MFF05-5","MFF05-6","MFF05-7","MFF05-8","MFF06-1","MFF06-2","MFF06-3","MFF06-4","MFF06-5","MFF06-6","MFF06-7","MFF06-8","MFF07-1","MFF07-2","MFF07-3","MFF07-4","MFF07-5","MFF07-6","MFF07-7","MFF07-8","MFF08-1","MFF08-2","MFF08-3","MFF08-4","MFF08-5","MFF08-6","MFF08-7","MFF08-8","MFF09-1","MFF09-2","MFF09-3","MFF09-4","MFF09-5","MFF09-6","MFF09-7","MFF09-8","MFG01","MFG02","MFG03","MFG04","MFG05","MFG06","MFG07","MFG08","MFG09","MFG10","MFG11","MFG12","MFG13","MFG14","MFG15","MFG16","MFG17","MFG18","MFH01","MFH02","MFH03","MFH04","MFH05","MFH06","MFH07","MFH08","MFH09","MFH10","MFI1","MFI2","MFI3","MFI4","MFI5"];


const BRANCH_RACK_RULES = {
    // ══════════════════════════════════════════════
    // ສີວິໄລ — Rack Layout (from MapLayoutSVL.md — updated 2026-03-12)
    // ══════════════════════════════════════════════
    'ສີວິໄລ': {
        'KITCHEN': [
            // G01-G16 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16'], maxLevel: 5, maxSections: 4 },
            // G17, G18 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['G17', 'G18'], maxLevel: 5, maxSections: 4 },
            // ໂລພື້ນ floor zones (Cat Kitchen)
            { zones: ['G10 ໂລພື້ນ'], maxLevel: 0, maxSections: 0 },
        ],
        'BEAUTY': [
            // E01-E04 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['E01', 'E02', 'E03', 'E04'], maxLevel: 5, maxSections: 4 },
            // E05 = floor zone
            { zones: ['E05'], maxLevel: 0, maxSections: 0 },
        ],
        'STATIONERY': [
            // S01-S08, S10 = rack shelves (Level 1-5, Section 1-4)
            // S09 ถูกเปลี่ยนเป็น Stationery ด้วย แต่ใน MapLayoutSVL.md ไม่ปรากฏ S09 → ข้ามไป
            { zones: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'], maxLevel: 5, maxSections: 4 },
        ],
        'TOYS': [
            // T09 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['T09'], maxLevel: 5, maxSections: 4 },
        ],
        'CLEANING/BATH': [
            // A01-A03 = rack shelves (Level 1-5, Section 1-4)
            // A01 now goes to L6 (A01-L6-1~4 added 2026-03-26); A02, A03 remain L1-L5
            { zones: ['A01'], maxLevel: 6, maxSections: 4 },
            { zones: ['A02', 'A03'], maxLevel: 5, maxSections: 4 },
        ],
        'INTERIOR': [
            // B01-B03 = rack shelves (B03 starts at L1, B01-B02 start at L1)
            // B03 ใน file ไม่มี L5 (มีแค่ L1-L4)
            { zones: ['B03'], maxLevel: 4, maxSections: 4 },
            { zones: ['B01', 'B02'], maxLevel: 5, maxSections: 4 },
        ],
        'SPORT': [
            // B04 = rack shelves (Level 1-5, Section 1-4) — แยกออกจาก Interior
            { zones: ['B04'], maxLevel: 5, maxSections: 4 },
        ],
        'TOOL/DIGITAL': [
            // F01-F04 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['F01', 'F02', 'F03', 'F04'], maxLevel: 5, maxSections: 4 },
        ],
        'STORAGE': [
            // D01-D07 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07'], maxLevel: 5, maxSections: 4 },
            // D08, D09 = floor zones
            { zones: ['D08', 'D09', 'D08-ໂລພື້ນ', 'D09-ໂລພື້ນ'], maxLevel: 0, maxSections: 0 },
        ],
        'FASHION': [
            // C01-C05 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['C01', 'C02', 'C03', 'C04', 'C05'], maxLevel: 5, maxSections: 4 },
            // C06 = floor zone
            { zones: ['C06'], maxLevel: 0, maxSections: 0 },
        ],
    },


    // ══════════════════════════════════════════════
    // ໂພນສີນວນ — Rack Layout (from MapdataPSN.MD)
    // Format: AXX-BX-LX-1 (Zone-Bay-Level-Section)
    //         BX-MX (Display-Module)
    //         M-X (Standalone Display)
    //         CX (Floor Storage)
    // ══════════════════════════════════════════════
    'ໂພນສີນວນ': (() => {
        const psnMap = {};

        const addExact = (cat, items) => {
            if (items.length === 0) return;
            const category = cat.toUpperCase();
            if (!psnMap[category]) psnMap[category] = [];

            // Build abbreviated label for display purposes
            let label = items.join(', ');
            if (items.length > 3) {
                // Determine if it's a range of modules or shelves
                const first = items[0];
                const last = items[items.length - 1];
                label = `${first} → ${last}`;
            }

            psnMap[category].push({ zones: items, maxLevel: 0, format: 'exact', label });
        };

        const addShelf = (cat, zones, skipPrefixes = []) => {
            const result = [];
            zones.forEach(z => {
                for (let b = 1; b <= 3; b++) {
                    for (let l = 1; l <= 4; l++) {
                        for (let s = 1; s <= 4; s++) {
                            const loc = `${z}-B${b}-L${l}-${s}`;
                            const isSkipped = skipPrefixes.some(prefix => loc.startsWith(prefix));
                            if (!isSkipped) result.push(loc);
                        }
                    }
                }
            });
            addExact(cat, result);
        };

        const addModule = (cat, zone, start, end, prefix = '-M') => {
            const result = [];
            for (let i = start; i <= end; i++) {
                result.push(`${zone}${prefix}${i}`);
            }
            addExact(cat, result);
        };

        // --- Execute Rules based on lastLayoutPSN.md ---

        // 1. Kitchen
        addShelf('KITCHEN', ['A01', 'A02', 'A03', 'A04']);
        addModule('KITCHEN', 'B1', 1, 15);
        addModule('KITCHEN', 'B2', 1, 7);

        // 2. Storage
        addShelf('STORAGE', ['A11', 'A12']);
        addModule('STORAGE', 'B2', 8, 14);

        // 3. Cleaning/Bath
        addShelf('CLEANING/BATH', ['A05', 'A06']);
        addModule('CLEANING/BATH', 'B3', 1, 14);

        // 4. Stationery
        addShelf('STATIONERY', ['A07', 'A08']);
        addModule('STATIONERY', 'B4', 1, 7);

        // 5. Beauty
        addModule('BEAUTY', 'B4', 8, 14);

        // 6. Fashion
        addShelf('FASHION', ['A09']);
        addModule('FASHION', 'B5', 1, 7);

        // 7. Tool & Tool/Digital
        addShelf('TOOL', ['A10'], ['A10-B1-L1']); // Skips A10-B1-L1-1 to 4
        addModule('TOOL/DIGITAL', 'B5', 8, 14);
        addModule('TOOL/DIGITAL', 'A015', 1, 8);

        // 8. Sports
        addShelf('SPORTS', ['A13']);
        addExact('SPORTS', ['A14-B1-L1-1', 'A14-B1-L1-2', 'A14-B1-L1-3', 'A14-B1-L1-4']);
        addModule('SPORTS', 'B6', 8, 14);

        // 9. Toys
        addModule('TOYS', 'B6', 1, 7);

        // 10. Interior
        addShelf('INTERIOR', ['A14'], ['A14-B1-L1']); // Skips A14-B1-L1-1 to 4 (since it's sports)
        addModule('INTERIOR', 'B7', 1, 7);

        // 11. Floor
        addModule('FLOOR', 'C', 1, 10, '');

        return psnMap;
    })(),

    // ══════════════════════════════════════════════
    // ຕະຫຼາດລາວ — Layout based on TLLNEWMAP.md (updated 2026-03-26)
    // Format: Zone-Level (e.g. A01-1, A01-2, A01-3, A01-4)
    // All zones uniform Level 1-4, no floor-only exceptions
    // ══════════════════════════════════════════════
    'ຕະຫຼາດລາວ': {
        'KITCHEN': [
            // A01-A30: Level 1-4
            { zones: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21', 'A22', 'A23', 'A24', 'A25', 'A26', 'A27', 'A28', 'A29', 'A30'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ K03'], maxLevel: 0, format: 'tll_floor' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'CLEANING': [
            // B01-B10: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10'], maxLevel: 4, format: 'tll_new' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'STORAGE': [
            // C01-C10: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ LO3', 'ໂລພື້ນ N01'], maxLevel: 0, format: 'tll_floor' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'TOOL/DIGITAL': [
            // D01-D10: Level 1-4
            { zones: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'], maxLevel: 4, format: 'tll_new' },
            // Shared floor with FASHION
            { zones: ['ໂລພື້ນ K02'], maxLevel: 0, format: 'tll_floor' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'BEAUTY': [
            // E01-E05: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['E01', 'E02', 'E03', 'E04', 'E05'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ LO2'], maxLevel: 0, format: 'tll_floor' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'TOYS': [
            // F01-F05: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['F01', 'F02', 'F03', 'F04', 'F05'], maxLevel: 4, format: 'tll_new' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'FASHION': [
            // G01-G10: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10'], maxLevel: 4, format: 'tll_new' },
            // Shared floor with DIGITAL
            { zones: ['ໂລພື້ນ K02'], maxLevel: 0, format: 'tll_floor' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'STATIONERY': [
            // H01-H10: Level 1-4
            { zones: ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ K01', 'ໂລພື້ນ LO1'], maxLevel: 0, format: 'tll_floor' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'INTERIOR': [
            // I01-I10: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'I09', 'I10'], maxLevel: 4, format: 'tll_new' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'SPORTS': [
            // J01-J02: Level 1-4 (uniform, updated from TLLNEWMAP.md 2026-03-26)
            { zones: ['J01', 'J02'], maxLevel: 4, format: 'tll_new' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ],
        'FOOD': [
            // J03-J05: Level 1-4
            { zones: ['J03', 'J04', 'J05'], maxLevel: 4, format: 'tll_new' },
            // Temp Storage (All-in-One)
            { zones: ['F1-ໂລຝາກ', 'F2-ໂລຝາກ'], maxLevel: 0, format: 'tll_floor' }
        ]
    },

    // ══════════════════════════════════════════════
    // ວັງຊາຍ — Layout based on MapLayoutVX3.19.2026.md
    // Format: Zone-Level-Section (e.g. A01-L1-1, A01-L2-1)
    // Same tll_shelf format as ສີວິໄລ
    // ══════════════════════════════════════════════
    'ວັງຊາຍ': {
        'KITCHEN': [
            // A01-A06: Level L1-L5, Section 1-4
            { zones: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'], maxLevel: 5, maxSections: 4 }
        ],
        'STATIONARY': [
            // B01-B02: Level L1-L5, Section 1-4
            { zones: ['B01', 'B02'], maxLevel: 5, maxSections: 4 }
        ],
        'STORAGE': [
            // C01-C03: Level L1-L4, Section 1-4
            { zones: ['C01', 'C02', 'C03'], maxLevel: 4, maxSections: 4 },
            // Floor
            { zones: ['ໂລພື້ນ F01'], maxLevel: 0, format: 'tll_floor' }
        ],
        'INTERIOR': [
            // D01-D02: Level L1-L5, Section 1-4
            { zones: ['D01', 'D02'], maxLevel: 5, maxSections: 4 }
        ],
        'TOY': [
            // E01: Level L1-L4, Section 1-4
            { zones: ['E01'], maxLevel: 4, maxSections: 4 }
        ],
        'FASHION': [
            // G01-G02: Level L1-L5, Section 1-4
            { zones: ['G01', 'G02'], maxLevel: 5, maxSections: 4 }
        ],
        'BEAUTY': [
            // H01-H02: Level L1-L5, Section 1-4
            { zones: ['H01', 'H02'], maxLevel: 5, maxSections: 4 }
        ],
        'SPORT': [
            // I01-I02: Level L1-L5, Section 1-4
            { zones: ['I01', 'I02'], maxLevel: 5, maxSections: 4 }
        ],
        'CLEANING': [
            // J01-J03: Level L1-L5, Section 1-4
            { zones: ['J01', 'J02', 'J03'], maxLevel: 5, maxSections: 4 }
        ],
        'TOOL/DIGITAL': [
            { zones: ['K01', 'K02'], maxLevel: 5, maxSections: 4 }
        ]
    },

    // ══════════════════════════════════════════════
    // ເມກ້າມໍ — Layout Placeholder (from megamall racksalefloor.md)
    // Needs proper mapping of Zones (A-I) to Categories
    // ══════════════════════════════════════════════
    'ເມກ້າມໍ': {
        'KITCHEN': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'STATIONERY': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'STORAGE': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'INTERIOR': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'TOY': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'FASHION': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'BEAUTY': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'SPORT': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'CLEANING': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }],
        'TOOL/DIGITAL': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0 }]
    }
};

/**
 * Resolve branch_id variants to match BRANCH_RACK_RULES keys
 * e.g. 'ໂພນສີນວນ A' → 'ໂພນສີນວນ', 'ສີວິໄລ' → 'ສີວິໄລ'
 */
const resolveBranchId = (branchId) => {
    if (!branchId) return 'ສີວິໄລ';

    // Direct match first
    if (BRANCH_RACK_RULES[branchId]) return branchId;

    // Try matching by prefix (e.g. 'ໂພນສີນວນ A' → 'ໂພນສີນວນ')
    const keys = Object.keys(BRANCH_RACK_RULES);
    for (const key of keys) {
        if (branchId.startsWith(key)) return key;
    }

    // Fallback
    return 'ສີວິໄລ';
};

// Export resolve function for use in other modules
export { resolveBranchId };

// Legacy export for backward compatibility (defaults to ສີວິໄລ)
export const CATEGORY_RACK_RULES = BRANCH_RACK_RULES['ສີວິໄລ'];

/**
 * Get rack suggestions for a specific category and branch
 * @param {string} category - Product category (e.g., 'KITCHEN')
 * @param {string} branchId - Branch ID (e.g., 'ສີວິໄລ')
 * @returns {string[]} Array of rack location suggestions
 */
export const getRackSuggestions = (category, branchId) => {
    // Resolve branch name (e.g. 'ໂພນສີນວນ A' → 'ໂພນສີນວນ')
    const resolved = resolveBranchId(branchId);
    const branchRules = BRANCH_RACK_RULES[resolved];
    const rules = branchRules?.[String(category).toUpperCase()];
    if (!rules) return [];

    const suggestions = [];
    rules.forEach(rule => {
        rule.zones.forEach(zone => {
            const format = rule.format || 'legacy';

            switch (format) {
                case 'shelf':
                    // PSN Format: A01-B3-L4-1 (Zone-Bay-Level-Section)
                    for (let bay = 1; bay <= (rule.maxBay || 3); bay++) {
                        for (let level = 1; level <= (rule.maxLevel || 4); level++) {
                            suggestions.push(`${zone}-B${bay}-L${level}-1`);
                        }
                    }
                    break;

                case 'display':
                    // PSN Format: B1-M1, B1-M2, ... (Display-Module)
                    for (let m = 1; m <= (rule.maxModule || 14); m++) {
                        suggestions.push(`${zone}-M${m}`);
                    }
                    break;

                case 'standalone':
                    // PSN Format: M-1, M-2, ... (Standalone Display)
                    for (let m = 1; m <= (rule.maxModule || 8); m++) {
                        suggestions.push(`${zone}-${m}`);
                    }
                    break;

                case 'floor':
                    // PSN Format: C1, C2, ... (Floor Storage)
                    for (let m = 1; m <= (rule.maxModule || 10); m++) {
                        suggestions.push(`${zone}${m}`);
                    }
                    break;

                case 'tll_new':
                    // TLL New Format: A01-1, A01-2, ... (Zone-Level only, no section)
                    if (rule.maxLevel === 0) {
                        suggestions.push(zone);
                    } else {
                        for (let level = 1; level <= (rule.maxLevel || 4); level++) {
                            suggestions.push(`${zone}-${level}`);
                        }
                    }
                    break;

                case 'tll_shelf':
                    // TLL Legacy Format: A01-1-1 (Zone-Level-Section) — kept for backward compat
                    for (let level = 1; level <= (rule.maxLevel || 4); level++) {
                        for (let section = 1; section <= (rule.maxSections || 5); section++) {
                            suggestions.push(`${zone}-${level}-${section}`);
                        }
                    }
                    break;

                case 'tll_floor':
                    // TLL Floor format (e.g. "ໂລພື້ນ K03")
                    suggestions.push(zone);
                    break;

                default:
                    // Legacy SWL Format: G01-L1-1 (Zone-Level-Section)
                    if (rule.maxLevel === 0) {
                        suggestions.push(zone);
                    } else {
                        for (let level = 1; level <= rule.maxLevel; level++) {
                            for (let section = 1; section <= rule.maxSections; section++) {
                                suggestions.push(`${zone}-L${level}-${section}`);
                            }
                        }
                    }
                    break;
            }
        });
    });
    return suggestions;
};

/**
 * Get all available categories for a branch
 * @param {string} branchId - Branch ID
 * @returns {string[]} Array of category names
 */
export const getBranchCategories = (branchId) => {
    const resolved = resolveBranchId(branchId);
    const branchRules = BRANCH_RACK_RULES[resolved];
    return Object.keys(branchRules || {});
};

// Export for other modules that need branch-level access
export { BRANCH_RACK_RULES };
