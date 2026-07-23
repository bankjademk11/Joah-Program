import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../utils/supabaseClient';

const LowStockContext = createContext(null);

const REFILL_INTERVAL_MS = 15 * 60 * 1000; // 15 Minutes

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

        row.getCell(1).value = index + 1;
        row.getCell(2).value = item.barcode;
        row.getCell(3).value = item.name;
        row.getCell(4).value = severityLabel;
        row.getCell(5).value = item.qty;
        row.getCell(6).value = item.maxQty;
        row.getCell(7).value = item.neededQty;
        row.getCell(8).value = item.warehouseQty;
        row.getCell(9).value = item.warehouseRack;
        row.getCell(10).value = item.rackLocation;
        row.getCell(11).value = item.actionInstruction;

        // Apply styles to cells
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityBg } };
        row.getCell(4).font = { name: 'Phetsarath OT', size: 10, bold: true, color: { argb: severityFontColor } };

        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(11).alignment = { horizontal: 'left', vertical: 'middle' };

        // Borders
        for (let c = 1; c <= 11; c++) {
            row.getCell(c).border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        }
    });

    // Summary Row
    const summaryRowIdx = itemsToExport.length + 5;
    const summaryRow = worksheet.getRow(summaryRowIdx);
    summaryRow.height = 26;

    worksheet.mergeCells(`A${summaryRowIdx}:F${summaryRowIdx}`);
    const summaryLabel = worksheet.getCell(`A${summaryRowIdx}`);
    summaryLabel.value = 'ລວມຈຳນວນຕ້ອງເຕີມທັງໝົດ (TOTAL REFILL NEEDED):';
    summaryLabel.font = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    summaryLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalCell = worksheet.getCell(`G${summaryRowIdx}`);
    totalCell.value = totalRefillNeeded;
    totalCell.font = { name: 'Phetsarath OT', size: 12, bold: true, color: { argb: 'FF2563EB' } };
    totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

    // Column widths
    const colWidths = [8, 18, 35, 22, 16, 16, 16, 16, 16, 16, 45];
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

