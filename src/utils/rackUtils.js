
// --- Smart Automation Rules (Per-Branch Rack Layout) ---
// Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)
// Rules are organized by branch_id — each branch has its own layout

const MEGAMALL_ALL_RACKS = ["A01-1","A01-10","A01-2","A01-3","A01-4","A01-5","A01-6","A01-7","A01-8","A01-9","A02-1","A02-10","A02-2","A02-3","A02-4","A02-5","A02-6","A02-7","A02-8","A02-9","A03-1","A03-2","A03-3","A03-4","A03-5","A03-6","A04-+6","A04-1","A04-10","A04-2","A04-3","A04-4","A04-5","A04-7","A04-8","A04-9","A05-1","A05-10","A05-2","A05-3","A05-4","A05-5","A05-6","A05-7","A05-8","A05-9","A06-1","A06-2","A06-3","A06-5","A06-6","A07-1","A07-10","A07-2","A07-3","A07-4","A07-5","A07-6","A07-7","A07-8","A07-9","A08-1","A08-10","A08-2","A08-3","A08-4","A08-5","A08-6","A08-7","A08-8","A08-9","A09-1","A09-2","A09-3","A09-4","A09-5","A09-6","A10-1","A10-10","A10-2","A10-3","A10-4","A10-5","A10-6","A10-7","A10-8","A10-9","A11-1","A11-10","A11-2","A11-3","A11-4","A11-5","A11-6","A11-7","A11-8","A11-9","A12-1","A12-2","A12-3","A12-4","A12-5","A12-6","A13-1","A13-10","A13-2","A13-3","A13-4","A13-5","A13-6","A13-7","A13-8","A13-9","A14-1","A14-10","A14-2","A14-3","A14-4","A14-5","A14-6","A14-7","A14-8","A14-9","A15-1","A15-2","A15-3","A15-4","A15-5","A15-6","A6-4","B01-1","B01-2","B01-3","B01-4","B01-5","B01-6","B02-1","B02-2","B02-3","B02-4","B02-5","B02-6","B03-1","B03-2","B03-3","B03-4","B03-5","B03-6","B04-1","B04-2","B04-3","B04-4","B04-5","B04-6","B05-1","B05-2","B05-3","B05-4","B05-5","B05-6","B06-1","B06-2","B06-3","B06-4","B06-5","B06-6","B07-1","B07-2","B07-3","B07-4","B07-5","B07-6","B08-1","B08-2","B08-3","B08-4","B08-6","B085","B09-1","B09-2","B09-3","B09-4","B09-5","B09-6","C01-1","C01-2","C01-3","C01-4","C01-5","C01-6","C02-1","C02-2","C02-3","C02-4","C02-5","C02-6","C03-1","C03-2","C03-3","C03-4","C03-5","C03-6","C04-1","C04-2","C04-3","C04-4","C04-5","C04-6","C05-1","C05-2","C05-3","C05-4","C05-5","C05-6","C06-1","C06-2","C06-3","C06-4","C06-5","C06-6","C07-1","C07-2","C07-3","C07-4","C07-5","C07-6","C08-1","C08-2","C08-3","C08-4","C08-5","C08-6","C09-1","C09-2","C09-3","C09-4","C09-5","C09-6","D01-1","D01-2","D01-3","D01-4","D01-5","D01-6","D01-7","D01-8","D02-1","D02-2","D02-3","D02-4","D02-5","D02-6","D02-7","D02-8","D03-1","D03-2","D03-3","D03-4","D03-5","D03-6","D03-7","D03-8","E01-1","E01-2","E01-3","E01-4","E01-5","E01-6","E02-1","E02-10","E02-2","E02-3","E02-4","E02-5","E02-6","E02-7","E02-8","E02-9","E03-1","E03-10","E03-2","E03-3","E03-4","E03-5","E03-6","E03-7","E03-8","E03-9","E04-1","E04-10","E04-2","E04-3","E04-4","E04-5","E04-6","E04-7","E04-8","E04-9","E05-1","E05-10","E05-2","E05-3","E05-4","E05-5","E05-6","E05-7","E05-8","E05-9","E06-1","E06-10","E06-2","E06-3","E06-4","E06-5","E06-6","E06-7","E06-8","E06-9","E07-1","E07-10","E07-2","E07-3","E07-4","E07-5","E07-6","E07-7","E07-8","E07-9","F01-1","F01-2","F01-3","F01-4","F01-5","F01-6","F01-7","F01-8","F02-1","F02-2","F02-3","F02-4","F02-5","F02-6","F02-7","F02-8","F03-1","F03-2","F03-3","F03-4","F03-5","F03-6","F03-7","F03-8","F04-1","F04-2","F04-3","F04-4","F04-5","F04-6","F04-7","F04-8","F05-1","F05-2","F05-3","F05-4","F05-5","F05-6","F05-7","F05-8","F06-1","F06-2","F06-3","F06-4","F06-5","F06-6","F06-7","F06-8","F07-1","F07-2","F07-3","F07-4","F07-5","F07-6","F07-7","F07-8","F08-1","F08-2","F08-3","F08-4","F08-5","F08-6","F08-7","F08-8","F09-1","F09-2","F09-3","F09-4","F09-5","F09-6","F09-7","F09-8","G01","G02","G03","G04","G05","G06","G07","G08","G09","G10","G11","G12","G13","G14","G15","G16","G17","G18","H01","H02","H03","H04","H05","H06","H07","H08","H09","H10","I1","I2","I3","I4","I5"];


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
