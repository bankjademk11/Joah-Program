const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('C:\\Users\\ideapad sl 3i\\OneDrive\\Documents\\Bank\\DC RO to Store exampo Mr.jo.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

const metadata = {
  rawTitle: data[0][0] || '',
  deliveryDateTitle: '18/09/2026',
  sourceStore: 'PSN(store)',
  dc: 'JOAH DC'
};

let currentStore = '';
let currentRO = '';
const roList = [];
const roMap = new Map();

for (let i = 2; i < data.length; i++) {
  const row = data[i];
  if (!row || !row[3]) continue;
  
  if (row[0] && String(row[0]).trim()) currentStore = String(row[0]).trim();
  if (row[1] && String(row[1]).trim()) currentRO = String(row[1]).trim();
  
  const barcode = String(row[3]).trim();
  const productName = String(row[4]).trim();
  const qty = parseInt(row[5], 10) || 0;
  const unit = String(row[6]).trim() || 'Unit';
  
  let roObj = roMap.get(currentRO);
  if (!roObj) {
    const parts = currentRO.split(' - ');
    const soNumber = parts[0] ? parts[0].trim() : '';
    const roNumber = parts[1] ? parts[1].trim() : parts[0].trim();
    const storeParts = currentStore.split('-');
    const storeCode = storeParts[0] ? storeParts[0].trim() : '';
    const storeName = storeParts.slice(1).join('-').trim() || currentStore;
    
    roObj = {
      id: 'ro-' + (roList.length + 1),
      fullReference: currentRO,
      soNumber,
      roNumber,
      rawStore: currentStore,
      storeCode,
      storeName,
      branchTag: 'PSN',
      deliveryDate: '18/09/2026',
      totalItems: 0,
      totalRoQty: 0,
      items: [],
      blockAppearances: [i + 1]
    };
    roMap.set(currentRO, roObj);
    roList.push(roObj);
  } else {
    if (row[1] && String(row[1]).trim() && !roObj.blockAppearances.includes(i + 1)) {
      roObj.blockAppearances.push(i + 1);
    }
  }
  
  roObj.items.push({
    id: roObj.id + '-item-' + (roObj.items.length + 1),
    barcode,
    productName,
    roQty: qty,
    unit
  });
  roObj.totalItems++;
  roObj.totalRoQty += qty;
}

// 🏢 Distribute ROs across all JOAH stores for realistic multi-branch testing:
// - PSN (ໂພນສີນວນ): RO 1, 2, 3
// - VX (ວັງຊາຍ): RO 4, 5, 6
// - SVL (ສີວິໄລ): RO 7, 8
// - TLL (ຕະຫຼາດລາວ): RO 9, 10, 11
// - PTX (ໂພນຕ້ອງ): RO 12, 13

const branchDist = [
  { tag: 'PSN', code: '171010001', name: 'PSN (ໂພນສີນວນ)' }, // ro 1
  { tag: 'PSN', code: '171010001', name: 'PSN (ໂພນສີນວນ)' }, // ro 2
  { tag: 'PSN', code: '171010001', name: 'PSN (ໂພນສີນວນ)' }, // ro 3
  { tag: 'VX',  code: '171010002', name: 'VX (ວັງຊາຍ)' },     // ro 4
  { tag: 'VX',  code: '171010002', name: 'VX (ວັງຊາຍ)' },     // ro 5
  { tag: 'VX',  code: '171010002', name: 'VX (ວັງຊาย)' },     // ro 6
  { tag: 'SVL', code: '171010003', name: 'SVL (ສີວິໄລ)' },    // ro 7
  { tag: 'SVL', code: '171010003', name: 'SVL (ສີວິໄລ)' },    // ro 8
  { tag: 'TLL', code: '171010004', name: 'TLL (ຕະຫຼາດລາວ)' }, // ro 9
  { tag: 'TLL', code: '171010004', name: 'TLL (ຕະຫຼາດລາວ)' }, // ro 10
  { tag: 'TLL', code: '171010004', name: 'TLL (ຕະຫຼາດລາວ)' }, // ro 11
  { tag: 'PTX', code: '171010005', name: 'PTX (ໂພນຕ້ອງ)' },   // ro 12
  { tag: 'PTX', code: '171010005', name: 'PTX (ໂພນຕ້ອງ)' },   // ro 13
];

roList.forEach((ro, index) => {
  const dist = branchDist[index] || branchDist[0];
  ro.branchTag = dist.tag;
  ro.storeCode = dist.code;
  ro.storeName = dist.name;
});

const demoReceivingMap = {};

// RO 1 (PSN): All OK
demoReceivingMap['ro-1'] = roList[0].items.reduce((acc, it) => {
  acc[it.id] = { received: it.roQty, remark: '' };
  return acc;
}, {});

// RO 2 (PSN): SHORT
demoReceivingMap['ro-2'] = roList[1].items.reduce((acc, it, idx) => {
  if (idx === 0) acc[it.id] = { received: Math.max(0, it.roQty - 2), remark: 'ຂາດ 2 ອັນ (DC ສົ່ງບໍ່ຄົບ)' };
  else if (idx === 2) acc[it.id] = { received: Math.max(0, it.roQty - 1), remark: 'ຂາດ 1 ອັນ' };
  else acc[it.id] = { received: it.roQty, remark: '' };
  return acc;
}, {});

// RO 3 (PSN): OVER
demoReceivingMap['ro-3'] = roList[2].items.reduce((acc, it, idx) => {
  if (idx === 0) acc[it.id] = { received: it.roQty + 2, remark: 'ເກີນ 2 ອັນ (DC ສົ່ງເກີນ)' };
  else if (idx === 1) acc[it.id] = { received: it.roQty + 1, remark: 'ເກີນ 1 ອັນ' };
  else acc[it.id] = { received: it.roQty, remark: '' };
  return acc;
}, {});

// RO 4 (VX): DIFFERENCE (both short and over)
demoReceivingMap['ro-4'] = roList[3].items.reduce((acc, it, idx) => {
  if (idx === 0) acc[it.id] = { received: it.roQty + 3, remark: 'ເກີນ 3 ອັນ' };
  else if (idx === 1) acc[it.id] = { received: Math.max(0, it.roQty - 2), remark: 'ຂາດ 2 ອັນ' };
  else acc[it.id] = { received: it.roQty, remark: '' };
  return acc;
}, {});

// RO 5 (VX): CHECKING (first 5 checked, rest null)
demoReceivingMap['ro-5'] = roList[4].items.reduce((acc, it, idx) => {
  if (idx < 5) acc[it.id] = { received: it.roQty, remark: '' };
  else acc[it.id] = { received: null, remark: '' };
  return acc;
}, {});

// RO 7 (SVL): OK
demoReceivingMap['ro-7'] = roList[6].items.reduce((acc, it) => {
  acc[it.id] = { received: it.roQty, remark: '' };
  return acc;
}, {});

// RO 9 (TLL): SHORT
demoReceivingMap['ro-9'] = roList[8].items.reduce((acc, it, idx) => {
  if (idx === 0) acc[it.id] = { received: Math.max(0, it.roQty - 1), remark: 'ຂາດ 1 ອັນ' };
  else acc[it.id] = { received: it.roQty, remark: '' };
  return acc;
}, {});

// RO 12 (PTX): CHECKING
demoReceivingMap['ro-12'] = roList[11].items.reduce((acc, it, idx) => {
  if (idx < 10) acc[it.id] = { received: it.roQty, remark: '' };
  else acc[it.id] = { received: null, remark: '' };
  return acc;
}, {});

const jsContent = `/**
 * Mock Data Generated from:
 * DC RO to Store exampo Mr.jo.xlsx
 *
 * 1. SOURCE DATA: Real products & barcodes parsed from Excel.
 * 2. MULTI-BRANCH SIMULATION:
 *    - PSN (ໂພນສີນວນ)
 *    - VX (ວັງຊາຍ)
 *    - SVL (ສີວິໄລ)
 *    - TLL (ຕະຫຼາດລາວ)
 *    - PTX (ໂພນຕ້ອງ)
 */

export const allBranches = [
  { tag: 'PSN', name: 'PSN (ໂພນສີນວນ)' },
  { tag: 'VX',  name: 'VX (ວັງຊາຍ)' },
  { tag: 'SVL', name: 'SVL (ສີວິໄລ)' },
  { tag: 'TLL', name: 'TLL (ຕະຫຼາດລາວ)' },
  { tag: 'PTX', name: 'PTX (ໂພນຕ້ອງ)' }
];

export const metadata = ${JSON.stringify(metadata, null, 2)};

export const sourceROList = ${JSON.stringify(roList, null, 2)};

export const demoReceivingMap = ${JSON.stringify(demoReceivingMap, null, 2)};
`;

fs.writeFileSync('src/features/receive-check/data/mockReceiveData.js', jsContent, 'utf8');
console.log('Successfully updated mockReceiveData.js with all 5 branches!');
