
// --- Smart Automation Rules (Per-Branch Rack Layout) ---
// Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)
// Rules are organized by branch_id — each branch has its own layout

const BRANCH_RACK_RULES = {
    // ══════════════════════════════════════════════
    // ສີວິໄລ — Rack Layout (from MapLayoutSVL.md — updated 2026-03-12)
    // ══════════════════════════════════════════════
    'ສີວິໄລ': {
        'KITCHEN': [
            // G01-G16 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16'], maxLevel: 5, maxSections: 4 },
            // G10 = rack shelves (Level 1-5, Section 1-3 — ไม่มี section 4 ตาม file)
            { zones: ['G10'], maxLevel: 5, maxSections: 3 },
            // G17, G18 = rack shelves (Level 1-5, Section 1-4)
            { zones: ['G17', 'G18'], maxLevel: 5, maxSections: 4 },
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
            { zones: ['A01', 'A02', 'A03'], maxLevel: 5, maxSections: 4 },
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
            { zones: ['D08', 'D09'], maxLevel: 0, maxSections: 0 },
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
    'ໂພນສີນວນ': {
        'KITCHEN': [
            { zones: ['A01', 'A02', 'A03', 'A04'], maxBay: 3, maxLevel: 4, format: 'shelf' },
            { zones: ['B1'], maxModule: 14, format: 'display' }
        ],
        'KITCHEN-STORAGE': [
            { zones: ['B2'], maxModule: 14, format: 'display' }
        ],
        'CLEANING/BATH': [
            { zones: ['A05', 'A06'], maxBay: 3, maxLevel: 4, format: 'shelf' },
            { zones: ['B3'], maxModule: 14, format: 'display' }
        ],
        'STATIONERY': [
            { zones: ['A07', 'A08'], maxBay: 3, maxLevel: 4, format: 'shelf' },
            { zones: ['B4'], maxModule: 14, format: 'display', moduleCategory: { 1: 'Stationery', 9: 'Beauty' } }
        ],
        'FASHION&BEAUTY': [
            { zones: ['A09'], maxBay: 3, maxLevel: 4, format: 'shelf' },
            { zones: ['B5'], maxModule: 14, format: 'display' }
        ],
        'INTERIOR&TOOL': [
            { zones: ['A010'], maxBay: 3, maxLevel: 4, format: 'shelf' }
        ],
        'STORAGE': [
            { zones: ['A011', 'A012'], maxBay: 3, maxLevel: 4, format: 'shelf' }
        ],
        'SPORTS': [
            { zones: ['A013'], maxBay: 3, maxLevel: 4, format: 'shelf' },
            { zones: ['B6'], maxModule: 14, format: 'display', moduleCategory: { 1: 'Toy', 9: 'Sport' } }
        ],
        'TOYS': [
            { zones: ['A014'], maxBay: 3, maxLevel: 4, format: 'shelf' }
        ],
        'TOOL/DIGITAL': [
            { zones: ['A015'], maxModule: 8, format: 'display' },
            { zones: ['B7'], maxModule: 7, format: 'display' }
        ],
        'FLOOR': [
            { zones: ['C'], maxModule: 10, format: 'floor' }
        ]
    },

    // ══════════════════════════════════════════════
    // ຕະຫຼາດລາວ — Layout based on MapLayoutTLL.md
    // Format is mainly: Zone-Level-Section (e.g. A01-1-1, B02-2-5)
    // Note: Level is 1-4, Section is 1-5 consistently across most zones
    // ══════════════════════════════════════════════
    'ຕະຫຼາດລາວ': {
        'KITCHEN': [
            // A01 to A30: Level 1-4, Sections 1-5
            { zones: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21', 'A22', 'A23', 'A24', 'A25', 'A26', 'A27', 'A28', 'A29', 'A30'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' },
            // Floor sections
            { zones: ['ໂລພື້ນ K03'], maxLevel: 0, maxSections: 0, format: 'tll_floor' }
        ],
        'CLEANING': [
            // B01 to B10 (No B05): Level 1-4, Sections 1-5
            { zones: ['B01', 'B02', 'B03', 'B04', 'B06', 'B07', 'B08', 'B09', 'B10'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' }
        ],
        'STORAGE': [
            // C01 to C10: Level 1-4, Sections 1-5
            { zones: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' },
            // Floor sections
            { zones: ['ໂລພື້ນ LO3', 'ໂລພື້ນ N01'], maxLevel: 0, maxSections: 0, format: 'tll_floor' }
        ],
        'TOOL/DIGITAL': [
            // D01 to D10: Level 1-4, Sections 1-5
            { zones: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' }
        ],
        'BEAUTY': [
            // E01 to E05: Level 1-4, Sections 1-5
            { zones: ['E01', 'E02', 'E03', 'E04', 'E05'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' },
            // Floor sections
            { zones: ['ໂລພື້ນ LO2'], maxLevel: 0, maxSections: 0, format: 'tll_floor' }
        ],
        'TOYS': [
            // F01 to F05: Level 1-4, Sections 1-5
            { zones: ['F01', 'F02', 'F03', 'F04', 'F05'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' }
        ],
        'FASHION': [
            // G01 to G10: Level 1-4, Sections 1-5
            { zones: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' },
            // Floor sections (Note: K02 is shared with digital, map to fashion here)
            { zones: ['ໂລພື້ນ K02'], maxLevel: 0, maxSections: 0, format: 'tll_floor' }
        ],
        'STATIONERY': [
            // H01 to H10: Level 1-4, Sections 1-5
            { zones: ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' },
            // Floor sections
            { zones: ['ໂລພື້ນ K01', 'ໂລພື້ນ LO1'], maxLevel: 0, maxSections: 0, format: 'tll_floor' }
        ],
        'INTERIOR': [
            // I01 to I10: Level 1-4, Sections 1-5
            { zones: ['I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'I09', 'I10'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' }
        ],
        'SPORTS': [
            // J01 to J02: Level 1-4, Sections 1-5
            { zones: ['J01', 'J02'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' }
        ],
        'FOOD': [
            // J03 to J05: Level 1-4, Sections 1-5
            { zones: ['J03', 'J04', 'J05'], maxLevel: 4, maxSections: 5, format: 'tll_shelf' }
        ]
    },

    // ══════════════════════════════════════════════
    // ວັງຊາຍ — (ຍັງບໍ່ມີ Data, ຈະເພີ່ມທີຫຼັງ)
    // ══════════════════════════════════════════════
    // 'ວັງຊາຍ': { ... },
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

                case 'tll_shelf':
                    // TLL Format: A01-1-1 (Zone-Level-Section)
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
