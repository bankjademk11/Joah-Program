// phonthongRackRules.js
// Strict Rack mapping สำหรับสาขาเดียว: ໂພນຕ້ອງ
// หลักการ: category_1 + category_2 ต้องเหลือ Rack เดียวเท่านั้นจึง assign

export const PHONTHONG_BRANCH = "ໂພນຕ້ອງ";
export const JMARTDD_BRANCH = "JmartDD";

export const isJmartDDBranch = (branchId) => {
  const s = String(branchId ?? "").trim().toLowerCase();
  return s === "jmartdd" || s.includes("jmartdd") || s === "jmdd";
};

export const getPhonthongStyleRackPrefix = (branchId) =>
  isJmartDDBranch(branchId) ? "JMDD" : "JMPT";

export const formatPhonthongStyleRack = (rackLocation, branchId) => {
  if (!rackLocation) return rackLocation;
  const prefix = getPhonthongStyleRackPrefix(branchId);
  if (prefix === "JMPT") return rackLocation;
  return String(rackLocation).replace(/^JMPT\b/, prefix);
};

export const isPhonthongStyleBranch = (branchId) => {
  const s = String(branchId ?? "").trim().toLowerCase();
  return (
    s === PHONTHONG_BRANCH ||
    s.includes(PHONTHONG_BRANCH) ||
    isJmartDDBranch(branchId)
  );
};

const clean = (value) => String(value ?? "").trim();
const key = (value) => clean(value).toUpperCase().replace(/\s+/g, " ");

