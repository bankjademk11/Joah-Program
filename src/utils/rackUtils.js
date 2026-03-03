
// --- Smart Automation Rules (Per-Branch Rack Layout) ---
// Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)
// Rules are organized by branch_id — each branch has its own layout

const BRANCH_RACK_RULES = {
    // ══════════════════════════════════════════════
    // ສີວິໄລ — Rack Layout (from Mapdata.MD)
    // ══════════════════════════════════════════════
    'ສີວິໄລ': {
        'KITCHEN': [
            { zones: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'H02', 'H03', 'H04'], maxLevel: 5, maxSections: 4 },
            { zones: ['ໂລພື້ນ G9', 'ໂລພື້ນ G10', 'ໂລພື້ນ G11'], maxLevel: 0, maxSections: 0 }
        ],
        'BEAUTY': [
            { zones: ['E01', 'E02', 'E03', 'E04'], maxLevel: 5, maxSections: 4 },
            { zones: ['ໂລພື້ນE 5', 'ໂລພື້ນE 7', 'ໂລພື້ນE 8'], maxLevel: 0, maxSections: 0 }
        ],
        'STATIONERY': [
            { zones: ['S01', 'S02', 'S03', 'S05', 'S06', 'S07', 'S08'], maxLevel: 5, maxSections: 4 },
            { zones: ['S10'], maxLevel: 4, maxSections: 4 }
        ],
        'TOYS': [
            { zones: ['S09'], maxLevel: 5, maxSections: 4 }
        ],
        'CLEANING/BATH': [
            { zones: ['A01', 'A02', 'A03', 'A05'], maxLevel: 5, maxSections: 4 },
            { zones: ['A04'], maxLevel: 6, maxSections: 4 }
        ],
        'INTERIOR': [
            { zones: ['B01'], maxLevel: 3, maxSections: 4 },
            { zones: ['B02', 'B03', 'B04'], maxLevel: 4, maxSections: 4 }
        ],
        'TOOL/DIGITAL': [
            { zones: ['F01', 'F02', 'F03', 'F04'], maxLevel: 5, maxSections: 5 }
        ],
        'STORAGE': [
            { zones: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'], maxLevel: 5, maxSections: 4 },
            { zones: ['ໂລພື້ນ D07', 'ໂລພື້ນ D08'], maxLevel: 0, maxSections: 0 }
        ],
        'FASHION': [
            { zones: ['C01', 'C02', 'C03', 'C04'], maxLevel: 5, maxSections: 4 }
        ],
        'SPORTS/LEISURE': [
            { zones: ['H01'], maxLevel: 5, maxSections: 4 }
        ],
        'SEASONAL': [
            { zones: ['I01', 'I02', 'I03'], maxLevel: 4, maxSections: 4 }
        ],
        'DISPOSABLE': [
            { zones: ['J01', 'J02'], maxLevel: 4, maxSections: 4 }
        ],
        'PET': [
            { zones: ['K01', 'K02'], maxLevel: 4, maxSections: 4 }
        ],
        'GARDENING': [
            { zones: ['L01'], maxLevel: 3, maxSections: 4 }
        ]
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
    // ຕະຫຼາດລາວ — (ຍັງບໍ່ມີ Data, ຈະເພີ່ມທີຫຼັງ)
    // ══════════════════════════════════════════════
    // 'ຕະຫຼາດລາວ': { ... },

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
