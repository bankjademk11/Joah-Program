
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
            // G09-ໂລພື້ນ = floor zone (Cat Kitchen)
            { zones: ['G09-ໂລພື້ນ'], maxLevel: 0, maxSections: 0 },
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
    // ຕະຫຼາດລາວ — Layout based on Map Layout (TLL).md (updated 2026-03-19 v2)
    // Format: Zone-Level (e.g. A01-1, A01-2, A01-3, A01-4)
    // Special: B01/B06/J01 = floor zone + levels 2-4, C01-C07 = floor-only
    //          D01 starts at level 2, E01/F01/G01/G06/I01/I06 = floor-only
    // ══════════════════════════════════════════════
    'ຕະຫຼາດລາວ': {
        'KITCHEN': [
            // A01-A30: Level 1-4
            { zones: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21', 'A22', 'A23', 'A24', 'A25', 'A26', 'A27', 'A28', 'A29', 'A30'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ K03'], maxLevel: 0, format: 'tll_floor' }
        ],
        'CLEANING': [
            // B01, B06: standalone floor zones (no -1 suffix, level 1 = zone name only)
            { zones: ['B01', 'B06'], maxLevel: 0, format: 'tll_floor' },
            // B01-B03: Level 1-4 (B01 level 1 = "B01" floor above, B01-2~4 valid)
            { zones: ['B01', 'B02', 'B03'], maxLevel: 4, format: 'tll_new' },
            // B04: Level 1-5 (special case)
            { zones: ['B04'], maxLevel: 5, format: 'tll_new' },
            // B06-B10: Level 1-4 (B06 level 1 = "B06" floor above, B06-2~4 valid)
            { zones: ['B06', 'B07', 'B08', 'B09', 'B10'], maxLevel: 4, format: 'tll_new' }
        ],
        'STORAGE': [
            // C01-C07: floor-only zones (no levels)
            { zones: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'], maxLevel: 0, format: 'tll_floor' },
            // C08-C10: Level 1-4
            { zones: ['C08', 'C09', 'C10'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ LO3', 'ໂລພື້ນ N01'], maxLevel: 0, format: 'tll_floor' }
        ],
        'TOOL/DIGITAL': [
            // D01-D10: Level 1-4 (D01 starts at level 2 in practice)
            { zones: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'], maxLevel: 4, format: 'tll_new' },
            // Shared floor with FASHION
            { zones: ['ໂລພື້ນ K02'], maxLevel: 0, format: 'tll_floor' }
        ],
        'BEAUTY': [
            // E01: floor-only zone
            { zones: ['E01'], maxLevel: 0, format: 'tll_floor' },
            // E02-E05: Level 1-4
            { zones: ['E02', 'E03', 'E04', 'E05'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ LO2'], maxLevel: 0, format: 'tll_floor' }
        ],
        'TOYS': [
            // F01: floor-only zone
            { zones: ['F01'], maxLevel: 0, format: 'tll_floor' },
            // F02-F05: Level 1-4
            { zones: ['F02', 'F03', 'F04', 'F05'], maxLevel: 4, format: 'tll_new' }
        ],
        'FASHION': [
            // G01, G06: floor-only zones
            { zones: ['G01', 'G06'], maxLevel: 0, format: 'tll_floor' },
            // G02-G05: Level 1-4
            { zones: ['G02', 'G03', 'G04', 'G05'], maxLevel: 4, format: 'tll_new' },
            // G07-G10: Level 1-4
            { zones: ['G07', 'G08', 'G09', 'G10'], maxLevel: 4, format: 'tll_new' },
            // Shared floor with DIGITAL
            { zones: ['ໂລພື້ນ K02'], maxLevel: 0, format: 'tll_floor' }
        ],
        'STATIONERY': [
            // H01-H10: Level 1-4
            { zones: ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10'], maxLevel: 4, format: 'tll_new' },
            // Floor
            { zones: ['ໂລພື້ນ K01', 'ໂລພື້ນ LO1'], maxLevel: 0, format: 'tll_floor' }
        ],
        'INTERIOR': [
            // I01, I06: floor-only zones
            { zones: ['I01', 'I06'], maxLevel: 0, format: 'tll_floor' },
            // I02-I05: Level 1-4
            { zones: ['I02', 'I03', 'I04', 'I05'], maxLevel: 4, format: 'tll_new' },
            // I07-I10: Level 1-4
            { zones: ['I07', 'I08', 'I09', 'I10'], maxLevel: 4, format: 'tll_new' }
        ],
        'SPORTS': [
            // J01: floor-only (J01 itself valid), plus J01-2~4
            { zones: ['J01'], maxLevel: 0, format: 'tll_floor' },
            { zones: ['J01', 'J02'], maxLevel: 4, format: 'tll_new' }
        ],
        'FOOD': [
            // J03-J05: Level 1-4
            { zones: ['J03', 'J04', 'J05'], maxLevel: 4, format: 'tll_new' }
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
            { zones: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'STATIONARY': [
            // B01-B02: Level L1-L5, Section 1-4
            { zones: ['B01', 'B02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'STORAGE': [
            // C01-C03: Level L1-L4, Section 1-4
            { zones: ['C01', 'C02', 'C03'], maxLevel: 4, maxSection: 4, format: 'tll_shelf' },
            // Floor
            { zones: ['ໂລພື້ນ F01'], maxLevel: 0, format: 'tll_floor' }
        ],
        'INTERIOR': [
            // D01-D02: Level L1-L5, Section 1-4
            { zones: ['D01', 'D02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'TOY': [
            // E01: Level L1-L4, Section 1-4
            { zones: ['E01'], maxLevel: 4, maxSection: 4, format: 'tll_shelf' }
        ],
        'FASHION': [
            // G01-G02: Level L1-L5, Section 1-4
            { zones: ['G01', 'G02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'BEAUTY': [
            // H01-H02: Level L1-L5, Section 1-4
            { zones: ['H01', 'H02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'SPORT': [
            // I01-I02: Level L1-L5, Section 1-4
            { zones: ['I01', 'I02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'CLEANING': [
            // J01-J02: Level L1-L5, Section 1-4
            { zones: ['J01', 'J02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ],
        'TOOL/DIGITAL': [
            // K01-K02: Level L1-L5, Section 1-4
            { zones: ['K01', 'K02'], maxLevel: 5, maxSection: 4, format: 'tll_shelf' }
        ]
    },
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