export async function exportNegativeStockReportForGM(lowStockItems = [], options = {}) {
    const negativeItems = (lowStockItems || []).filter(item => Number(item.qty) < 0);

    // ── DEBUG: ตรวจสอบข้อมูลที่รับเข้ามา ──
    console.group('🔍 [GM Report Debug]');
    console.log('lowStockItems total:', lowStockItems.length);
    console.log('negativeItems (qty < 0):', negativeItems.length);
    console.log('Sample items:', lowStockItems.slice(0, 3).map(i => ({ barcode: i.barcode, qty: i.qty, name: i.name })));
    const activeBranch = options.branch || localStorage.getItem('joah_branch_id') || 'ຕະຫຼາດລາວ';
    console.log('activeBranch:', activeBranch);
    console.groupEnd();

    if (!negativeItems || negativeItems.length === 0) {
        alert('ບໍ່ພົບສິນຄ້າທີ່ມີສະຕ໋ອກຕິດລົບ (< 0) ໃນສາຂານີ້');
        return;
    }
    const nowStr = new Date().toLocaleString('lo-LA', { dateStyle: 'medium', timeStyle: 'short' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JOAH Auto-Diagnostic System';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('GM Diagnostic Summary', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const evidenceSheet = workbook.addWorksheet('Evidence Audit Trail', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const negativeBarcodes = negativeItems.map(i => String(i.barcode || i.id).trim()).filter(Boolean);

    let salesMap = {};
    let storeHistoryMap = {};
    let requestMap = {};
    let allEvidenceLogs = [];

    try {
        // ── 1. POS Sales ──
        // Step 1a: หา log_id ทั้งหมดของ branch นี้
        const { data: branchLogList } = await supabase
            .from('odoo_sync_logs')
            .select('id, sync_completed_at, branch_id')
            .eq('branch_id', activeBranch)
            .order('id', { ascending: false })
            .limit(2000);

        const validLogIds = (branchLogList || []).map(l => l.id);
        const logDateMap = {};
        (branchLogList || []).forEach(l => { logDateMap[l.id] = l.sync_completed_at; });

        // Query sales details for negative barcodes
        let salesQuery = supabase
            .from('odoo_sync_details')
            .select('id, barcode_no, item_name, qty_sold, log_id, old_store_qty, new_store_qty, status')
            .in('barcode_no', negativeBarcodes)
            .order('id', { ascending: false });

        if (validLogIds.length > 0) {
            salesQuery = salesQuery.in('log_id', validLogIds);
        }

        const { data: salesLogs, error: salesErr } = await salesQuery;
        if (salesErr) console.warn('[GM Export] Sales fetch error:', salesErr);

        (salesLogs || []).forEach(s => {
            const bc = String(s.barcode_no || '').trim();
            if (!bc) return;
            if (!salesMap[bc]) salesMap[bc] = { totalSold: 0, lastSaleDate: null };
            const qty = Number(s.qty_sold || 0);
            salesMap[bc].totalSold += qty;
            const eventTime = logDateMap[s.log_id];
            if (!salesMap[bc].lastSaleDate && eventTime) {
                salesMap[bc].lastSaleDate = new Date(eventTime).toLocaleString('lo-LA');
            }

            allEvidenceLogs.push({
                barcode: bc,
                name: s.item_name || '-',
                type: '🛒 ຍອດຂາຍ POS (Odoo Sales)',
                // odoo_sync_details ມີ old_store_qty / new_store_qty
                oldQty: s.old_store_qty !== null && s.old_store_qty !== undefined ? Number(s.old_store_qty) : '-',
                delta: -qty,
                newQty: s.new_store_qty !== null && s.new_store_qty !== undefined ? Number(s.new_store_qty) : '-',
                rawTime: eventTime ? new Date(eventTime).getTime() : 0,
                dateStr: eventTime ? new Date(eventTime).toLocaleString('lo-LA') : '-',
                actor: 'POS System',
            });
        });

        // ── 2. Store Inventory History ──
        const { data: storeLogs } = await supabase
            .from('store_inventory_history')
            .select('id, barcode_no, item_name, old_store_qty, new_store_qty, updated_by, updated_at, created_at, branch_id, action_type, change_reason')
            .eq('branch_id', activeBranch)
            .in('barcode_no', negativeBarcodes)
            .order('updated_at', { ascending: false });

        (storeLogs || []).forEach(sh => {
            const bc = String(sh.barcode_no || '').trim();
            if (!bc) return;
            if (!storeHistoryMap[bc]) storeHistoryMap[bc] = { totalRefilled: 0, lastRefillDate: null, lastRefilledBy: null, hasReceived: false };
            const oldQ = Number(sh.old_store_qty ?? 0);
            const newQ = Number(sh.new_store_qty ?? 0);
            const diff = newQ - oldQ;
            if (diff > 0) storeHistoryMap[bc].totalRefilled += diff;
            if (sh.action_type === 'received' || diff > 0) storeHistoryMap[bc].hasReceived = true;

            const eventTime = sh.updated_at || sh.created_at;
            if (!storeHistoryMap[bc].lastRefillDate && eventTime) {
                storeHistoryMap[bc].lastRefillDate = new Date(eventTime).toLocaleString('lo-LA');
                storeHistoryMap[bc].lastRefilledBy = sh.updated_by || '-';
            }

            const actionLabel = sh.action_type === 'received' ? '📦 ເຕີມຈາກ Request (ໜ້າຮ້ານກົດຮັບແລ້ວ)'
                : sh.action_type === 'edited' ? '✏️ ແກ້ໄຂໜ້າຮ້ານ'
                : sh.action_type === 'added' ? '➕ ເພີ່ມໜ້າຮ້ານ'
                : diff >= 0 ? '📦 ເຕີມສິນຄ້າ' : '✏️ ປ່ຽນແປງ';

            allEvidenceLogs.push({
                barcode: bc,
                name: sh.item_name || '-',
                type: actionLabel,
                oldQty: oldQ,
                delta: diff,
                newQty: newQ,
                rawTime: eventTime ? new Date(eventTime).getTime() : 0,
                dateStr: eventTime ? new Date(eventTime).toLocaleString('lo-LA') : '-',
                actor: sh.updated_by || '-',
            });
        });

        // ── 3. Store Requests Status ──
        const { data: requestLogs } = await supabase
            .from('store_requests')
            .select('id, barcode, product_name, qty, status, request_by, accepted_by, created_at, updated_at, batch_id')
            .eq('branch_id', activeBranch)
            .in('barcode', negativeBarcodes)
            .order('created_at', { ascending: false });

        (requestLogs || []).forEach(req => {
            const bc = String(req.barcode || '').trim();
            if (!bc) return;
            if (!requestMap[bc]) {
                requestMap[bc] = {
                    latestStatus: req.status,
                    qtyRequested: req.qty,
                    requestBy: req.request_by,
                    acceptedBy: req.accepted_by,
                    createdAt: req.created_at ? new Date(req.created_at).toLocaleString('lo-LA') : '-',
                    updatedAt: req.updated_at ? new Date(req.updated_at).toLocaleString('lo-LA') : '-'
                };
            }

            // ✅ ตรวจสอบว่าหน้าร้านกด Accept รับสินค้าจาก store_inventory_history แล้วหรือยัง
            const isAccepted = req.status === 'accepted' || req.status === 'approved';
            const storeReceived = storeHistoryMap[bc]?.hasReceived;

            let statusText;
            if (isAccepted && storeReceived) {
                statusText = '✅ ສາງອະນຸມັດ + ໜ້າຮ້ານກົດຮັບແລ້ວ';
            } else if (isAccepted && !storeReceived) {
                statusText = '⚠️ ສາງອະນຸມັດແລ້ວ ແຕ່ໜ້າຮ້ານ❌ຍັງບໍ່ທັນກົດຮັບ (ລືມກົດໃນ Inbox)';
            } else if (req.status === 'pending') {
                statusText = '⏳ ລໍຖ້າສາງອະນຸມັດ (Pending)';
            } else if (req.status === 'rejected') {
                statusText = '❌ ສາງປະຕິເສດ (Rejected)';
            } else {
                statusText = req.status || '-';
            }

            allEvidenceLogs.push({
                barcode: bc,
                name: req.product_name || '-',
                type: `📋 ໃບຂໍເບີກ Request: ${statusText}`,
                oldQty: '-',
                delta: Number(req.qty || 0),
                newQty: '-',
                rawTime: req.created_at ? new Date(req.created_at).getTime() : 0,
                dateStr: req.created_at ? new Date(req.created_at).toLocaleString('lo-LA') : '-',
                actor: req.request_by || '-',
            });
        });

    } catch (e) {
        console.warn('Error batch fetching evidence:', e);
    }

    // ── Executive Blue/Navy Palette Header ──
    summarySheet.mergeCells('A1:I1');
    const title1 = summarySheet.getCell('A1');
    title1.value = `📊 ບົດລາຍງານວິເຄາະສິນຄ້າສະຕ໋ອກຕິດລົບ ແລະ ຫຼັກຖານການຂາຍ/ເຕີມ (JOAH EXECUTIVE REPORT)`;
    title1.font = { name: 'Phetsarath OT', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Dark Executive Blue
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 36;

    summarySheet.mergeCells('A2:I2');
    const subTitle1 = summarySheet.getCell('A2');
    subTitle1.value = `ວັນທີອອກບົດລາຍງານ: ${nowStr} | ສາຂາ: ${activeBranch} | ຈຳນວນລາຍການຕິດລົບ: ${negativeItems.length} ລາຍການ | ຜູ້ຮັບບົດລາຍງານ: GM / ຜູ້ບໍລິຫານ`;
    subTitle1.font = { name: 'Phetsarath OT', size: 10, italic: true, color: { argb: 'FF1E293B' } };
    subTitle1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subTitle1.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(2).height = 22;

    summarySheet.getRow(3).height = 10;

    const headers1 = [
        'ລຳດັບ',
        'ບາໂຄ້ດ (Barcode)',
        'ຊື່ສິນຄ້າ (Product Name)',
        'ສະຕ໋ອກຕິດລົບ',
        'ຍອດຂາຍ POS (ລວມ)',
        'ຍອດເຕີມໜ້າຮ້ານ (ລວມ)',
        'ເຕີມລ້າສຸດໂດຍ / ວັນທີ',
        'ສະຖານະ Request DC (ສາງ/ໜ້າຮ້ານ)',
        'ຂໍ້ສະຫຼຸບສາເຫດວິເຄາະສຳລັບ GM (Auto Diagnostic Reason)'
    ];

    const hRow1 = summarySheet.getRow(4);
    hRow1.height = 28;
    headers1.forEach((text, i) => {
        const cell = hRow1.getCell(i + 1);
        cell.value = text;
        cell.font = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Slate 700 Header
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    negativeItems.forEach((item, index) => {
        const rowIdx = index + 5;
        const row = summarySheet.getRow(rowIdx);
        row.height = 28;

        const bc = String(item.barcode || item.id).trim();
        const salesInfo = salesMap[bc] || { totalSold: 0, lastSaleDate: '-' };
        const storeInfo = storeHistoryMap[bc] || { totalRefilled: 0, lastRefillDate: '-', lastRefilledBy: '-', hasReceived: false };
        const reqInfo = requestMap[bc] || null;

        // รายละเอียดสถานะ Request (สางตอบรับแมนบ่ / หน้าร้านกะเอ็ดรับเอาของแมนบ่)
        let requestStatusStr = '-';
        if (reqInfo) {
            const isAcceptedByWh = reqInfo.latestStatus === 'accepted' || reqInfo.latestStatus === 'approved';
            if (isAcceptedByWh && storeInfo.hasReceived) {
                requestStatusStr = `✅ ສາງອະນຸມັດແລ້ວ & ໜ້າຮ້ານກົດຮັບສິນຄ້າແລ້ວ (${reqInfo.qtyRequested} ຊິ້ນ)`;
            } else if (isAcceptedByWh && !storeInfo.hasReceived) {
                requestStatusStr = `⚠️ ສາງອະນຸມັດແລ້ວ ແຕ່ໜ້າຮ້ານຍັງບໍ່ທັນກົດຮັບສິນຄ້າ (${reqInfo.qtyRequested} ຊິ້ນ)`;
            } else if (reqInfo.latestStatus === 'pending') {
                requestStatusStr = `⏳ ຢູ່ລະຫວ່າງລໍຖ້າສາງອະນຸມັດ Request (${reqInfo.qtyRequested} ຊິ້ນ)`;
            } else if (reqInfo.latestStatus === 'rejected') {
                requestStatusStr = `❌ ສາງປະຕິເສດ Request`;
            }
        }

        // Auto Diagnostic Reason (ภาษาลาว)
        let reasonLao = '';
        if (reqInfo && (reqInfo.latestStatus === 'accepted' || reqInfo.latestStatus === 'approved') && !storeInfo.hasReceived) {
            reasonLao = `📦 ສາງອະນຸມັດ Request ແລ້ວ (${reqInfo.qtyRequested} ຊິ້ນ) ແຕ່ໜ້າຮ້ານຍັງບໍ່ທັນໄດ້ກົດຮັບສິນຄ້າເຂົ້າສະຕ໋ອກໜ້າຮ້ານ (ລືມກົດຮັບໃນ Inbox)`;
        } else if (storeInfo.totalRefilled === 0 && salesInfo.totalSold > 0) {
            reasonLao = `🚨 ຂາຍ POS ອອກ ${salesInfo.totalSold} ຊິ້ນ ໂດຍຍັງບໍ່ໄດ້ກົດເຕີມໜ້າຮ້ານ (+0 ຊິ້ນ) — ພະນັກງານລືມຄີຮັບເຂົ້າ`;
        } else if (salesInfo.totalSold > storeInfo.totalRefilled && storeInfo.totalRefilled > 0) {
            reasonLao = `🚨 ຍອດຂາຍ POS (${salesInfo.totalSold} ຊິ້ນ) ສູງກວ່າຈຳນວນທີ່ເຕີມ (${storeInfo.totalRefilled} ຊິ້ນ) — ອາດຍິງບາໂຄ້ດຜິດໂຕ`;
        } else {
            reasonLao = `🚨 ຍອດຂາຍເກີນສະຕ໋ອກຕັ້ງຕົ້ນ (ໜ້າຮ້ານ ${item.qty} ຊິ້ນ) — ຕ້ອງນັບສະຕ໋ອກຈິງ`;
        }

        row.getCell(1).value = index + 1;
        row.getCell(2).value = bc;
        row.getCell(3).value = item.name;
        row.getCell(4).value = item.qty;
        row.getCell(5).value = salesInfo.totalSold;
        row.getCell(6).value = storeInfo.totalRefilled;
        row.getCell(7).value = storeInfo.lastRefillDate !== '-' ? `${storeInfo.lastRefilledBy} (${storeInfo.lastRefillDate})` : '-';
        row.getCell(8).value = requestStatusStr;
        row.getCell(9).value = reasonLao;

        // Executive Soft Tone Styling
        row.getCell(4).font = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FFB91C1C' } };
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2F2' } };

        row.getCell(8).font = { name: 'Phetsarath OT', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        row.getCell(9).font = { name: 'Phetsarath OT', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber/Gold

        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        for (let c = 1; c <= 9; c++) {
            row.getCell(c).border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        }
    });

    const colWidths1 = [8, 18, 35, 16, 16, 18, 28, 40, 55];
    colWidths1.forEach((w, i) => { summarySheet.getColumn(i + 1).width = w; });

    evidenceSheet.mergeCells('A1:H1');
    const title2 = evidenceSheet.getCell('A1');
    title2.value = `📜 ຫຼັກຖານປະຫວັດການຂາຍ/ເຕີມ/Request (EVIDENCE AUDIT TRAIL LOGS - BEFORE & AFTER)`;
    title2.font = { name: 'Phetsarath OT', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    title2.alignment = { horizontal: 'center', vertical: 'middle' };
    evidenceSheet.getRow(1).height = 36;

    const headers2 = [
        'ລຳດັບ',
        'ບາໂຄ້ດ (Barcode)',
        'ຊື່ສິນຄ້າ (Product Name)',
        'ປະເພດລາຍການ (Event Type)',
        'ສະຕ໋ອກກ່ອນປ່ຽນ (Old Qty)',
        'ຈຳນວນປ່ຽນແປງ (Delta)',
        'ສະຕ໋ອກຫຼັງປ່ຽນ (New Qty)',
        'ວັນທີ-ເວລາ / ຜູ້ດຳເນີນການ (Timestamp & Actor)'
    ];
    const hRow2 = evidenceSheet.getRow(3);
    hRow2.height = 26;
    headers2.forEach((text, i) => {
        const cell = hRow2.getCell(i + 1);
        cell.value = text;
        cell.font = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // จัดกลุ่มตาม Barcode ก่อน แล้วค่อยเรียงตามเวลาล่าสุดลงมาภายในบาร์โค้ดเดียวกัน
    allEvidenceLogs.sort((a, b) => {
        if (a.barcode !== b.barcode) {
            return a.barcode.localeCompare(b.barcode);
        }
        return (b.rawTime || 0) - (a.rawTime || 0);
    });

    allEvidenceLogs.forEach((log, index) => {
        const rowIdx = index + 4;
        const row = evidenceSheet.getRow(rowIdx);
        row.height = 24;

        row.getCell(1).value = index + 1;
        row.getCell(2).value = log.barcode;
        row.getCell(3).value = log.name;
        row.getCell(4).value = log.type;
        row.getCell(5).value = log.oldQty !== null && log.oldQty !== undefined ? log.oldQty : '-';
        row.getCell(6).value = log.delta;
        row.getCell(7).value = log.newQty !== null && log.newQty !== undefined ? log.newQty : '-';
        row.getCell(8).value = `${log.dateStr} (${log.actor})`;

        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'left', vertical: 'middle' };

        // Highlight Delta
        if (log.delta < 0) {
            row.getCell(6).font = { name: 'Phetsarath OT', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        } else if (log.delta > 0) {
            row.getCell(6).font = { name: 'Phetsarath OT', size: 10, bold: true, color: { argb: 'FF16A34A' } };
        }

        for (let c = 1; c <= 8; c++) {
            row.getCell(c).border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        }
    });

    const colWidths2 = [8, 18, 35, 32, 22, 22, 22, 38];
    colWidths2.forEach((w, i) => { evidenceSheet.getColumn(i + 1).width = w; });

    const filename = `ບົດລາຍງານວິເຄາະສິນຄ້າຕິດລົບ_GM_${activeBranch}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
}

export function LowStockProvider({ children }) {
    const [lowStockItems, setLowStockItems] = useState([]);
    const [isRefillPopupOpen, setIsRefillPopupOpen] = useState(false);
    const [lastDismissedTime, setLastDismissedTime] = useState(null);
    // ✅ สาขาที่กำลังดูอยู่ (ตั้งโดย StoreResultTable ผ่าน updateLowStock)
    // ไม่เกี่ยวกับ login branch เพราะ HQ สามารถโยกดูสาขาอื่นได้
    const [viewingBranch, setViewingBranch] = useState(localStorage.getItem('joah_branch_id') || 'ຕະຫຼາດລາວ');

    // Filter ONLY items where store qty === 0 AND warehouse/DC qty > 0
    const refillableItems = lowStockItems.filter(
        (item) => item.qty === 0 && item.warehouseQty > 0
    );

    // 🔑 useRefs so the interval ALWAYS reads the LATEST values (fixes stale closure)
    const refillableCountRef = useRef(refillableItems.length);
    const lastDismissedTimeRef = useRef(lastDismissedTime);

    useEffect(() => {
        refillableCountRef.current = refillableItems.length;
    });
    useEffect(() => {
        lastDismissedTimeRef.current = lastDismissedTime;
    });

    const dismissRefillPopup = useCallback(() => {
        setIsRefillPopupOpen(false);
        setLastDismissedTime(Date.now());
    }, []);

    const triggerRefillPopupManually = useCallback(() => {
        if (refillableCountRef.current > 0) {
            setIsRefillPopupOpen(true);
        }
    }, []);

    // ⏱️ Timer: single interval created ONCE — reads fresh values via Refs
    useEffect(() => {
        const intervalId = setInterval(() => {
            const currentTime = Date.now();
            const dismissed = lastDismissedTimeRef.current;
            const hasItems = refillableCountRef.current > 0;

            if (hasItems && (!dismissed || currentTime - dismissed >= REFILL_INTERVAL_MS)) {
                setIsRefillPopupOpen(true);
            }
        }, 60 * 1000); // Check every minute

        return () => clearInterval(intervalId);
    }, []); // ← Empty deps: interval created once, reads latest via Refs

    // 🚀 Immediate trigger when items first appear (or data loads)
    useEffect(() => {
        if (refillableItems.length === 0) {
            setIsRefillPopupOpen(false);
            return;
        }
        const now = Date.now();
        const dismissed = lastDismissedTime;
        if (!dismissed || now - dismissed >= REFILL_INTERVAL_MS) {
            setIsRefillPopupOpen(true);
        }
    }, [refillableItems.length]); // ← Only triggers when item count changes

    const updateLowStock = useCallback((allItems, branch) => {
        if (!Array.isArray(allItems)) return;
        // อัปเดตสาขาที่กำลังดูเมื่อ StoreResultTable ส่งข้อมูลเข้ามา
        if (branch) setViewingBranch(branch);

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
                // dcQty = DC/หลังสาง Qty (from StoreResultTable), warehouseQty = warehouse qty (from ResultTable)
                const warehouseQty = Number(item.warehouseQty ?? item.warehouse_qty ?? item.dcQty ?? 0);
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
                };
            })
            .sort((a, b) => a.ratio - b.ratio); // Critical alerts first

        setLowStockItems(alerts);
    }, []);

    return (
        <LowStockContext.Provider
            value={{
                lowStockItems,
                refillableItems,
                isRefillPopupOpen,
                dismissRefillPopup,
                triggerRefillPopupManually,
                updateLowStock,
                exportLowStockToExcel,
                exportNegativeStockReportForGM,
                viewingBranch,  // ✅ สาขาที่กำลังดูอยู่จริง (ไม่ใช่ login branch)
            }}
        >
            {children}
        </LowStockContext.Provider>
    );
}

export function useLowStock() {
    const ctx = useContext(LowStockContext);
    if (!ctx) throw new Error('useLowStock must be used within LowStockProvider');
    return ctx;
}

