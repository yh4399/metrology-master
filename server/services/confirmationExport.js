const ExcelJS = require('exceljs');

// 列定义 — 严格按照样本格式
const COLS = [
  { key: 'seq',       label: '序号',           width: 6  },
  { key: 'category',  label: '器具名称',        width: 12 },
  { key: 'serial',    label: '器具编号',        width: 16 },
  { key: 'model',     label: '规格型号',        width: 12 },
  { key: 'accuracy',  label: '准确度等级或\n最大允许误差或\n测量不确定度', width: 14 },
  { key: 'range',     label: '测量范围',        width: 14 },
  { key: 'inspDate',  label: '检测日期',        width: 12, gray: true },
  { key: 'certNum',   label: '证书编号',        width: 24, gray: true },
  { key: 'inspUnit',  label: '检测单位',        width: 16, gray: true },
  { key: 'detResult', label: '检测结果',        width: 12 },
  { key: 'location',  label: '计量点',          width: 18, gray: true },
  { key: 'fRange',    label: '测量范围',        width: 14 },
  { key: 'fAccuracy', label: '准确度等级或\n最大允许误差或\n测量不确定度', width: 14 },
  { key: 'sealLabel', label: '封印和标签\n是否完好',    width: 12, gray: true },
  { key: 'confResult',label: '确认结果',        width: 12 },
  { key: 'remarks',   label: '备注',            width: 12 }
];

const GRAY_COLS = new Set([0, 6, 7, 8, 10, 13]); // 0-based: A, G, H, I, K, N

