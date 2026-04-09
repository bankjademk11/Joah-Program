// ============================================================================
// STORE INVENTORY RULES (ໜ້າຮ້ານ)
// ============================================================================

export const STORE_BRANCH_RACK_RULES = {
    'ຕະຫຼາດລາວ': {
        'INTERIOR': [
            { zones: ['TFD-01', 'TFD-02', 'TFD-03', 'TFA01-01', 'TFA01-02', 'TFA01-03', 'TFA01-04', 'TFA01-05', 'TFA02-01', 'TFA02-02', 'TFA02-03', 'TFA02-04', 'TFA02-05', 'TFA02-06', 'TFA02-07', 'TFA02-08', 'TFA02-09', 'TFA02-10'], maxLevel: 0, format: 'store_exact' }
        ],
        'STORAGE': [
            { zones: ['TFD-04', 'TFD-05', 'TFD-06', 'TFD-07', 'TFD-08', 'TFA04-01', 'TFA04-02', 'TFA04-03', 'TFA04-04', 'TFA04-05', 'TFA04-06'], maxLevel: 0, format: 'store_exact' }
        ],
        'KITCHEN': [
            { zones: ['TFD-09', 'TFD-10', 'TFD-11', 'TFD-12', 'TFD-13', 'TFD-14', 'TFA05-01', 'TFA05-02', 'TFA05-03', 'TFA05-04', 'TFA05-05', 'TFA05-06', 'TFA05-07', 'TFA05-08', 'TFA05-09', 'TFA06-01', 'TFA06-02', 'TFA06-03', 'TFA06-04', 'TFA06-05', 'TFA06-06', 'TFA06-07', 'TFA06-08', 'TFA06-09', 'TFA06-10', 'TFA07-01', 'TFA07-02', 'TFA07-03', 'TFA07-04', 'TFA07-05', 'TFA07-06', 'TFA07-07', 'TFA07-08', 'TFA07-09', 'TFA07-10', 'TFB02-01', 'TFB02-02', 'TFB02-03', 'TFB02-04', 'TFB02-05', 'TFB02-06', 'TFB02-07', 'TFB02-08', 'TFB03-01', 'TFB03-02', 'TFB03-03', 'TFB03-04', 'TFB03-05', 'TFB03-06', 'TFB03-07', 'TFB03-08', 'TFB05-01', 'TFB05-02', 'TFB05-03', 'TFB05-04', 'TFB05-05', 'TFB05-06', 'TFB05-07', 'TFB05-08', 'TFB06-01', 'TFB06-02', 'TFB06-03', 'TFB06-04', 'TFB06-05', 'TFB06-06', 'TFB06-07', 'TFB06-08'], maxLevel: 0, format: 'store_exact' }
        ],
        'CLEANING': [
            { zones: ['TFD-15', 'TFD-16', 'TFD-17', 'TFA08-01', 'TFA08-02', 'TFA08-03', 'TFA08-04', 'TFA08-05', 'TFA08-06', 'TFA08-07', 'TFA08-08', 'TFA08-09', 'TFA08-10', 'TFA09-01', 'TFA09-02', 'TFA09-03', 'TFA09-04', 'TFA09-05', 'TFA09-06', 'TFA09-07', 'TFA09-08', 'TFA09-09'], maxLevel: 0, format: 'store_exact' }
        ],
        'STATIONERY': [
            { zones: ['TFE-01', 'TFE-02', 'TFE-03', 'TFE-04', 'TFE-05', 'TFA01-06', 'TFA01-07', 'TFA01-08', 'TFA01-09'], maxLevel: 0, format: 'store_exact' }
        ],
        'TOYS': [
            { zones: ['TFE-06', 'TFE-07', 'TFE-08', 'TFE-09', 'TFE-10', 'TFC01-05', 'TFC01-06'], maxLevel: 0, format: 'store_exact' }
        ],
        'FASHION': [
            { zones: ['TFA03-01', 'TFA03-02', 'TFA03-03', 'TFA03-04', 'TFA03-05', 'TFA03-06', 'TFA03-07', 'TFA03-08', 'TFA03-09', 'TFA03-10', 'TFA04-07', 'TFA04-08', 'TFA04-09', 'TFA04-10', 'TFB01-01', 'TFB01-02', 'TFB01-03', 'TFB01-04', 'TFB01-05', 'TFB01-06', 'TFB01-07', 'TFB01-08', 'TFB04-01', 'TFB04-02', 'TFB04-03', 'TFB04-04', 'TFB04-05', 'TFB04-06', 'TFB04-07', 'TFB04-08', 'TFE-11', 'TFE-12', 'TFE-13'], maxLevel: 0, format: 'store_exact' }
        ],
        'BEAUTY': [
            { zones: ['TFC01-01', 'TFC01-02', 'TFC01-03', 'TFC01-04', 'TFC02-01', 'TFC02-02', 'TFC02-03', 'TFC02-04', 'TFC02-05', 'TFC02-06', 'TFC03-01', 'TFC03-02', 'TFC03-03', 'TFC03-04', 'TFC03-05', 'TFC03-06'], maxLevel: 0, format: 'store_exact' }
        ],
        'TOOL/DIGITAL': [
            { zones: ['TFB07-01', 'TFB07-02', 'TFB07-03', 'TFB07-04', 'TFB07-05', 'TFB07-06', 'TFB07-07', 'TFB07-08', 'TFB08-01', 'TFB08-02', 'TFB08-03', 'TFB08-04', 'TFB08-05', 'TFB08-06', 'TFB08-07', 'TFB08-08', 'TFB09-01', 'TFB09-02', 'TFB09-03', 'TFB09-04', 'TFB09-05', 'TFB09-06', 'TFB09-07', 'TFB09-08'], maxLevel: 0, format: 'store_exact' }
        ],
        'EVENT': [
            { zones: ['TFF01', 'TFF02', 'TFF03', 'TFH01', 'TFG01', 'TFG02', 'TFG03', 'TFI01', 'TFI02'], maxLevel: 0, format: 'store_exact' }
        ]
    }
};

