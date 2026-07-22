import { createContext, useContext, useState, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const LowStockContext = createContext(null);

export function exportLowStockToExcel(itemsToExport = [], options = {}) {
    if (!itemsToExport || itemsToExport.length === 0) {
        alert('ບໍ່ມີຂໍ້ມູນສິນຄ້າສະຕ໋ອກຕໍ່າທີ່ຈະສົ່ງອອກ (No low stock items to export)');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JOAH Inventory System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Low Stock Report', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const nowStr = new Date().toLocaleString('lo-LA', { dateStyle: 'medium', timeStyle: 'short' });

    // Title Row
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '📋 ບົດລາຍງານສິນຄ້າສະຕ໋ອກຕໍ່າໜ້າຮ້ານ ແລະ ຂໍ້ແນະນຳການເຕີມສິນຄ້າ (JOAH LOW STOCK REPORT)';
    titleCell.font = { name: 'Phetsarath OT', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 36;

    // Subtitle Row
    worksheet.mergeCells('A2:K2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = `ວັນທີອອກບົດລາຍງານ: ${nowStr} | ຈຳນວນລາຍການສະຕ໋ອກຕໍ່າທັງໝົດ: ${itemsToExport.length} ລາຍການ | ຜູ້ຮັບແຈ້ງ: ພະນັກງານຝ່າຍຈັດສິນຄ້າ / ເຕີມໜ້າຮ້ານ`;
    subTitleCell.font = { name: 'Phetsarath OT', size: 10, italic: true, color: { argb: 'FF475569' } };
    subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    // Blank row
    worksheet.getRow(3).height = 10;

    // Headers
    const headers = [
        'ລຳດັບ',
        'ບາໂຄ້ດ (Barcode)',
        'ຊື່ສິນຄ້າ (Product Name)',
        'ສະຖານະ (Status)',
        'ຄົງເຫຼືອໜ້າຮ້ານ',
        'ຄວາມຈຸສູງສຸດ (Max)',
        'ຕ້ອງເຕີມ (Refill Needed)',
        'ຄົງເຫຼືອຫຼັງສາງ',
        'ໂລເຄຊັ່ນຫຼັງສາງ',
        'ໂລເຄຊັ່ນໜ້າຮ້ານ',
        'ຂໍ້ແນະນຳການປະຕິບັດງານສຳລັບພະນັກງານ (Staff Action)'
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.height = 28;
    headers.forEach((text, colIdx) => {
        const cell = headerRow.getCell(colIdx + 1);
        cell.value = text;
        cell.font = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
    });

    // Populate data
    let totalRefillNeeded = 0;
    itemsToExport.forEach((item, index) => {
        const rowIdx = index + 5;
        const row = worksheet.getRow(rowIdx);
        row.height = 24;

        totalRefillNeeded += (item.neededQty || 0);

        let severityBg = 'FFFFFFFF';
        let severityFontColor = 'FF000000';
        let severityLabel = item.statusText || 'ໃກ້ໝົດ';

        if (item.severity === 'empty') {
            severityBg = 'FFFEE2E2';
            severityFontColor = 'FF991B1B';
            severityLabel = '🔴 ໝົດສະຕ໋ອກ (Empty)';
        } else if (item.severity === 'critical') {
            severityBg = 'FFFFEDD5';
            severityFontColor = 'FF9A3412';
            severityLabel = '🟠 ວິກິດ (Critical <=10%)';
        } else {
            severityBg = 'FFFEF3C7';
            severityFontColor = 'FF92400E';
            severityLabel = '🟡 ໃກ້ໝົດ (Warning <=30%)';
        }

        const values = [
            index + 1,
            item.barcode || '-',
            item.name || '-',
            severityLabel,
            item.qty ?? 0,
            item.maxQty ?? 0,
            item.neededQty ?? 0,
            item.warehouseQty ?? 0,
            item.warehouseRack || '-',
            item.rackLocation || '-',
            item.actionInstruction || '-'
        ];

        values.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = val;
            cell.font = { name: 'Phetsarath OT', size: 10 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };

            // Formatting specifics per column
            if (colIdx === 0) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colIdx === 1) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Consolas', size: 10, bold: true };
            } else if (colIdx === 2) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
                cell.font = { name: 'Phetsarath OT', size: 10, bold: true };
            } else if (colIdx === 3) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityBg } };
                cell.font = { name: 'Phetsarath OT', size: 10, bold: true, color: { argb: severityFontColor } };
            } else if (colIdx >= 4 && colIdx <= 7) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0';
                if (colIdx === 6) { // Refill Needed
                    cell.font = { name: 'Phetsarath OT', size: 10, bold: true, color: { argb: 'FFDC2626' } };
                }
            } else if (colIdx === 8 || colIdx === 9) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF0284C7' } };
            } else if (colIdx === 10) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
                if (item.warehouseQty > 0) {
                    cell.font = { name: 'Phetsarath OT', size: 9.5, bold: true, color: { argb: 'FF059669' } };
                } else {
                    cell.font = { name: 'Phetsarath OT', size: 9.5, bold: true, color: { argb: 'FFD97706' } };
                }
            }
        });
    });

    // Summary Row at bottom
    const summaryRowIdx = itemsToExport.length + 6;
    const summaryRow = worksheet.getRow(summaryRowIdx);
    summaryRow.height = 26;

    worksheet.mergeCells(`A${summaryRowIdx}:F${summaryRowIdx}`);
    const sumLabelCell = worksheet.getCell(`A${summaryRowIdx}`);
    sumLabelCell.value = 'ລວມຍອດສິນຄ້າທີ່ຕ້ອງເບີກເຕີມທັງໝົດ (TOTAL REFILL UNITS NEEDED):';
    sumLabelCell.font = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    sumLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const sumValCell = worksheet.getCell(`G${summaryRowIdx}`);
    sumValCell.value = totalRefillNeeded;
    sumValCell.font = { name: 'Phetsarath OT', size: 12, bold: true, color: { argb: 'FFDC2626' } };
    sumValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    sumValCell.alignment = { horizontal: 'right', vertical: 'middle' };
    sumValCell.numFmt = '#,##0 ຊິ້ນ';

    // Column Widths
    const colWidths = [8, 18, 36, 24, 16, 16, 20, 18, 20, 20, 48];
    colWidths.forEach((w, i) => {
        worksheet.getColumn(i + 1).width = w;
    });

    // Save File
    const filename = options.filename || `ບົດລາຍງານສິນຄ້າສະຕ໋ອກຕໍ່າ_JOAH_${new Date().toISOString().slice(0, 10)}.xlsx`;
    workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, filename);
    });
}