export const PHONTHONG_RACKS_BY_CATEGORY = {
  KITCHEN: [
    ...Array.from({ length: 8 }, (_, i) => `JMPT. A-${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `JMPT. B-${i + 1}`),
  ],
  CLEANING: [
    ...Array.from({ length: 8 }, (_, i) => `JMPT. C-${i + 1}`),
    ...Array.from({ length: 3 }, (_, i) => `JMPT. G-${i + 18}`),
  ],
  "TOOL/DIGITAL": Array.from({ length: 8 }, (_, i) => `JMPT. D-${i + 1}`),
  STATIONERY: [
    ...Array.from({ length: 8 }, (_, i) => `JMPT. E-${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `JMPT. F-${i + 1}`),
  ],
  TOYS: ["JMPT. G-1", "JMPT. G-2", "JMPT. G-3"],
  STORAGE: Array.from({ length: 8 }, (_, i) => `JMPT. G-${i + 4}`),
  FASHION: ["JMPT. G-12", "JMPT. G-13", "JMPT. G-14"],
  INTERIOR: ["JMPT. G-15", "JMPT. G-16", "JMPT. G-17"],
};

export const KOREAN_TO_ENGLISH_CATEGORY_1 = {
  "패션잡화": "FASHION",
  "주방용품": "KITCHEN",
  "수납/정리": "STORAGE",
  "수납정리": "STORAGE",
  "수납": "STORAGE",
  "청소/욕실": "CLEANING",
  "청소욕실": "CLEANING",
  "인테리어/원예": "INTERIOR",
  "인테리어원예": "INTERIOR",
  "문구/사무용품": "STATIONERY",
  "문구사무용품": "STATIONERY",
  "문구": "STATIONERY",
  "사무용품": "STATIONERY",
  "공구/디지털": "TOOL/DIGITAL",
  "공구디지털": "TOOL/DIGITAL",
  "공구": "TOOL/DIGITAL",
  "디지털": "TOOL/DIGITAL",
  "완구/팬시": "TOYS",
  "완구팬시": "TOYS",
  "완구": "TOYS",
  "장난감": "TOYS",
  "뷰티": "FASHION",
  "뷰티/화장품": "FASHION",
  "미용": "FASHION",
  "스포츠/레저": "FASHION",
  "스포츠": "FASHION",
};

// เป็น normalization ที่เปิดใช้อย่างตั้งใจจากข้อมูลจริงที่ตรวจพบ
export const CATEGORY_1_ALIASES = {
  KITCHEN: "KITCHEN",
  CLEANING: "CLEANING",
  "CLEANING/BATH": "CLEANING",
  "TOOL/DIGITAL": "TOOL/DIGITAL",
  TOOLS: "TOOL/DIGITAL",
  STATIONERY: "STATIONERY",
  STORAGE: "STORAGE",
  TOYS: "TOYS",
  FASHION: "FASHION",
  INTERIOR: "INTERIOR",
  BEAUTY: "FASHION",
  SPORTS: "FASHION",
  "SPORTS/LEISURE": "FASHION",
  "SPORTS, LEISURE, HOBBIES": "FASHION",
  ...KOREAN_TO_ENGLISH_CATEGORY_1,
};

const directRules = {
  KITCHEN: {
    "FOOD STORAGE/LUNCH BOX": ["JMPT. A-1"],
    "KITCHEN CLEANING": ["JMPT. A-2"],
    "COOKING UTENSILS": ["JMPT. A-3"],
    COOKWARE: ["JMPT. A-4"],
    "GLASSES/CUPS/WATER BOTTLES": ["JMPT. A-5"],
    "KITCHEN DISPOSABLES": ["JMPT. A-6"],
    "PAPER TOWELS/WRAPS": ["JMPT. A-7"],
    CUTLERY: ["JMPT. A-8"],
    "TABLEWARE/BOWLS/TRAYS": ["JMPT. B-5"],
    "SEALED/STORAGE CONTAINERS": [
      "JMPT. B-1", "JMPT. B-2", "JMPT. B-3", "JMPT. B-4",
      "JMPT. B-6", "JMPT. B-7", "JMPT. B-8",
    ],
    "KITCHEN STORAGE/ORGANIZATION": ["JMPT. B-1"],
    "STORAGE BOX": ["JMPT. B-1"],
    "PANS/POTS/EARTHENWARE POTS": ["JMPT. A-4"],
  },
  CLEANING: {
    "CLEANING TOOLS": ["JMPT. C-1", "JMPT. C-8"],
    "BATHROOM SUPPLIES": ["JMPT. C-2", "JMPT. C-3"],
    "LAUNDRY SUPPLIES": ["JMPT. C-4", "JMPT. C-5"],
    TOWEL: ["JMPT. C-6"],
    "TRASH BIN/PLASTIC BAG": ["JMPT. C-7"],
    "CLEANING SUPPLIES": ["JMPT. C-1"],
    "SOME BIG CLEANING TOOL": ["JMPT. G-18"],
  },
  "TOOL/DIGITAL": {
    "GARDENING TOOLS": ["JMPT. D-1"],
    "HARD TOOLS": ["JMPT. D-2", "JMPT. D-3", "JMPT. D-4"],
    "SMALL TOOLS": ["JMPT. D-5"],
    COMPUTER: ["JMPT. D-6"],
    "MOBILE PHONE ACCESSORIES": ["JMPT. D-7", "JMPT. D-8"],
    TOOLS: ["JMPT. D-2"],
    "BATTERIES/OUTLETS": ["JMPT. D-7"],
    "AUTOMOTIVE SUPPLIES": ["JMPT. D-1"],
  },
  STATIONERY: {
    "ART SUPPLIES": ["JMPT. E-1"],
    STICKER: ["JMPT. E-2", "JMPT. E-3"],
    "LETTER ENVELOPE": ["JMPT. E-4"],
    "WRITING SUPPLIES": ["JMPT. E-5", "JMPT. F-5"],
    "GIFT BAG": ["JMPT. E-6", "JMPT. E-7"],
    TAPE: ["JMPT. E-8"],
    "DIARY/NOTE": ["JMPT. F-1", "JMPT. F-2", "JMPT. F-3", "JMPT. F-4"],
    "OFFICE SUPPLIES": ["JMPT. F-6", "JMPT. F-7"],
    "SCHOOL SUPPLIES": ["JMPT. F-8"],
    "PARTY/EVENT SUPPLIES": ["JMPT. E-6"],
  },
  STORAGE: {
    STORAGE: ["JMPT. G-4"],
    "STORAGE BOX": ["JMPT. G-4"],
    "STORAGE BASKET": ["JMPT. G-4"],
    "CLOTHES STORAGE": ["JMPT. G-4"],
    "CARTON BOX": ["JMPT. G-4"],
    "COTTON BOX": ["JMPT. G-4"],
  },
  TOYS: {
    TOYS: ["JMPT. G-1"],
  },
  FASHION: {
    FASHION: ["JMPT. G-12"],
    "FASHION ACCESSORIES": ["JMPT. G-12"],
    "HAIR ACCESSORIES": ["JMPT. G-12"],
    "JEWELRY ACCESSORIES": ["JMPT. G-12"],
    SHOES: ["JMPT. G-12"],
    BAG: ["JMPT. G-12"],
    "SHOPPER BAG": ["JMPT. G-12"],
  },
  INTERIOR: {
    INTERIOR: ["JMPT. G-15"],
    "HOME INTERIOR": ["JMPT. G-15"],
    "PHOTO FRAME": ["JMPT. G-15"],
    AROMA: ["JMPT. G-15"],
    "BEDDING/CUSHION": ["JMPT. G-15"],
  },
};

// Default Fallback Rack ประจำหมวดหมู่หลัก เมื่อไม่มี Category 2 (เช่น Category 2 เป็นภาษาเกาหลีและถูกตัดออก)
export const CATEGORY_1_FALLBACKS = {
  KITCHEN: "JMPT. A-1",
  CLEANING: "JMPT. C-1",
  "TOOL/DIGITAL": "JMPT. D-1",
  STATIONERY: "JMPT. E-1",
  TOYS: "JMPT. G-1",
  STORAGE: "JMPT. G-4",
  FASHION: "JMPT. G-12",
  INTERIOR: "JMPT. G-15",
  BEAUTY: "JMPT. G-12",
  SPORTS: "JMPT. G-12",
  "SPORTS/LEISURE": "JMPT. G-12",
};

const zoneGFallbacks = CATEGORY_1_FALLBACKS;

// ชื่อใน Store Inventory ที่เป็น case/plural/รูปแบบเดียวกันกับ Layout
export const CATEGORY_2_ALIASES = {
  "FOOD STORAGE/LUNCH BOX": "FOOD STORAGE/LUNCH BOX",
  "SEALED/STORAGE/LUNCH BOXES": "FOOD STORAGE/LUNCH BOX",
  "SEALED/STORAGE CONTAINERS": "SEALED/STORAGE CONTAINERS",
  "KITCHEN STORAGE/ORGANIZATION": "KITCHEN STORAGE/ORGANIZATION",
  "TABLEWARE/BOWLS/TRAYS": "TABLEWARE/BOWLS/TRAYS",
  "KITCHEN CLEANING": "KITCHEN CLEANING",
  "COOKING UTENSILS": "COOKING UTENSILS",
  "GLASSES/CUPS/WATER BOTTLES": "GLASSES/CUPS/WATER BOTTLES",
  "KITCHEN DISPOSABLES": "KITCHEN DISPOSABLES",
  "PAPER TOWELS/WRAPS": "PAPER TOWELS/WRAPS",
  "CLEANING TOOLS": "CLEANING TOOLS",
  "BATHROOM SUPPLIES": "BATHROOM SUPPLIES",
  "LAUNDRY SUPPLIES": "LAUNDRY SUPPLIES",
  TOWELS: "TOWEL",
  TOWEL: "TOWEL",
  "TRASH CANS/PLASTIC BAGS": "TRASH BIN/PLASTIC BAG",
  "TRASH BIN/PLASTIC BAG": "TRASH BIN/PLASTIC BAG",
  "GARDENING TOOLS": "GARDENING TOOLS",
  "HARD TOOLS": "HARD TOOLS",
  "SMALL TOOLS": "SMALL TOOLS",
  COMPUTERS: "COMPUTER",
  COMPUTER: "COMPUTER",
  "MOBILE PHONE ACCESSORIES": "MOBILE PHONE ACCESSORIES",
  "ART SUPPLIES": "ART SUPPLIES",
  STICKER: "STICKER",
  STICKERS: "STICKER",
  "LETTER ENVELOPE": "LETTER ENVELOPE",
  "LETTERS/ENVELOPES": "LETTER ENVELOPE",
  "WRITING SUPPLIES": "WRITING SUPPLIES",
  "GIFT BAG": "GIFT BAG",
  TAPE: "TAPE",
  "DIARY/NOTE": "DIARY/NOTE",
  "DIARIES/NOTEBOOKS/MEMOS": "DIARY/NOTE",
  "OFFICE SUPPLIES": "OFFICE SUPPLIES",
  "STATIONERY/OFFICE SUPPLIES": "OFFICE SUPPLIES",
  "SCHOOL SUPPLIES": "SCHOOL SUPPLIES",
  STORAGE: "STORAGE",
  TOYS: "TOYS",
  FASHION: "FASHION",
  "FASHION ACCESSORIES": "FASHION ACCESSORIES",
  "HAIR ACCESSORIES": "HAIR ACCESSORIES",
  SHOES: "SHOES",
  INTERIOR: "INTERIOR",
  MAKEUP: "FASHION",
  "HAIR/BODY": "FASHION",
  "HEALTH/HYGIENE PRODUCTS": "FASHION",
  "NAIL SUPPLIES": "FASHION",
  // 🆕 Kitchen variations
  "TABLEWARE/BOWL": "TABLEWARE/BOWLS/TRAYS",
  "TABLEWARE/BOWLS": "TABLEWARE/BOWLS/TRAYS",
  "BOWL": "TABLEWARE/BOWLS/TRAYS",
  "BOWLS": "TABLEWARE/BOWLS/TRAYS",
  "TABLEWARE": "TABLEWARE/BOWLS/TRAYS",
  "DISH/PLATE": "TABLEWARE/BOWLS/TRAYS",
  "PLATES": "TABLEWARE/BOWLS/TRAYS",
  "KITCHEN STORAGE": "KITCHEN STORAGE/ORGANIZATION",
  "FOOD CONTAINER": "KITCHEN STORAGE/ORGANIZATION",
  "FOOD CONTAINERS": "KITCHEN STORAGE/ORGANIZATION",
  "STORAGE PLASTIC(PP)": "KITCHEN STORAGE/ORGANIZATION",
  "KITCHEN PLASTIC(PP)": "KITCHEN STORAGE/ORGANIZATION",
  "KITCHEN PLASTIC(PP+PE)": "KITCHEN STORAGE/ORGANIZATION",
  "STORAGE BOX": "STORAGE BOX",
  "CANISTER": "KITCHEN STORAGE/ORGANIZATION",
  "JAR": "KITCHEN STORAGE/ORGANIZATION",
  "SEALED STORAGE/LUNCH BOX": "FOOD STORAGE/LUNCH BOX",
  "SEALED STORAGE / LUNCH BOX": "FOOD STORAGE/LUNCH BOX",
  "SEALED STORAGE": "SEALED/STORAGE CONTAINERS",
  "LUNCH BOX": "FOOD STORAGE/LUNCH BOX",
  "LUNCH BOXES": "FOOD STORAGE/LUNCH BOX",
  "FOOD STORAGE": "FOOD STORAGE/LUNCH BOX",
  "PRESERVATION BOX": "FOOD STORAGE/LUNCH BOX",
  "GLASS/CUP/WATER/BOTTLE": "GLASSES/CUPS/WATER BOTTLES",
  "GLASS/CUP/WATER BOTTLE": "GLASSES/CUPS/WATER BOTTLES",
  "CUP": "GLASSES/CUPS/WATER BOTTLES",
  "CUPS": "GLASSES/CUPS/WATER BOTTLES",
  "MUG": "GLASSES/CUPS/WATER BOTTLES",
  "MUGS": "GLASSES/CUPS/WATER BOTTLES",
  "WATER BOTTLE": "GLASSES/CUPS/WATER BOTTLES",
  "WATER BOTTLES": "GLASSES/CUPS/WATER BOTTLES",
  "TUMBLER": "GLASSES/CUPS/WATER BOTTLES",
  "DISPOSABLE PRODUCTS": "KITCHEN DISPOSABLES",
  "DISPOSABLES": "KITCHEN DISPOSABLES",
  "KITCHEN DISPOSABLE": "KITCHEN DISPOSABLES",
  "BAKING SUPPLIES": "COOKING UTENSILS",
  "BAKING TOOLS": "COOKING UTENSILS",
  "KITCHEN OUTDOOR": "COOKING UTENSILS",
  "COOKWARE": "COOKWARE",

  // 🆕 Tool / Digital variations
  "SMALL HOME APPLIANCES": "SMALL TOOLS",
  "SMALL APPLIANCES": "SMALL TOOLS",
  "HOME APPLIANCES": "SMALL TOOLS",
  "CAR SUPPLIES": "GARDENING TOOLS",
  "AUTOMOTIVE": "GARDENING TOOLS",

  // 🆕 Fashion / Beauty / Storage variations
  "MAKE UP": "FASHION ACCESSORIES",
  "MAKEUP": "FASHION ACCESSORIES",
  "COSMETICS": "FASHION ACCESSORIES",
  "NAIL SUPPLIES": "FASHION ACCESSORIES",
  "HAIR/BODY": "FASHION ACCESSORIES",
  "HAIR AND BODY": "FASHION ACCESSORIES",
  "SKIN CARE": "FASHION ACCESSORIES",
  "BATH/BODY": "FASHION ACCESSORIES",
  "BATH AND BODY": "FASHION ACCESSORIES",
  "JEWELRY ACCESSORIES": "FASHION ACCESSORIES",
  "JEWELRY": "FASHION ACCESSORIES",
  "JEWELRY BOX": "FASHION ACCESSORIES",
  "ACCESSORIES": "FASHION ACCESSORIES",
  "ACC": "FASHION ACCESSORIES",
  "BAG": "FASHION ACCESSORIES",
  "BAGS": "FASHION ACCESSORIES",
  "SHOPPER BAG": "FASHION ACCESSORIES",
  "RAIN GEAR": "FASHION ACCESSORIES",
  "PET": "STORAGE",
  "PET SUPPLIES": "STORAGE",
  "BASKETS": "STORAGE",
  "CRAFTS": "STORAGE",
  "STORAGE BASKET": "STORAGE BASKET",
  "STORAGE BASKETS": "STORAGE BASKET",
  "CLOTHES STORAGE": "CLOTHES STORAGE",
  "CLOTH STORAGE": "CLOTHES STORAGE",
  "COTTON BOX": "STORAGE BOX",
  "CARTON BOX": "STORAGE BOX",
  "PHOTO FRAME": "PHOTO FRAME",
  "AROMA": "AROMA",
  "BEDDING/CUSHION": "BEDDING/CUSHION",
  "CUSHION": "BEDDING/CUSHION",
  "SPORTS": "FASHION ACCESSORIES",
};

// ตารางจับคู่ Category 2 -> Category 1 เพื่อใช้เมื่อ Category 1 ขาดหายหรือเป็นภาษาอื่น
export const CATEGORY_2_TO_CATEGORY_1 = {
  // FASHION
  "JEWELRY ACCESSORIES": "FASHION",
  "JEWELRY": "FASHION",
  "JEWELRY BOX": "FASHION",
  "ACCESSORIES": "FASHION",
  "FASHION ACCESSORIES": "FASHION",
  "HAIR ACCESSORIES": "FASHION",
  "SHOES": "FASHION",
  "BAG": "FASHION",
  "BAGS": "FASHION",
  "SHOPPER BAG": "FASHION",
  "RAIN GEAR": "FASHION",
  "ACC": "FASHION",
  "MAKE UP": "FASHION",
  "MAKEUP": "FASHION",
  "COSMETICS": "FASHION",
  "NAIL SUPPLIES": "FASHION",
  "HAIR/BODY": "FASHION",
  "HAIR AND BODY": "FASHION",
  "SKIN CARE": "FASHION",
  "BATH/BODY": "FASHION",
  "BATH AND BODY": "FASHION",
  "HEALTH/HYGIENE PRODUCTS": "FASHION",
  "BEAUTY": "FASHION",
  "SPORTS": "FASHION",
  "SPORTS/LEISURE": "FASHION",

  // STORAGE
  "STORAGE": "STORAGE",
  "STORAGE BOX": "STORAGE",
  "STORAGE BASKET": "STORAGE",
  "STORAGE BASKETS": "STORAGE",
  "CLOTHES STORAGE": "STORAGE",
  "CLOTH STORAGE": "STORAGE",
  "CARTON BOX": "STORAGE",
  "COTTON BOX": "STORAGE",
  "BASKETS": "STORAGE",
  "BASKET": "STORAGE",
  "PET": "STORAGE",
  "PET SUPPLIES": "STORAGE",
  "CRAFTS": "STORAGE",

  // INTERIOR
  "INTERIOR": "INTERIOR",
  "HOME INTERIOR": "INTERIOR",
  "PHOTO FRAME": "INTERIOR",
  "AROMA": "INTERIOR",
  "BEDDING/CUSHION": "INTERIOR",
  "CUSHION": "INTERIOR",

  // KITCHEN
  "FOOD STORAGE/LUNCH BOX": "KITCHEN",
  "SEALED/STORAGE/LUNCH BOXES": "KITCHEN",
  "SEALED/STORAGE CONTAINERS": "KITCHEN",
  "KITCHEN STORAGE/ORGANIZATION": "KITCHEN",
  "TABLEWARE/BOWLS/TRAYS": "KITCHEN",
  "KITCHEN CLEANING": "KITCHEN",
  "COOKING UTENSILS": "KITCHEN",
  "COOKWARE": "KITCHEN",
  "GLASSES/CUPS/WATER BOTTLES": "KITCHEN",
  "KITCHEN DISPOSABLES": "KITCHEN",
  "PAPER TOWELS/WRAPS": "KITCHEN",
  "CUTLERY": "KITCHEN",
  "TABLEWARE/BOWL": "KITCHEN",
  "TABLEWARE/BOWLS": "KITCHEN",
  "BOWL": "KITCHEN",
  "BOWLS": "KITCHEN",
  "TABLEWARE": "KITCHEN",
  "DISH/PLATE": "KITCHEN",
  "PLATES": "KITCHEN",
  "KITCHEN STORAGE": "KITCHEN",
  "FOOD CONTAINER": "KITCHEN",
  "FOOD CONTAINERS": "KITCHEN",
  "STORAGE PLASTIC(PP)": "KITCHEN",
  "KITCHEN PLASTIC(PP)": "KITCHEN",
  "KITCHEN PLASTIC(PP+PE)": "KITCHEN",
  "CANISTER": "KITCHEN",
  "JAR": "KITCHEN",
  "SEALED STORAGE/LUNCH BOX": "KITCHEN",
  "SEALED STORAGE / LUNCH BOX": "KITCHEN",
  "SEALED STORAGE": "KITCHEN",
  "LUNCH BOX": "KITCHEN",
  "LUNCH BOXES": "KITCHEN",
  "FOOD STORAGE": "KITCHEN",
  "PRESERVATION BOX": "KITCHEN",
  "GLASS/CUP/WATER/BOTTLE": "KITCHEN",
  "GLASS/CUP/WATER BOTTLE": "KITCHEN",
  "CUP": "KITCHEN",
  "CUPS": "KITCHEN",
  "MUG": "KITCHEN",
  "MUGS": "KITCHEN",
  "WATER BOTTLE": "KITCHEN",
  "WATER BOTTLES": "KITCHEN",
  "TUMBLER": "KITCHEN",
  "DISPOSABLE PRODUCTS": "KITCHEN",
  "DISPOSABLES": "KITCHEN",
  "KITCHEN DISPOSABLE": "KITCHEN",
  "BAKING SUPPLIES": "KITCHEN",
  "BAKING TOOLS": "KITCHEN",
  "KITCHEN OUTDOOR": "KITCHEN",
  "PANS/POTS/EARTHENWARE POTS": "KITCHEN",

  // CLEANING
  "CLEANING TOOLS": "CLEANING",
  "CLEANING SUPPLIES": "CLEANING",
  "BATHROOM SUPPLIES": "CLEANING",
  "LAUNDRY SUPPLIES": "CLEANING",
  "TOWELS": "CLEANING",
  "TOWEL": "CLEANING",
  "TRASH CANS/PLASTIC BAGS": "CLEANING",
  "TRASH BIN/PLASTIC BAG": "CLEANING",
  "SOME BIG CLEANING TOOL": "CLEANING",

  // TOOL/DIGITAL
  "GARDENING TOOLS": "TOOL/DIGITAL",
  "HARD TOOLS": "TOOL/DIGITAL",
  "SMALL TOOLS": "TOOL/DIGITAL",
  "COMPUTERS": "TOOL/DIGITAL",
  "COMPUTER": "TOOL/DIGITAL",
  "MOBILE PHONE ACCESSORIES": "TOOL/DIGITAL",
  "BATTERIES/OUTLETS": "TOOL/DIGITAL",
  "AUTOMOTIVE SUPPLIES": "TOOL/DIGITAL",
  "SMALL HOME APPLIANCES": "TOOL/DIGITAL",
  "SMALL APPLIANCES": "TOOL/DIGITAL",
  "HOME APPLIANCES": "TOOL/DIGITAL",
  "CAR SUPPLIES": "TOOL/DIGITAL",
  "AUTOMOTIVE": "TOOL/DIGITAL",
  "TOOLS": "TOOL/DIGITAL",

  // STATIONERY
  "ART SUPPLIES": "STATIONERY",
  "STICKER": "STATIONERY",
  "STICKERS": "STATIONERY",
  "LETTER ENVELOPE": "STATIONERY",
  "LETTERS/ENVELOPES": "STATIONERY",
  "WRITING SUPPLIES": "STATIONERY",
  "GIFT BAG": "STATIONERY",
  "TAPE": "STATIONERY",
  "DIARY/NOTE": "STATIONERY",
  "DIARIES/NOTEBOOKS/MEMOS": "STATIONERY",
  "OFFICE SUPPLIES": "STATIONERY",
  "STATIONERY/OFFICE SUPPLIES": "STATIONERY",
  "SCHOOL SUPPLIES": "STATIONERY",
  "PARTY/EVENT SUPPLIES": "STATIONERY",

  // TOYS
  "TOYS": "TOYS",
};

export function inferCategory1FromCategory2(category2) {
  if (!category2) return null;
  const raw = key(category2);
  if (!raw || raw === "0" || raw === "—" || raw === "NULL") return null;

  if (CATEGORY_2_TO_CATEGORY_1[raw]) {
    return CATEGORY_2_TO_CATEGORY_1[raw];
  }

  const normalized = CATEGORY_2_ALIASES[raw];
  if (normalized && CATEGORY_2_TO_CATEGORY_1[normalized]) {
    return CATEGORY_2_TO_CATEGORY_1[normalized];
  }

  if (/JEWEL|ACCESSOR|BAG|SHOE|HAIR|BEAUTY|COSMETIC|MAKEUP|WEAR|CLOTH|FASHION/i.test(raw)) return "FASHION";
  if (/STORAGE|BOX|BASKET/i.test(raw)) return "STORAGE";
  if (/KITCHEN|COOK|BOWL|DISH|CUP|BOTTLE|FOOD|LUNCH|PLATE|MUG/i.test(raw)) return "KITCHEN";
  if (/CLEAN|TOWEL|BATH|LAUNDRY|TRASH/i.test(raw)) return "CLEANING";
  if (/TOOL|DIGITAL|PHONE|ELECTR|CABLE|BATTER/i.test(raw)) return "TOOL/DIGITAL";
  if (/STATIONERY|PEN|NOTE|PAPER|STICKER|ART|SCHOOL|OFFICE|ENVELOPE/i.test(raw)) return "STATIONERY";
  if (/TOY/i.test(raw)) return "TOYS";
  if (/INTERIOR|PHOTO|FRAME|AROMA|CUSHION|PILLOW/i.test(raw)) return "INTERIOR";

  return null;
}

function normalizeCategory1(value) {
  return CATEGORY_1_ALIASES[key(value)] || null;
}

function normalizeCategory2(value) {
  const raw = key(value);
  if (!raw || raw === "0" || raw === "—" || raw === "NULL") return null;
  return CATEGORY_2_ALIASES[raw] || raw;
}

function getCandidates(category1, category2) {
  if (!category2) {
    // ถ้าไม่มี Cat 2 (เช่น Cat 2 เป็นเกาหลีและถูกตัดทิ้ง) แต่มี Cat 1 ให้ใช้ Fallback ประจำหมวด 1
    const fallback = CATEGORY_1_FALLBACKS[category1];
    return fallback ? [fallback] : [];
  }

  const direct = directRules[category1]?.[category2];
  if (direct && direct.length > 0) return direct;

  // Fallback to Category 1 Zone default
  const fallback = zoneGFallbacks[category1];
  return fallback ? [fallback] : [];
}

/**
 * Returns decision.
 * When multiple candidates exist, pick the first candidate as default rack!
 */
export function getPhonthongRackDecision({ branchId, category1, category2 }) {
  if (!isPhonthongStyleBranch(branchId)) {
    return { rackLocation: null, candidates: [], status: "SKIP_BRANCH", reason: "branch_not_phonthong" };
  }

  let normalizedCategory1 = normalizeCategory1(category1);
  const normalizedCategory2 = normalizeCategory2(category2);

  // 🆕 ถ้า Category 1 ไม่มี/ไม่ผ่าน แต่มี Category 2 เป็นภาษาอังกฤษ ให้ Infer Category 1 จาก Category 2 อัตโนมัติ!
  if (!normalizedCategory1 && normalizedCategory2) {
    normalizedCategory1 = inferCategory1FromCategory2(normalizedCategory2);
  }

  if (!normalizedCategory1) {
    return { rackLocation: null, candidates: [], status: "SKIP", reason: "category_1_missing_or_unsupported" };
  }

  const candidates = getCandidates(normalizedCategory1, normalizedCategory2);
  
  if (candidates.length === 0) {
    return {
      rackLocation: null,
      candidates: [],
      status: "SKIP",
      reason: "category_not_in_layout",
      normalizedCategory1,
      normalizedCategory2,
    };
  }

  const formattedCandidates = candidates.map((loc) => formatPhonthongStyleRack(loc, branchId));

  // เลือก Candidate แรกเสมอ (First Candidate Default)
  return {
    rackLocation: formattedCandidates[0],
    candidates: formattedCandidates,
    status: "ASSIGNED",
    reason: formattedCandidates.length === 1 ? "single_confirmed_rack" : "default_first_candidate_rack",
    normalizedCategory1,
    normalizedCategory2,
  };
}

/**
 * Applies decisions to rows in memory. It never overwrites an existing rack.
 * Use this before calling Supabase update/upsert.
 */
export function autoAssignPhonthongRows(rows, { locationField = "rack_location" } = {}) {
  const stats = {
    assigned: 0,
    skipped: 0,
    alreadyAssigned: 0,
    byReason: {},
  };

  const output = rows.map((row) => {
    const current = clean(row[locationField]);
    if (current && current !== "—" && current.toLowerCase() !== "null") {
      stats.alreadyAssigned += 1;
      return row;
    }

    const decision = getPhonthongRackDecision({
      branchId: row.branch_id,
      category1: row.category_1,
      category2: row.category_2,
    });

    if (decision.status === "ASSIGNED") {
      stats.assigned += 1;
      return { ...row, [locationField]: decision.rackLocation };
    }

    stats.skipped += 1;
    stats.byReason[decision.reason] = (stats.byReason[decision.reason] || 0) + 1;
    return { ...row, [locationField]: null };
  });

  return { rows: output, stats };
}

export { normalizeCategory1, normalizeCategory2 };