/**
 * Resolve branch_id variants to match STORE_BRANCH_RACK_RULES keys
 * e.g. 'ໂພນສີນວນ A' → 'ໂພນສີນວນ', 'ຕະຫຼາດລາວ' → 'ຕະຫຼາດລາວ'
 */
const resolveStoreBranchId = (branchId) => {
    if (!branchId) return 'ຕະຫຼາດລາວ';

    // Direct match first
    if (STORE_BRANCH_RACK_RULES[branchId]) return branchId;

    // Try matching by prefix
    const keys = Object.keys(STORE_BRANCH_RACK_RULES);
    for (const key of keys) {
        if (branchId.startsWith(key)) return key;
    }

    // Fallback
    return 'ຕະຫຼາດລາວ';
};

export const getStoreBranchCategories = (branchId) => {
    const resolved = resolveStoreBranchId(branchId);
    const rules = STORE_BRANCH_RACK_RULES[resolved];
    return rules ? Object.keys(rules) : [];
};

export const getStoreRackSuggestions = (category, branchId) => {
    const resolved = resolveStoreBranchId(branchId);
    const branchRules = STORE_BRANCH_RACK_RULES[resolved];
    const rules = branchRules?.[String(category).toUpperCase()];
    if (!rules) return [];

    const suggestions = [];
    rules.forEach(rule => {
        if (rule.format === 'store_exact') {
            suggestions.push(...rule.zones);
        } else {
            rule.zones.forEach(zone => {
                suggestions.push(zone); // fallback if custom logic is needed later
            });
        }
    });
    return suggestions;
};

/**
 * Validate if a rack is correct for a given category
 */
export const validateStoreRack = (rack, category, branchId) => {
    if (!rack || !category) return false;
    const suggestions = getStoreRackSuggestions(category, branchId);
    return suggestions.includes(String(rack).trim());
};