function generate(confirmationInfo, items) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metrology Master';
  const ws = wb.addWorksheet('Sheet1');

  const usingUnit = confirmationInfo.usingUnit || '';
  const confDate = confirmationInfo.confirmationDate || '';
  const confPerson = confirmationInfo.confirmationPerson || '';
  const approver = confirmationInfo.approver || '';

  // 格式化确认日期
  let dateStr = '    年    月    日';
  if (confDate) {
    const d = new Date(confDate);
    if (!isNaN(d.getTime())) {
      dateStr = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
    }
  }

  const dataRowCount = items.length;
  const footerRow = 5 + dataRowCount;   // 数据行从第5行开始
  const totalRows = footerRow + 1;       // 页脚在最后一行（1-based）

  // ============ 定义通用样式 ============
  const thinBorder = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  };
  const headerFont = (size) => ({ name: '宋体', size, charset: 134 });
  const dataSongFont = { name: '宋体', size: 10, charset: 134, scheme: 'minor' };
  const dataYaheiFont = { name: '微软雅黑', size: 10, charset: 134 };
  const headerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const dataCenterAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const dataLeftAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const grayFill = { type: 'pattern', pattern: 'solid', fgColor: { theme: 0 }, bgColor: { indexed: 64 } };
  const noFill = { type: 'pattern', pattern: 'none' };

  // ============ 设置列宽 ============
  COLS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  // ============ Row 1: 标题 ============
  ws.mergeCells(1, 1, 1, 16);
  const titleCell = ws.getCell('A1');
  titleCell.value = '计量确认记录表';
  titleCell.font = { name: '宋体', bold: true, size: 24, charset: 134 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 59;

  // ============ Row 2: 使用单位（标题行，无边框） ============
  ws.mergeCells(2, 1, 2, 16);
  const unitCell = ws.getCell('A2');
  unitCell.value = `使用单位：${usingUnit}`;
  unitCell.font = { name: '宋体', size: 11, charset: 134 };
  unitCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(2).height = 24;

  // ============ Row 3: 分组表头 ============
  ws.getRow(3).height = 27;
  // A3:A4 合并 — "序号"
  ws.mergeCells(3, 1, 4, 1);
  // B3:F3 合并 — "器具基础信息"
  ws.mergeCells(3, 2, 3, 6);
  // G3:J3 合并 — "检测信息"
  ws.mergeCells(3, 7, 3, 10);
  // K3:M3 合并 — "现场计量要求"
  ws.mergeCells(3, 11, 3, 13);
  // N3:N4 合并 — "封印和标签是否完好"
  ws.mergeCells(3, 14, 4, 14);
  // O3:O4 合并 — "确认结果"
  ws.mergeCells(3, 15, 4, 15);
  // P3:P4 合并 — "备注"
  ws.mergeCells(3, 16, 4, 16);

  const groupHeaders = [
    { cell: 'A3', text: '序号', fontSz: 10 },
    { cell: 'B3', text: '器具基础信息', fontSz: 11 },
    { cell: 'G3', text: '检测信息', fontSz: 11 },
    { cell: 'K3', text: '现场计量要求', fontSz: 11 },
    { cell: 'N3', text: '封印和标签是否完好', fontSz: 10 },
    { cell: 'O3', text: '确认结果', fontSz: 10 },
    { cell: 'P3', text: '备注', fontSz: 10 }
  ];

  for (const gh of groupHeaders) {
    const cell = ws.getCell(gh.cell);
    cell.value = gh.text;
    cell.font = headerFont(gh.fontSz);
    cell.alignment = headerAlign;
    cell.border = thinBorder;
    cell.fill = noFill;
  }

  // ============ Row 4: 列标题 ============
  ws.getRow(4).height = 53;
  const colHeaders = [
    null, // A is merged from row 3
    '器具名称', '器具编号', '规格型号',
    '准确度等级或最大允许误差或测量不确定度', '测量范围',
    '检测日期', '证书编号', '检测单位', '检测结果',
    '计量点', '测量范围', '准确度等级或最大允许误差或测量不确定度',
    null, null, null // N, O, P merged from row 3
  ];

  for (let c = 0; c < 16; c++) {
    const cell = ws.getCell(4, c + 1);
    if (colHeaders[c]) {
      cell.value = colHeaders[c];
    }
    cell.font = { name: '宋体', size: 10, charset: 134, scheme: 'minor' };
    cell.alignment = headerAlign;
    cell.border = thinBorder;
    cell.fill = noFill;
  }

  // ============ 数据行 ============
  for (let i = 0; i < dataRowCount; i++) {
    const rowNum = 5 + i;
    const item = items[i];
    ws.getRow(rowNum).height = 16.5;

    const rowData = [
      i + 1,                                          // A: 序号
      item.category || '',                            // B: 器具名称
      item.serial_number || '',                       // C: 器具编号
      item.model || '',                               // D: 规格型号
      item.accuracy_class || '',                      // E: 准确度等级
      item.range || '',                               // F: 测量范围
      item.inspection_date || '',                     // G: 检测日期
      item.certificate_number || '',                  // H: 证书编号
      item.inspection_unit || '',                     // I: 检测单位
      item.detectionResult || '',                     // J: 检测结果
      item.installation_location || '',               // K: 计量点
      item.fieldRange || item.range || '',            // L: 现场测量范围
      item.fieldAccuracy || item.accuracy_class || '',// M: 现场准确度
      item.sealLabelIntact || '完好',                 // N: 封印和标签
      item.confirmationResult || '符合使用要求',      // O: 确认结果
      item.remarks || ''                              // P: 备注
    ];

    for (let c = 0; c < 16; c++) {
      const cell = ws.getCell(rowNum, c + 1);
      cell.value = rowData[c];
      cell.border = thinBorder;
      cell.alignment = dataCenterAlign;

      if (GRAY_COLS.has(c)) {
        // 灰色背景列
        cell.fill = grayFill;
        cell.font = dataYaheiFont;
        // K 列（计量点）左对齐
        if (c === 10) cell.alignment = dataLeftAlign;
      } else {
        cell.fill = noFill;
        cell.font = { ...dataSongFont, color: { theme: 1 } };
      }

      // 序号列特殊处理：宋体无 color.theme:1
      if (c === 0) {
        cell.font = dataSongFont;
      }
    }
  }

  // ============ 页脚行 ============
  const footerText = `确认时间：${dateStr}                                                    确认人：${confPerson}                                         批准人：${approver}`;
  ws.mergeCells(footerRow, 1, footerRow, 16);
  const footerCell = ws.getCell(footerRow, 1);
  footerCell.value = footerText;
  footerCell.font = { name: '宋体', size: 11, charset: 134, scheme: 'minor' };
  footerCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(footerRow).height = 39;

  // 确保页脚行无边框
  for (let c = 1; c <= 16; c++) {
    ws.getCell(footerRow, c).border = {};
  }

  // ============ 打印设置 ============
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.paperSize = 9; // A4
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;

  return wb;
}

module.exports = { generate };
