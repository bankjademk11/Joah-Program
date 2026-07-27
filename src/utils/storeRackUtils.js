// ============================================================================
// STORE INVENTORY RULES (ໜ້າຮ້ານ)
// ============================================================================

const MEGAMALL_ALL_RACKS = ["MFA01-1","MFA01-10","MFA01-2","MFA01-3","MFA01-4","MFA01-5","MFA01-6","MFA01-7","MFA01-8","MFA01-9","MFA02-1","MFA02-2","MFA02-3","MFA02-4","MFA02-5","MFA02-6","MFA03-1","MFA03-10","MFA03-2","MFA03-3","MFA03-4","MFA03-5","MFA03-6","MFA03-7","MFA03-8","MFA03-9","MFA04-1","MFA04-10","MFA04-2","MFA04-3","MFA04-4","MFA04-5","MFA04-6","MFA04-7","MFA04-8","MFA04-9","MFA05-1","MFA05-2","MFA05-3","MFA05-4","MFA05-5","MFA05-6","MFA06-1","MFA06-10","MFA06-2","MFA06-3","MFA06-4","MFA06-5","MFA06-6","MFA06-7","MFA06-8","MFA06-9","MFA07-1","MFA07-10","MFA07-2","MFA07-3","MFA07-4","MFA07-5","MFA07-6","MFA07-7","MFA07-8","MFA07-9","MFA08-1","MFA08-2","MFA08-3","MFA08-4","MFA08-5","MFA08-6","MFA09-1","MFA09-10","MFA09-2","MFA09-3","MFA09-4","MFA09-5","MFA09-6","MFA09-7","MFA09-8","MFA09-9","MFA10-1","MFA10-10","MFA10-2","MFA10-3","MFA10-4","MFA10-5","MFA10-6","MFA10-7","MFA10-8","MFA10-9","MFA11-1","MFA11-2","MFA11-3","MFA11-4","MFA11-5","MFA11-6","MFA12-1","MFA12-10","MFA12-2","MFA12-3","MFA12-4","MFA12-5","MFA12-6","MFA12-7","MFA12-8","MFA12-9","MFA13-1","MFA13-10","MFA13-2","MFA13-3","MFA13-4","MFA13-5","MFA13-6","MFA13-7","MFA13-8","MFA13-9","MFA14-1","MFA14-2","MFA14-3","MFA14-4","MFA14-5","MFA14-6","MFA15-1","MFA15-10","MFA15-2","MFA15-3","MFA15-4","MFA15-5","MFA15-6","MFA15-7","MFA15-8","MFA15-9","MFA16-1","MFA16-10","MFA16-2","MFA16-3","MFA16-4","MFA16-5","MFA16-6","MFA16-7","MFA16-8","MFA16-9","MFB01-1","MFB01-2","MFB01-3","MFB01-4","MFB01-5","MFB01-6","MFB02-1","MFB02-2","MFB02-3","MFB02-4","MFB02-5","MFB02-6","MFB03-1","MFB03-2","MFB03-3","MFB03-4","MFB03-5","MFB03-6","MFB04-1","MFB04-2","MFB04-3","MFB04-4","MFB04-5","MFB04-6","MFB05-1","MFB05-2","MFB05-3","MFB05-4","MFB05-5","MFB05-6","MFB06-1","MFB06-2","MFB06-3","MFB06-4","MFB06-5","MFB06-6","MFC01-1","MFC01-2","MFC01-3","MFC01-4","MFC01-5","MFC01-6","MFC02-1","MFC02-2","MFC02-3","MFC02-4","MFC02-5","MFC02-6","MFC03-1","MFC03-2","MFC03-3","MFC03-4","MFC03-5","MFC03-6","MFC04-1","MFC04-2","MFC04-3","MFC04-4","MFC04-5","MFC04-6","MFC05-1","MFC05-2","MFC05-3","MFC05-4","MFC05-5","MFC05-6","MFC06-1","MFC06-2","MFC06-3","MFC06-4","MFC06-5","MFC06-6","MFC07-1","MFC07-2","MFC07-3","MFC07-4","MFC07-5","MFC07-6","MFC08-1","MFC08-2","MFC08-3","MFC08-4","MFC08-5","MFC08-6","MFC09-1","MFC09-2","MFC09-3","MFC09-4","MFC09-5","MFC09-6","MFC10-1","MFC10-2","MFC10-3","MFC10-4","MFC10-5","MFC10-6","MFC11-1","MFC11-2","MFC11-3","MFC11-4","MFC11-5","MFC11-6","MFD01-1","MFD01-2","MFD01-3","MFD01-4","MFD01-5","MFD01-6","MFD02-1","MFD02-2","MFD02-3","MFD02-4","MFD02-5","MFD02-6","MFD03-1","MFD03-2","MFD03-3","MFD03-4","MFD03-5","MFD03-6","MFD08-1","MFD08-2","MFD08-3","MFD08-4","MFD08-5","MFD08-6","MFE01-1","MFE01-2","MFE01-3","MFE01-4","MFE01-5","MFE01-6","MFE02-1","MFE02-2","MFE02-3","MFE02-4","MFE02-5","MFE02-6","MFE03-1","MFE03-2","MFE03-3","MFE03-4","MFE03-5","MFE03-6","MFF01-1","MFF01-2","MFF01-3","MFF01-4","MFF01-5","MFF01-6","MFF02-1","MFF02-2","MFF02-3","MFF02-4","MFF02-5","MFF02-6","MFF03-1","MFF03-2","MFF03-3","MFF03-4","MFF03-5","MFF03-6","MFF04-1","MFF04-2","MFF04-3","MFF04-4","MFF04-5","MFF04-6","MFF05-1","MFF05-2","MFF05-3","MFF05-4","MFF05-5","MFF05-6","MFF06-1","MFF06-2","MFF06-3","MFF06-4","MFF06-5","MFF06-6","MFF07-1","MFF07-2","MFF07-3","MFF07-4","MFF07-5","MFF07-6","MFG01","MFG02","MFG03","MFG04","MFG05","MFG06","MFG07","MFG08","MFG09","MFG10","MFG11","MFG12","MFG13","MFG14","MFG15","MFG16","MFH01","MFH02","MFH03","MFH04","MFH05","MFH06","MFH07","MFH08","MFH09","MFI01","MFI02","MFI03","MFI04","MFI05","MFI06","MFI07","MFJ01","MFJ02","MFJ03","MFJ04","MFJ05","MFJ06","MFJ07","MFJ08","MFJ09","MFJ10","MFJ11","MFJ12","MFJ13","MFJ14","MFJ15","MFJ16","MFJ17","MFJ18","MFJ19","MFJ20","MFJ21","MFJ22","MFJ23","MFJ24","MFJ25","MFJ26","MFJ27","MFJ28","MFJ29","MFJ30","MFK01","MFK02","MFK03","MFK04","MFK05","MFK06","MFK07","MFK08","MFK09","MFK10","MFK11","MFK12","MFK13","MFK14","MFK15","MFK16","MFK17","MFK18","MFK19","MFK20","MFK21","MFK22","MFK23","MFK24",
    // ໂລພື້ນ (Floor Display Racks) MFT01-MFT32
    "MFT01","MFT02","MFT03","MFT04","MFT05","MFT06","MFT07","MFT08","MFT09","MFT10","MFT11","MFT12","MFT13","MFT14","MFT15","MFT16","MFT17","MFT18","MFT19","MFT20","MFT21","MFT22","MFT23","MFT24","MFT25","MFT26","MFT27","MFT28","MFT29","MFT30","MFT31","MFT32"];

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
    },
    'ໂພນສີນວນ': {
        'KITCHEN': [
            { zones: ["PFA01-1","PFA01-2","PFA01-3","PFA01-4","PFA01-5","PFA01-6","PFA01-7","PFA01-8","PFA01-9","PFA01-10","PFA01-11","PFA01-12","PFA02-1","PFA02-2","PFA02-3","PFA02-4","PFA02-5","PFA02-6","PFA02-7","PFA02-8","PFA02-9","PFA02-10","PFA02-11","PFA02-12","PFA03-1","PFA03-2","PFA03-3","PFA03-4","PFA03-5","PFA03-6","PFA03-7","PFA03-8","PFA03-9","PFA03-10","PFA03-11","PFA03-12","PFA04-1","PFA04-2","PFA04-3","PFA04-4","PFA04-5","PFA04-6","PFA04-7","PFA04-8","PFA04-9","PFA04-10","PFA04-11","PFA04-12","PFA05-1","PFA05-2","PFA05-3","PFA05-4","PFA05-5","PFA05-6","PFA05-7","PFA05-8","PFA05-9","PFA05-10","PFA06-1","PFA06-2","PFA06-3","PFA06-4","PFA06-5","PFA06-6","PFA06-7","PFA06-8","PFA06-9","PFA06-10","PFA06-11","PFA06-12","PFA07-1","PFA07-2","PFA07-3","PFA07-4","PFA07-5","PFA07-6","PFA07-7","PFA07-8","PFA07-9","PFA07-10","PFA07-11","PFA07-12","PFA08-1","PFA08-2","PFA08-3","PFA08-4","PFA08-5","PFA08-6","PFA08-7","PFA08-8","PFA08-9","PFA08-10","PFA08-11","PFA08-12","PFA09-1","PFA09-2","PFA09-3","PFA09-4","PFA09-5","PFA09-6","PFA09-7","PFA09-8","PFA09-9","PFA09-10","PFA09-11","PFA09-12","PFB09-1","PFB09-2","PFB09-3","PFB09-4","PFB09-5","PFB09-6","PFB09-7","PFB09-8","PFB09-9","PFB09-10","PFB09-11","PFB09-12","PFB09-13","PFB09-14","PFB08-1","PFB08-2","PFB08-3","PFB08-4","PFB08-5","PFB08-6","PFB08-7","PFB08-8","PFB08-9","PFB08-10","PFB08-11","PFB08-12","PFB08-13","PFB08-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'TOYS': [
            { zones: ["PFA10-1","PFA10-2","PFA10-3","PFA10-4","PFA10-5","PFA10-6","PFA10-7","PFA10-8","PFA10-9","PFA10-10","PFA10-11","PFA10-12","PFA11-1","PFA11-2","PFA11-3","PFA11-4","PFA11-5","PFA11-6","PFA11-7","PFA11-8","PFA11-9","PFA11-10","PFA11-11","PFA11-12"], maxLevel: 0, format: 'store_exact' }
        ],
        'SPORTS': [
            { zones: ["PFA12-1","PFA12-2","PFA12-3","PFA12-4","PFA12-5","PFA12-6","PFA12-7","PFA12-8","PFA12-9","PFA12-10","PFA12-11","PFA12-12","PFA13-1","PFA13-2","PFA13-3","PFA13-4","PFA13-5","PFA13-6","PFA13-7","PFA13-8","PFA13-9","PFA13-10","PFA13-11","PFA13-12"], maxLevel: 0, format: 'store_exact' }
        ],
        'FASHION': [
            { zones: ["PFB01-1","PFB01-2","PFB01-3","PFB01-4","PFB01-5","PFB01-6","PFB01-7","PFB01-8","PFB01-9","PFB01-10","PFB01-11","PFB01-12","PFB01-13","PFB01-14","PFB02-1","PFB02-2","PFB02-3","PFB02-4","PFB02-5","PFB02-6","PFB02-7","PFB02-8","PFB02-9","PFB02-10","PFB02-11","PFB02-12","PFB02-13","PFB02-14","PFB03-1","PFB03-2","PFB03-3","PFB03-4","PFB03-5","PFB03-6","PFB03-7","PFB03-8","PFB03-9","PFB03-10","PFB03-11","PFB03-12","PFB03-13","PFB03-14","PFB04-1","PFB04-2","PFB04-3","PFB04-4","PFB04-5","PFB04-6","PFB04-7","PFB04-8","PFB04-9","PFB04-10","PFB04-11","PFB04-12","PFB04-13","PFB04-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'CLEANING': [
            { zones: ["PFB05-1","PFB05-2","PFB05-3","PFB05-4","PFB05-5","PFB05-6","PFB05-7","PFB05-8","PFB05-9","PFB05-10","PFB05-11","PFB05-12","PFB05-13","PFB06-1","PFB06-2","PFB06-3","PFB06-4","PFB06-5","PFB06-6","PFB06-7","PFB06-8","PFB06-9","PFB06-10","PFB06-11","PFB06-12","PFB06-13","PFB06-14","PFB07-1","PFB07-2","PFB07-3","PFB07-4","PFB07-5","PFB07-6","PFB07-7","PFB07-8","PFB07-9","PFB07-10","PFB07-11","PFB07-12","PFB07-13","PFB07-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'STATIONERY': [
            { zones: ["PFB10-1","PFB10-2","PFB10-3","PFB10-4","PFB10-5","PFB10-6","PFB10-7","PFB10-8","PFB10-9","PFB10-10","PFB10-11","PFB10-12","PFB10-13","PFB10-14","PFB11-1","PFB11-2","PFB11-3","PFB11-4","PFB11-5","PFB11-6","PFB11-7","PFB11-8","PFB11-9","PFB11-10","PFB11-11","PFB11-12","PFB11-13","PFB11-14","PFB12-1","PFB12-2","PFB12-3","PFB12-4","PFB12-5","PFB12-6","PFB12-7","PFB12-8","PFB12-9","PFB12-10","PFB12-11","PFB12-12","PFB12-13","PFB12-14","PFB13-1","PFB13-2","PFB13-3","PFB13-4","PFB13-5","PFB13-6","PFB13-7","PFB13-8","PFB13-9","PFB13-10","PFB13-11","PFB13-12","PFB13-13","PFB13-14","PFB14-1","PFB14-2","PFB14-3","PFB14-4","PFB14-5","PFB14-6","PFB14-7","PFB14-8","PFB14-9","PFB14-10","PFB14-11","PFB14-12","PFB14-13","PFB14-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'TOOL/DIGITAL': [
            { zones: ["PFC01-1","PFC01-2","PFC01-3","PFC01-4","PFC01-5","PFC01-6","PFC01-7","PFC01-8","PFC01-9","PFC01-10","PFC01-11","PFC01-12","PFC01-13","PFC01-14","PFC02-1","PFC02-2","PFC02-3","PFC02-4","PFC02-5","PFC02-6","PFC02-7","PFC02-8","PFC02-9","PFC02-10","PFC02-11","PFC02-12","PFC02-13","PFC02-14","PFC03-1","PFC03-2","PFC03-3","PFC03-4","PFC03-5","PFC03-6","PFC03-7","PFC03-8","PFC03-9","PFC03-10","PFC03-11","PFC03-12","PFC03-13"], maxLevel: 0, format: 'store_exact' }
        ],
        'BEAUTY': [
            { zones: ["PFC04-1","PFC04-2","PFC04-3","PFC04-4","PFC04-5","PFC04-6","PFC04-7","PFC04-8","PFC04-9","PFC04-10","PFC04-11","PFC04-12","PFC04-13","PFC04-14","PFC05-1","PFC05-2","PFC05-3","PFC05-4","PFC05-5","PFC05-6","PFC05-7","PFC05-8","PFC05-9","PFC05-10","PFC05-11","PFC05-12","PFC05-13","PFC05-14","PFC06-1","PFC06-2","PFC06-3","PFC06-4","PFC06-5","PFC06-6","PFC06-7","PFC06-8","PFC06-9","PFC06-10","PFC06-11","PFC06-12","PFC06-13","PFC06-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'STORAGE': [
            { zones: ["PFC07-1","PFC07-2","PFC07-3","PFC07-4","PFC07-5","PFC07-6","PFC07-7","PFC07-8","PFC07-9","PFC07-10","PFC07-11","PFC07-12","PFC07-13","PFC07-14","PFC08-1","PFC08-2","PFC08-3","PFC08-4","PFC08-5","PFC08-6","PFC08-7","PFC08-8","PFC08-9","PFC08-10","PFC08-11","PFC08-12","PFC08-13","PFC08-14","PFC09-1","PFC09-2","PFC09-3","PFC09-4","PFC09-5","PFC09-6","PFC09-7","PFC09-8","PFC09-9","PFC09-10","PFC09-11","PFC09-12","PFC09-13","PFC09-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'INTERIOR': [
            { zones: ["PFC10-1","PFC10-2","PFC10-3","PFC10-4","PFC10-5","PFC10-6","PFC10-7","PFC10-8","PFC10-9","PFC10-10","PFC10-11","PFC10-12","PFC10-13","PFC10-14","PFD01-1","PFD01-2","PFD01-3","PFD01-4","PFD01-5","PFD01-6"], maxLevel: 0, format: 'store_exact' }
        ],
        'EVENT': [
            { zones: ["PFP01","PFP02","PFP03","PFP04","PFP05","PFP06","PFP07","PFP08","PFP09","PFP10","PFP11","PFP12","PFP13","PFP14","PFP15","PFP16","PFP17","PFP18","PFP19","PFP20","PFP21","PFP22","PFP23","PFP24","PFP25","PFP26","PFP27","PFP28","PFP29","PFP30","PFP31","PFP32","PFP33","PFP34","PFP35"], maxLevel: 0, format: 'store_exact' }
        ]
    },
    'ວັງຊາຍ': {
        'STATIONERY': [
            { zones: ["VFG01-18","VFG01-19","VFG01-20","VFG01-21","VFG01-22","VFG01-23","VFG01-24","VFG01-25","VFD02-1","VFD02-2","VFD02-3","VFD02-4","VFD02-5","VFD02-6","VFD02-7","VFD02-8"], maxLevel: 0, format: 'store_exact' }
        ],
        'INTERIOR': [
            { zones: ["VFG01-1","VFG01-2","VFG01-3","VFG01-4","VFG01-5","VFG01-6","VFG01-7","VFA01-1","VFA01-2","VFA01-3","VFA01-4","VFA01-5","VFA01-6","VFA01-7","VFA01-8"], maxLevel: 0, format: 'store_exact' }
        ],
        'STORAGE': [
            { zones: ["VFG01-8","VFG01-9","VFG01-10","VFG01-11","VFG01-12","VFG01-13","VFG01-14","VFG01-15","VFG01-16","VFG01-17"], maxLevel: 0, format: 'store_exact' }
        ],
        'FASHION': [
            { zones: ["VFB01-1","VFB01-2","VFB01-3","VFB01-4","VFB01-5","VFB01-6","VFB01-7","VFB01-8","VFB01-9","VFB01-10","VFB01-11","VFB01-12","VFC01-1","VFC01-2","VFC01-3","VFC01-4","VFC01-5","VFC01-6"], maxLevel: 0, format: 'store_exact' }
        ],
        'KITCHEN': [
            { zones: ["VFF01-5","VFF01-6","VFF01-7","VFF01-8","VFF01-9","VFA03-1","VFA03-2","VFA03-3","VFA03-4","VFA03-5","VFA03-6","VFA03-7","VFA03-8","VFA03-9","VFA03-10","VFA03-11","VFA03-12","VFA03-13","VFA03-14","VFA04-1","VFA04-2","VFA04-3","VFA04-4","VFA04-5","VFA04-6","VFA04-7","VFA04-8","VFA04-9","VFA04-10","VFA04-11","VFA04-12","VFA04-13","VFA04-14","VFB03-1","VFB03-2","VFB03-3","VFB03-4","VFB03-5","VFB03-6","VFB03-7","VFB03-8","VFB03-9","VFB03-10","VFB04-1","VFB04-2","VFB04-3","VFB04-4","VFB04-5","VFB04-6","VFB04-7","VFB04-8","VFB04-9","VFB04-10","VFB04-11","VFB04-12"], maxLevel: 0, format: 'store_exact' }
        ],
        'CLEANING': [
            { zones: ["VFF01-1","VFF01-2","VFF01-3","VFF01-4","VFA02-1","VFA02-2","VFA02-3","VFA02-4","VFA02-5","VFA02-6","VFA02-7","VFA02-8","VFA02-9","VFA02-10","VFA02-11","VFA02-12","VFA02-13","VFA02-14"], maxLevel: 0, format: 'store_exact' }
        ],
        'TOYS': [
            { zones: ["VFC04-1","VFC04-2","VFC04-3","VFC04-4","VFC04-5","VFC04-6","VFG01-30"], maxLevel: 0, format: 'store_exact' }
        ],
        'BEAUTY': [
            { zones: ["VFC03-1","VFC03-2","VFC03-3","VFC03-4","VFC03-5","VFC03-6","VFD01-1","VFD01-2","VFD01-3","VFD01-4","VFD01-5","VFD01-6","VFD01-7","VFD01-8"], maxLevel: 0, format: 'store_exact' }
        ],
        'EVENT': [
            { zones: ["VFE01","VFE02","VFE03","VFE04","VFE05","VFE06","VFE07","VFE08","VFE09","VFE10","VFE11","VFE12","VFE13","VFE14","VFE15","VFE16","VFE17","VFE18","VFE19","VFE20"], maxLevel: 0, format: 'store_exact' }
        ],
        'SPORTS': [
            { zones: ["VFG01-26","VFG01-27","VFG01-28","VFG01-29"], maxLevel: 0, format: 'store_exact' }
        ],
        'TOOL/DIGITAL': [
            { zones: ["VFB02-1","VFB02-2","VFB02-3","VFB02-4","VFB02-5","VFB02-6","VFB02-7","VFB02-8","VFB02-9","VFB02-10","VFB02-11","VFB02-12","VFC02-1","VFC02-2","VFC02-3","VFC02-4","VFC02-5","VFC02-6"], maxLevel: 0, format: 'store_exact' }
        ]
    },
    'ເມກ້າມໍ': {
        'KITCHEN': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'STATIONERY': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'STORAGE': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'INTERIOR': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'TOYS': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'FASHION': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'BEAUTY': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'SPORTS': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'CLEANING': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'TOOL/DIGITAL': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }],
        'EVENT': [{ zones: MEGAMALL_ALL_RACKS, maxLevel: 0, format: 'store_exact' }]
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
    if (normalizedId === 'PSN' || normalizedId.includes('ໂພນສີນວນ')) return 'ໂພນສີນວນ';
    if (normalizedId === 'VX' || normalizedId.includes('ວັງຊາຍ')) return 'ວັງຊາຍ';
    if (normalizedId === 'TLL' || normalizedId.includes('ຕະຫຼາດລາວ')) return 'ຕະຫຼາດລາວ';
    if (normalizedId === 'MGM' || normalizedId.includes('ເມກ້າມໍ')) return 'ເມກ້າມໍ';

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
