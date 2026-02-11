
// --- Smart Automation Rules (Mapdata.MD - NEW FORMAT with Section Numbers) ---
// Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)
export const CATEGORY_RACK_RULES = {
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
};

export const getRackSuggestions = (category) => {
    const rules = CATEGORY_RACK_RULES[String(category).toUpperCase()];
    if (!rules) return [];

    const suggestions = [];
    rules.forEach(rule => {
        rule.zones.forEach(zone => {
            if (rule.maxLevel === 0) {
                // Floor storage - no level/section
                suggestions.push(zone);
            } else {
                // Generate ZONE-LEVEL-SECTION format (e.g., G01-L1-1, G01-L1-2)
                for (let level = 1; level <= rule.maxLevel; level++) {
                    for (let section = 1; section <= rule.maxSections; section++) {
                        suggestions.push(`${zone}-L${level}-${section}`);
                    }
                }
            }
        });
    });
    return suggestions;
};
