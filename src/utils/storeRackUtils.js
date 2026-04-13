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
    },
    'ສີວິໄລ': {
        'INTERIOR': [
            { zones: ['SFE02-1', 'SFE02-2', 'SFE02-3', 'SFE02-4', 'SFE02-5', 'SFE02-6', 'SFE02-7', 'SFE03-1', 'SFE03-2', 'SFE03-3', 'SFE03-4', 'SFE03-5', 'SFE03-6', 'SFE03-7', 'SFD02-1', 'SFD02-2', 'SFD02-3', 'SFD02-4', 'SFD02-5', 'SFD02-6', 'SFD02-7', 'SFD02-8', 'SFD02-9', 'SFD02-10', 'SFP25', 'SFP04'], maxLevel: 0, format: 'store_exact' }
        ],
        'STORAGE': [
            { zones: ['SFE03-8', 'SFE03-9', 'SFE03-10', 'SFE03-11', 'SFC04-1', 'SFC04-2', 'SFC04-3', 'SFC04-4', 'SFC04-5', 'SFC04-6', 'SFC04-7', 'SFC04-8', 'SFC04-9', 'SFC04-10', 'SFC03-1', 'SFC03-2', 'SFC03-3', 'SFC03-4', 'SFC03-5', 'SFC03-6', 'SFC03-7', 'SFC03-8', 'SFC03-9', 'SFC03-10', 'SFP13', 'SFP14', 'SFP15', 'SFP16', 'SFE04-4', 'SFE04-5', 'SFE04-6', 'SFP22', 'SFP23', 'SFP11', 'SFP12'], maxLevel: 0, format: 'store_exact' }
        ],
        'KITCHEN': [
            { zones: ['SFB07-1', 'SFB07-2', 'SFB07-3', 'SFB07-4', 'SFB07-5', 'SFB07-6', 'SFB07-7', 'SFB07-8', 'SFB07-9', 'SFB07-10', 'SFB06-1', 'SFB06-2', 'SFB06-3', 'SFB06-4', 'SFB06-5', 'SFB06-6', 'SFB06-7', 'SFB06-8', 'SFB06-9', 'SFB06-10', 'SFB05-1', 'SFB05-2', 'SFB05-3', 'SFB05-4', 'SFB05-5', 'SFB05-6', 'SFB05-7', 'SFB05-8', 'SFB05-9', 'SFB05-10', 'SFB04-1', 'SFB04-2', 'SFB04-3', 'SFB04-4', 'SFB04-5', 'SFB04-6', 'SFB04-7', 'SFB04-8', 'SFB04-9', 'SFB04-10', 'SFB01-1', 'SFB01-2', 'SFB01-3', 'SFB01-4', 'SFB01-5', 'SFB01-6', 'SFB01-7', 'SFB01-8', 'SFB01-9', 'SFB01-10', 'SFP01', 'SFP06', 'SFE04-7', 'SFE04-8', 'SFE04-9', 'SFE04-10', 'SFE04-11', 'SFE04-12', 'SFE04-13', 'SFE04-14', 'SFE04-15', 'SFE04-16', 'SFE04-17', 'SFE04-18', 'SFE04-19', 'SFE04-20', 'SFE04-21', 'SFE04-22', 'SFE04-23', 'SFE04-24', 'SFE04-25'], maxLevel: 0, format: 'store_exact' }
        ],
        'CLEANING': [
            { zones: ['SFC02-1', 'SFC02-2', 'SFC02-3', 'SFC02-4', 'SFC02-5', 'SFC02-6', 'SFC02-7', 'SFC02-8', 'SFC02-9', 'SFC02-10', 'SFC01-1', 'SFC01-2', 'SFC01-3', 'SFC01-4', 'SFC01-5', 'SFC01-6', 'SFC01-7', 'SFC01-8', 'SFC01-9', 'SFC01-10', 'SFE04-1', 'SFE04-2', 'SFE04-3'], maxLevel: 0, format: 'store_exact' }
        ],
        'STATIONERY': [
            { zones: ['SFE01-1', 'SFE01-2', 'SFE01-3', 'SFE01-4', 'SFE01-5', 'SFE01-6', 'SFE01-7', 'SFD04-1', 'SFD04-2', 'SFD04-3', 'SFD04-4', 'SFD04-5', 'SFD04-6', 'SFD04-7', 'SFD04-8', 'SFD03-1', 'SFD03-2', 'SFD03-3', 'SFD03-4', 'SFD03-5', 'SFD03-6', 'SFD03-7', 'SFD03-8', 'SFD03-9', 'SFD03-10', 'SFA07-1', 'SFA07-2', 'SFA07-3', 'SFA07-4', 'SFA07-5', 'SFA07-6', 'SFA07-7', 'SFA07-8'], maxLevel: 0, format: 'store_exact' }
        ],
        'TOYS': [
            { zones: ['SFA05-1', 'SFA05-2', 'SFA05-3', 'SFA05-4', 'SFA05-5', 'SFA05-6', 'SFA05-7', 'SFA05-8', 'SFE04-32', 'SFP08', 'SFP07', 'SFA01-5', 'SFA01-4'], maxLevel: 0, format: 'store_exact' }
        ],
        'SPORTS': [
            { zones: ['SFP24', 'SFA06-1', 'SFA06-2', 'SFA06-3', 'SFA06-4', 'SFA06-5', 'SFA06-6', 'SFA06-7', 'SFA06-8'], maxLevel: 0, format: 'store_exact' }
        ],
        'FASHION': [
            { zones: ['SFA03-1', 'SFA03-2', 'SFA03-3', 'SFA03-4', 'SFA03-5', 'SFA03-6', 'SFA03-7', 'SFA03-8', 'SFE04-26', 'SFE04-27', 'SFE04-28', 'SFE04-29', 'SFE04-30', 'SFE04-31', 'SFA01-1', 'SFA01-6'], maxLevel: 0, format: 'store_exact' }
        ],
        'BEAUTY': [
            { zones: ['SFA04-1', 'SFA04-2', 'SFA04-3', 'SFA04-4', 'SFA04-5', 'SFA04-6', 'SFA04-7', 'SFA04-8', 'SFA02-1', 'SFA02-2', 'SFA02-3', 'SFA02-4', 'SFA02-5', 'SFA02-6', 'SFA02-7', 'SFA02-8', 'SFP05'], maxLevel: 0, format: 'store_exact' }
        ],
        'TOOL/DIGITAL': [
            { zones: ['SFD01-1', 'SFD01-2', 'SFD01-3', 'SFD01-4', 'SFD01-5', 'SFD01-6', 'SFD01-7', 'SFD01-8', 'SFD01-9', 'SFD01-10', 'SFB03-1', 'SFB03-2', 'SFB03-3', 'SFB03-4', 'SFB03-5', 'SFB03-6', 'SFB03-7', 'SFB03-8', 'SFB03-9', 'SFB03-10', 'SFB02-1', 'SFB02-2', 'SFB02-3', 'SFB02-4', 'SFB02-5', 'SFB02-6', 'SFB02-7', 'SFB02-8', 'SFB02-9', 'SFB02-10', 'SFP02', 'SFP03', 'SFP09', 'SFP10'], maxLevel: 0, format: 'store_exact' }
        ],
        'EVENT': [
            { zones: ['SFP21', 'SFP17', 'SFP18', 'SFP19', 'SFP20', 'SFA01-2', 'SFA01-3'], maxLevel: 0, format: 'store_exact' }
        ]
    }
};

/**
 * Resolve branch_id variants to match STORE_BRANCH_RACK_RULES keys
 * e.g. 'ໂພນສີນວນ A' → 'ໂພນສີນວນ', 'ຕະຫຼາດລາວ' → 'ຕະຫຼາດລາວ'
 */
const resolveStoreBranchId = (branchId) => {
    if (!branchId) return 'ຕະຫຼາດລາວ';

    const normalizedId = String(branchId).toUpperCase().trim();
    
    // Map shortcodes or variations
    if (normalizedId === 'SVL' || normalizedId.includes('ສີວິໄລ')) return 'ສີວິໄລ';
    if (normalizedId === 'TLL' || normalizedId.includes('ຕະຫຼາດລາວ')) return 'ຕະຫຼາດລາວ';

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
