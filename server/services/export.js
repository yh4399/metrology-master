const XLSX = require('xlsx');
const { queryAll, CATEGORY_TABLES } = require('../models/db');

/**
 * 生成检定申请单（按模板格式）
 * @param {Array} items - 将要过期的器具列表
 * @returns {Buffer} Excel文件
 */
function generateVerificationApplication(items) {
  const wb = XLSX.utils.book_new();

  const headers = ['序号', '器具名称', '规格型号', '准确度等级', '测量范围', '出厂编号', '生产厂家', '安装地点', '检定单位(推荐)', '检定要求', '备注'];

  const rows = items.map((item, idx) => [
    idx + 1,
    item.category || '',
    item.model_spec || '',
    item.accuracy || '',
    item.range_info || '',
    item.serial_no || '',
    item.manufacturer || '',
    item.location || '',
    item.verification_unit || '',
    '合格',
    '',
  ]);

  // 添加空行和审核人
  rows.push([]);
  rows.push(['', '', '', '审核人：', '', '', '', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet([['计量器具检定申请表'], [], ['单位(盖章)：'], [], headers, ...rows]);

  // 合并标题行
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
  ];

  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, '检定申请');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 生成管理一览表（按类别分Sheet，每Sheet按位置分组）
 * @param {string} category - 指定类别（null表示全部）
 * @returns {Buffer} Excel文件
 */
function generateManagementSummary(category = null) {
  const wb = XLSX.utils.book_new();
  const headers = ['序号', '器具名称', '出厂编号', '安装位置', '器具状态', '检测日期', '检验周期', '有效日期', '管理标识', '备注'];

  const categoriesToExport = category
    ? { [category]: CATEGORY_TABLES[category] }
    : CATEGORY_TABLES;

  for (const [cat, tableName] of Object.entries(categoriesToExport)) {
    if (!tableName) continue;

    const rows = queryAll(
      `SELECT * FROM ${tableName} ORDER BY location`,
      []
    );

    if (rows.length === 0) continue;

    const data = rows.map((r, idx) => [
      idx + 1,
      cat,
      r.serial_no || '',
      r.location || '',
      r.status || '在用',
      r.verification_date || '',
      '', // 检验周期（从extra_fields可提取）
      r.expire_date || '',
      r.classification || '',
      '',
    ]);

    // Sheet名截取前31字符
    const sheetName = cat.length > 28 ? cat.substring(0, 28) + '...' : cat;
    const ws = XLSX.utils.aoa_to_sheet([
      [`中心一号平台${cat}计量器具一览表`],
      [],
      headers,
      ...data,
    ]);

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
    ws['!cols'] = headers.map(() => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 生成预警导出（即将过期器具列表）
 */
function generateWarningExport(items) {
  const headers = ['序号', '器具类别', '安装位置', '规格型号', '出厂编号', '生产厂家', '检验日期', '有效日期', '剩余天数', '证书编号', '检定单位', '备注'];
  const now = new Date();

  const rows = items.map((item, idx) => {
    const expireDate = new Date(item.expire_date);
    const remainDays = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));
    return [
      idx + 1,
      item.category || '',
      item.location || '',
      item.model_spec || '',
      item.serial_no || '',
      item.manufacturer || '',
      item.verification_date || '',
      item.expire_date || '',
      remainDays,
      item.certificate_no || '',
      item.verification_unit || '',
      '',
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['即将到期计量器具预警清单'], [], headers, ...rows]);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, '到期预警');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { generateVerificationApplication, generateManagementSummary, generateWarningExport };