export function LowStockProvider({ children }) {
    const [lowStockItems, setLowStockItems] = useState([]);

    const updateLowStock = useCallback((allItems) => {
        if (!Array.isArray(allItems)) return;

        const alerts = allItems
            .filter(item => {
                const qty = Number(item.qty ?? item.quantity ?? 0);
                const maxQty = Number(item.maxQty ?? item.max_qty ?? 0);
                if (maxQty <= 0) return false; // Skip if no Max Qty defined
                const ratio = qty / maxQty;
                return ratio <= 0.3; // 30% or lower triggers alert
            })
            .map(item => {
                const qty = Number(item.qty ?? item.quantity ?? 0);
                const maxQty = Number(item.maxQty ?? item.max_qty ?? 0);
                const warehouseQty = Number(item.warehouseQty ?? item.warehouse_qty ?? 0);
                const ratio = qty / maxQty;
                const neededQty = Math.max(0, maxQty - qty);
                const warehouseRack = item.warehouseRack || item.warehouse_rack || '-';
                const rackLocation = item.rackLocation || item.rack_location || '-';

                let severity = 'warning';
                let statusText = 'ໃກ້ໝົດ (Warning <=30%)';
                if (ratio <= 0) {
                    severity = 'empty';
                    statusText = 'ໝົດສະຕ໋ອກ (Empty)';
                } else if (ratio <= 0.1) {
                    severity = 'critical';
                    statusText = 'ວິກິດ (Critical <=10%)';
                }

                // Detailed Action Instruction for Staff (Lao language)
                let actionInstruction = '';
                if (warehouseQty > 0) {
                    const fetchQty = Math.min(neededQty, warehouseQty);
                    actionInstruction = `ເບີກຈາກຫຼັງສາງ ${fetchQty} ຊິ້ນ (ລັອກ ${warehouseRack})`;
                } else {
                    actionInstruction = `ສິນຄ້າໝົດໃນຫຼັງສາງ — ຕ້ອງສັ່ງ Request DC ເພີ່ມເຕີມ (${neededQty} ຊິ້ນ)`;
                }

                return {
                    id: item.id || item.barcode,
                    barcode: item.barcode || item.barcode_no || '-',
                    name: item.itemName || item.masterItemName || item.productName || item.product_name_la || item.name || 'ບໍ່ມີຊື່',
                    qty,
                    maxQty,
                    neededQty,
                    ratio,
                    warehouseQty,
                    warehouseRack,
                    rackLocation,
                    severity,
                    statusText,
                    actionInstruction,
                    category1: item.category1 || item.cat1 || '-',
                    category2: item.category2 || item.cat2 || '-',
                };
            })
            .sort((a, b) => a.ratio - b.ratio); // Critical alerts first

        setLowStockItems(alerts);
    }, []);

    return (
        <LowStockContext.Provider value={{ lowStockItems, updateLowStock, exportLowStockToExcel }}>
            {children}
        </LowStockContext.Provider>
    );
}

export function useLowStock() {
    const ctx = useContext(LowStockContext);
    if (!ctx) throw new Error('useLowStock must be used within LowStockProvider');
    return ctx;
}

