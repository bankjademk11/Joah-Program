// phonthongRackRules.js
// Strict Rack mapping สำหรับสาขาเดียว: ໂພນຕ້ອງ
// หลักการ: category_1 + category_2 ต้องเหลือ Rack เดียวเท่านั้นจึง assign

export const PHONTHONG_BRANCH = "ໂພນຕ້ອງ";

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
  },
  TOYS: {
    TOYS: ["JMPT. G-1"],
  },
  FASHION: {
    FASHION: ["JMPT. G-12"],
    "FASHION ACCESSORIES": ["JMPT. G-12"],
    "HAIR ACCESSORIES": ["JMPT. G-12"],
    SHOES: ["JMPT. G-12"],
  },
  INTERIOR: {
    INTERIOR: ["JMPT. G-15"],
  },
};

// Zone G Default Fallback ตามหมวดหมู่หลัก (Zone G Mapping)
const zoneGFallbacks = {
  TOYS: "JMPT. G-1",
  STORAGE: "JMPT. G-4",
  FASHION: "JMPT. G-12",
  INTERIOR: "JMPT. G-15",
  BEAUTY: "JMPT. G-15", // โซนใกล้เคียง หรือ Zone G
};

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
};

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
    // ถ้าไม่มี Cat 2 แต่มี Cat 1 ให้ใช้ Zone Fallback
    const fallback = zoneGFallbacks[category1];
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
  if (branchId !== PHONTHONG_BRANCH) {
    return { rackLocation: null, candidates: [], status: "SKIP_BRANCH", reason: "branch_not_phonthong" };
  }

  const normalizedCategory1 = normalizeCategory1(category1);
  const normalizedCategory2 = normalizeCategory2(category2);

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

  // เลือก Candidate แรกเสมอ (First Candidate Default)
  return {
    rackLocation: candidates[0],
    candidates,
    status: "ASSIGNED",
    reason: candidates.length === 1 ? "single_confirmed_rack" : "default_first_candidate_rack",
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
