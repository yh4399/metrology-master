const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
const ValidityRules = require('../models/validityRules');
const excelService = require('../services/excel');

const router = express.Router();
router.use(auth);

// ============ 文件上传配置 ============
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1000) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx 和 .xls 格式'));
    }
  }
});

const photoStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'photos'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'photo_' + Date.now() + '-' + Math.round(Math.random() * 1000) + ext);
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG/PNG/GIF/BMP/WebP 格式'));
    }
  }
});

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
const certsDir = path.join(uploadsDir, 'certificates');
if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

// 单个证书 PDF 上传
const certFileUpload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('仅支持PDF文件'));
  }
});

// ============ GET /api/instruments/categories/list ============
router.get('/categories/list', async (req, res) => {
  try {
    const cats = await Instrument.categories();
    const preset = [
      '普通压力表', '耐震压力表', '压力变送器', '温度变送器', '温度计',
      '液位计', '流量计', '差压变送器', '热电偶',
      '热电阻', '双金属温度计', '真空表', '电接点压力表',
      '压力开关', '温度开关', '称重传感器', '其他'
    ];
    const merged = [...new Set([...preset, ...cats])];
    res.json({ code: 200, data: merged });
  } catch (err) {
    console.error('获取类别错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ============ GET /api/instruments/stats ============
router.get('/stats', async (req, res) => {
  try {
    const stats = await Instrument.stats();
    res.json({ code: 200, data: stats });
  } catch (err) {
    console.error('获取统计错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ============ GET /api/instruments ============
router.get('/', async (req, res) => {
  try {
    const result = await Instrument.list(req.query);
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error('查询错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ============ DELETE /api/instruments/clear-all ============
// ⚠️ 必须在 DELETE /:id 之前注册，否则 "clear-all" 会被当作 :id 匹配
router.delete('/clear-all', async (req, res) => {
  try {
    const database = require('../models/db');
    const countRow = database.queryAll('SELECT COUNT(*) as cnt FROM instruments')[0];
    const count = countRow ? countRow.cnt : 0;
    database.transaction(() => {
      database.run('DELETE FROM instrument_versions');
      database.run('DELETE FROM instruments');
      database.run('DELETE FROM import_logs');
    });
    res.json({ code: 200, message: '已清空全部数据', data: { deleted: count } });
  } catch (err) {
    console.error('清空数据错误:', err);
    res.status(500).json({ code: 500, message: '清空失败' });
  }
});

// ============ DELETE /api/instruments/clear-by-category ============
// ⚠️ 必须在 DELETE /:id 之前注册
router.delete('/clear-by-category', async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) {
      return res.status(400).json({ code: 400, message: '请指定要清空的类别' });
    }
    const result = await Instrument.deleteByCategory(category);
    res.json({
      code: 200,
      message: `已清空类别"${category}"下的 ${result.deleted} 条数据`,
      data: result
    });
  } catch (err) {
    console.error('按类别清空数据错误:', err);
    res.status(500).json({ code: 500, message: '清空失败: ' + err.message });
  }
});

// ============ GET /api/instruments/export ============
// 按模板格式导出：按类别分Sheet，列标题和顺序与模板一致
// 支持参数: ids (逗号分隔的ID列表), category, keyword, status, validFrom, validTo
router.get('/export', async (req, res) => {
  try {
    let rows;
    if (req.query.ids) {
      const ids = req.query.ids.split(',').map(Number).filter(Boolean);
      rows = await Instrument.findByIds(ids);
    } else {
      rows = await Instrument.findAll(req.query);
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ code: 400, message: '没有符合条件的数据可导出' });
    }

    const { EXPORT_SHEET_CONFIGS, extractValue, fmtExportDate } = excelService;

    // 按 category 分组（同时记录到配置的类别组）
    const categoryGroups = {};
    const unmatchedRows = [];

    for (const row of rows) {
      const cat = row.category || '';
      // 查找匹配的 sheet 配置
      let matchedSheet = null;
      for (const cfg of EXPORT_SHEET_CONFIGS) {
        if (cfg.categories.includes(cat)) {
          matchedSheet = cfg;
          break;
        }
      }
      if (matchedSheet) {
        if (!categoryGroups[matchedSheet.name]) categoryGroups[matchedSheet.name] = [];
        categoryGroups[matchedSheet.name].push(row);
      } else if (cat) {
        unmatchedRows.push(row);
      }
    }

    const workbook = new ExcelJS.Workbook();

    // 辅助：创建通用表格样式
    const applyHeaderStyle = (cell) => {
      cell.font = { bold: true, size: 11, name: '宋体', color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    };

    const applyDataStyle = (cell, isCenter) => {
      cell.font = { size: 10, name: '宋体' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
      cell.alignment = {
        horizontal: isCenter ? 'center' : 'left',
        vertical: 'middle',
        wrapText: true
      };
    };

    // 遍历所有 sheet 配置（包括空类别，保留空表）
    for (const cfg of EXPORT_SHEET_CONFIGS) {
      const sheetRows = categoryGroups[cfg.name] || [];
      const colCount = cfg.columns.length;

      const sheet = workbook.addWorksheet(cfg.name);
      let currentRow = 1;

      // === 标题行（第1行，合并单元格） ===
      if (!cfg.noTitleRow) {
        const titleRow = sheet.addRow(Array(colCount).fill(cfg.title));
        sheet.mergeCells(1, 1, 1, colCount);
        const titleCell = titleRow.getCell(1);
        titleCell.font = { bold: true, size: 14, name: '宋体' };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleRow.height = 30;
        currentRow++;
      }

      // === 表头行 ===
      const headerRow = sheet.addRow(cfg.columns.map(c => c.label));
      headerRow.eachCell(applyHeaderStyle);
      headerRow.height = 32;
      const headerRowNum = currentRow;
      currentRow++;

      // === 设置列宽 ===
      cfg.columns.forEach((col, i) => {
        if (col.width) {
          sheet.getColumn(i + 1).width = col.width;
        }
      });

      // === 数据行 ===
      for (let i = 0; i < sheetRows.length; i++) {
        const row = sheetRows[i];
        const values = cfg.columns.map((col) => {
          if (col.field === 'formula') {
            // 序号列：公式 =ROW()-2（模板风格）
            return null; // 后面用公式填充
          }
          let val = extractValue(row, col);
          if (col.type === 'date') {
            return fmtExportDate(val);
          }
          return val !== null && val !== undefined ? val : '';
        });

        const dataRow = sheet.addRow(values);

        // 序号列：1-based 序号
        const seqCell = dataRow.getCell(1);
        if (cfg.columns[0].field === 'formula') {
          seqCell.value = i + 1;
          seqCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        dataRow.eachCell((cell, colNum) => {
          // 序号列居中，其余左对齐
          applyDataStyle(cell, colNum === 1);
        });
        dataRow.height = 28;
      }

      // 如果没有数据行，保留空表头
      if (sheetRows.length === 0) {
        // 空表：仍保留标题和表头
      }

      // === 冻结表头 ===
      if (!cfg.noTitleRow) {
        sheet.views = [{ state: 'frozen', ySplit: 2 }];
      } else {
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
      }

      // === 打印设置 ===
      sheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        paperSize: 9 // A4
      };
    }

    // 如果有未匹配到任何 sheet 的类别数据，追加一个通用 Sheet
    if (unmatchedRows.length > 0) {
      const sheet = workbook.addWorksheet('其他类别');

      const titleRow = sheet.addRow(['未匹配模板的仪表数据']);
      sheet.mergeCells(1, 1, 1, 17);
      titleRow.getCell(1).font = { bold: true, size: 14, name: '宋体' };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const genericHeaders = ['序号', '器具类别', '出厂编号', '型号', '生产厂家', '安装位置', '量程下限', '量程上限', '单位',
        '准确度等级', '证书编号', '检验日期', '有效日期', '检验单位', '状态', '所属部门', '备注'];
      const headerRow = sheet.addRow(genericHeaders);
      headerRow.eachCell(applyHeaderStyle);

      const statusLabel = {
        active: '在用', scrapped: '报废', borrowed: '借出', maintenance: '维修'
      };

      for (let i = 0; i < unmatchedRows.length; i++) {
        const row = unmatchedRows[i];
        sheet.addRow([
          i + 1,
          row.category || '', row.serial_number || '', row.model || '',
          row.manufacturer || '', row.installation_location || '',
          row.range_min != null ? row.range_min : '',
          row.range_max != null ? row.range_max : '',
          row.range_unit || '',
          row.accuracy_class || '',
          row.certificate_number || '',
          fmtExportDate(row.inspection_date),
          fmtExportDate(row.valid_until),
          row.inspection_unit || '',
          statusLabel[row.status] || row.status || '',
          row.department || '',
          row.remark || ''
        ]);
      }

      sheet.views = [{ state: 'frozen', ySplit: 2 }];
    }

    // 如果没有任何数据，也返回带有所有空 sheet 的文件
    const filename = `计量器具台账总表_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('导出错误:', err);
    res.status(500).json({ code: 500, message: '导出失败: ' + err.message });
  }
});

// ============ 导出列定义（自定义列选择用） ============
const EXPORT_FIELD_MAP = {
  category: '器具类别',
  serial_number: '出厂编号',
  installation_location: '安装位置',
  model: '规格型号',
  manufacturer: '生产厂家',
  certificate_number: '证书编号',
  inspection_date: '检验日期',
  valid_until: '有效日期',
  inspection_unit: '检验单位',
  accuracy_class: '准确度等级',
  status: '状态',
  department: '所属部门',
  range_min: '量程下限',
  range_max: '量程上限',
  range_unit: '量程单位',
  mfg_date: '出厂日期',
  inspection_result: '检验结果',
  remark: '备注'
};

// 解析 columns 参数，返回要导出的字段列表
function parseExportColumns(query) {
  if (!query.columns || !String(query.columns).trim()) return null;
  const requested = String(query.columns).split(',').map(s => s.trim()).filter(Boolean);
  const valid = requested.filter(f => EXPORT_FIELD_MAP[f]);
  return valid.length > 0 ? valid : null;
}

// 根据字段列表构建导出数据行
function buildExportRow(row, fields, statusLabel) {
  return fields.map(f => {
    switch (f) {
      case 'status': return statusLabel[row.status] || row.status || '';
      case 'range_min': return row.range_min != null ? row.range_min : '';
      case 'range_max': return row.range_max != null ? row.range_max : '';
      case 'range_unit': return row.range_unit || '';
      case 'mfg_date': {
        const ef = row.extra_fields || {};
        const parsed = typeof ef === 'string' ? (() => { try { return JSON.parse(ef); } catch (_) { return {}; } })() : ef;
        return parsed.mfg_date || '';
      }
      default: return row[f] != null ? row[f] : '';
    }
  });
}

// ============ GET /api/instruments/export/management-summary ============
// 导出格式严格按照"计量器具管理一览表"模板
// 支持参数: ids (逗号分隔的ID列表), category, keyword, status, validFrom, validTo
router.get('/export/management-summary', async (req, res) => {
  try {
    let rows;
    if (req.query.ids) {
      const ids = req.query.ids.split(',').map(Number).filter(Boolean);
      rows = await Instrument.findByIds(ids);
    } else {
      rows = await Instrument.findAll(req.query);
    }

    // 按类别分组
    const categoryGroups = {};
    for (const row of rows) {
      const cat = row.category || '其他';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(row);
    }

    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '没有符合条件的数据可导出' });
    }

    const workbook = new ExcelJS.Workbook();

    const statusLabel = {
      active: '在用', scrapped: '报废', borrowed: '借出', maintenance: '维修'
    };

    // 每个类别一个Sheet
    for (const [cat, catRows] of Object.entries(categoryGroups)) {
      if (catRows.length === 0) continue;

      // Sheet名限制31字符
      const sheetName = cat.length > 28 ? cat.substring(0, 28) + '..' : cat;
      const sheet = workbook.addWorksheet(sheetName);

      // 列宽 — 匹配参考文档
      const colWidths = [5, 10, 12, 16, 6, 11, 6, 10, 20, 7];
      colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

      // ====== 第1行：标题 ======
      const titleRow = sheet.addRow([`中心一号B生产二层平台计量器具一览表（${cat}）`]);
      sheet.mergeCells(1, 1, 1, 10);
      const titleCell = titleRow.getCell(1);
      titleCell.font = { bold: true, size: 14, name: '宋体' };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 27;

      // ====== 第2行：表头 ======
      const headers = ['序号', '器具名称', '出厂编号', '安装位置', '器具状态', '检测日期', '检验周期', '有效日期', '管理标识', '备注'];
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11, name: '宋体', color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });
      headerRow.height = 42;

      // ====== 数据行 ======
      for (let i = 0; i < catRows.length; i++) {
        const row = catRows[i];

        // 检验周期：尝试从 extra_fields 提取，否则计算 inspection_date → valid_until
        let inspectionCycle = '';
        if (row.extra_fields) {
          try {
            const extra = typeof row.extra_fields === 'string' ? JSON.parse(row.extra_fields) : row.extra_fields;
            inspectionCycle = extra.inspection_cycle || extra.检验周期 || '';
          } catch (e) { /* ignore */ }
        }
        if (!inspectionCycle && row.inspection_date && row.valid_until) {
          const d1 = new Date(row.inspection_date);
          const d2 = new Date(row.valid_until);
          const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
          if (months > 0 && months <= 60) inspectionCycle = months;
        }

        // 管理标识：从 extra_fields 提取
        let managementLabel = '';
        if (row.extra_fields) {
          try {
            const extra = typeof row.extra_fields === 'string' ? JSON.parse(row.extra_fields) : row.extra_fields;
            managementLabel = extra.management_label || extra.管理标识 || extra.classification || '';
          } catch (e) { /* ignore */ }
        }

        // 日期格式化为 YYYY.MM.DD
        const fmtDate = (d) => {
          if (!d) return '';
          const s = String(d).slice(0, 10);
          return s.replace(/-/g, '.');
        };

        const dataRow = sheet.addRow([
          i + 1,
          row.category || '',
          row.serial_number || '',
          row.installation_location || '',
          statusLabel[row.status] || row.status || '在用',
          fmtDate(row.inspection_date),
          inspectionCycle,
          fmtDate(row.valid_until),
          managementLabel,
          row.remark || ''
        ]);

        dataRow.eachCell((cell, colNumber) => {
          cell.font = { size: 10, name: '宋体' };
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', wrapText: true };
          // 序号、器具名称、器具状态、检验周期列居中
          if ([1, 2, 5, 7].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          }
        });
        dataRow.height = 68;
      }

      // 冻结表头
      sheet.views = [{ state: 'frozen', ySplit: 2 }];

      // 打印设置
      sheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        paperSize: 9
      };
    }

    const filename = `计量器具管理一览表_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('管理一览表导出错误:', err);
    res.status(500).json({ code: 500, message: '导出失败' });
  }
});

// ============ GET /api/instruments/export/warning-apply ============
// 导出格式参照"计量器具检定申请表"模板
router.get('/export/warning-apply', async (req, res) => {
  try {
    let rows;
    if (req.query.ids) {
      const ids = req.query.ids.split(',').map(Number).filter(Boolean);
      rows = await Instrument.findByIds(ids);
    } else {
      rows = await Instrument.findAll(req.query);
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ code: 400, message: '没有符合条件的数据可导出' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('计量器具检定申请');

    // 设置列宽
    const colWidths = [6, 14, 14, 12, 16, 18, 18, 22, 18, 10, 20];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    // 检测自定义列
    const customColumns = parseExportColumns(req.query);

    // ====== 标题行 ======
    const titleColSpan = customColumns ? customColumns.length + 1 : 11;
    const titleRow = sheet.addRow(['计量器具检定申请表']);
    sheet.mergeCells(1, 1, 1, titleColSpan);
    titleRow.getCell(1).font = { bold: true, size: 16, name: '宋体' };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 36;

    // ====== 单位行 ======
    const unitRow = sheet.addRow(['单位(盖章)：']);
    sheet.mergeCells(2, 1, 2, titleColSpan);
    unitRow.getCell(1).font = { size: 11, name: '宋体' };
    unitRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    unitRow.height = 28;

    // ====== 表头行 ======
    let headers;
    if (customColumns) {
      headers = customColumns.map(f => EXPORT_FIELD_MAP[f]);
    } else {
      headers = ['序号', '器具名称', '规格型号', '准确度等级', '测量范围',
        '出厂编号', '生产厂家', '安装地点', '检定单位(推荐)', '检定要求', '备注'];
    }
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 11, name: '宋体', color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    headerRow.height = 30;

    // 设置列宽
    if (customColumns) {
      headers.forEach((_, i) => { sheet.getColumn(i + 1).width = 16; });
    }

    // ====== 数据行 ======
    const statusLabel = { active: '在用', scrapped: '报废', borrowed: '借出', maintenance: '维修' };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      let values;
      if (customColumns) {
        values = [i + 1, ...customColumns.map(f => {
          if (f === 'status') return statusLabel[row.status] || row.status || '';
          if (f === 'range_min') return row.range_min != null ? row.range_min : '';
          if (f === 'range_max') return row.range_max != null ? row.range_max : '';
          if (f === 'range_unit') return row.range_unit || '';
          if (f === 'mfg_date') return row.extra_fields ? (() => { try { const ef = typeof row.extra_fields === 'string' ? JSON.parse(row.extra_fields) : row.extra_fields; return ef.mfg_date || ''; } catch (_) { return ''; } })() : '';
          return row[f] != null ? row[f] : '';
        })];
      } else {
        const rangeStr = (row.range_min !== null && row.range_max !== null)
          ? `${row.range_min} ~ ${row.range_max}${row.range_unit ? ' ' + row.range_unit : ''}`
          : (row.range_min !== null ? String(row.range_min) : (row.range_max !== null ? String(row.range_max) : ''));
        values = [
          i + 1, row.category || '', row.model || '', row.accuracy_class || '',
          rangeStr, row.serial_number || '', row.manufacturer || '',
          row.installation_location || '', row.inspection_unit || '',
          row.inspection_result || '合格', row.remark || ''
        ];
      }

      const dataRow = sheet.addRow(values);
      dataRow.eachCell((cell) => {
        cell.font = { size: 10, name: '宋体' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
      // 序号列居中
      dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      if (!customColumns) {
        dataRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      dataRow.height = 24;
    }

    // 冻结表头
    sheet.views = [{ state: 'frozen', ySplit: 3 }];

    // 打印设置
    sheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      paperSize: 9 // A4
    };

    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const filename = `计量器具检定申请_${dateStr}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('检定申请导出错误:', err);
    res.status(500).json({ code: 500, message: '导出失败' });
  }
});

// ============ GET /api/instruments/export/ledger ============
// 导出完整台账（多Sheet Excel，按类别分组）
router.get('/export/ledger', async (req, res) => {
  try {
    const rows = await Instrument.findAll({ pageSize: 99999 });
    if (!rows || rows.length === 0) {
      return res.status(404).json({ code: 404, message: '没有数据可导出' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '计量器具管理系统';

    // Sheet 列定义（与台账总表模板对齐）
    const columns = [
      { header: '序号', key: 'index', width: 6 },
      { header: '安装位置', key: 'installation_location', width: 22 },
      { header: '规格型号', key: 'model', width: 18 },
      { header: '生产厂家', key: 'manufacturer', width: 16 },
      { header: '量程', key: 'range_str', width: 12 },
      { header: '出厂编号', key: 'serial_number', width: 14 },
      { header: '检验时间', key: 'inspection_date', width: 12 },
      { header: '有效期', key: 'valid_until', width: 12 },
      { header: '证书编号', key: 'certificate_number', width: 26 },
      { header: '分类管理', key: 'classification', width: 8 },
      { header: '检验单位', key: 'inspection_unit', width: 18 },
      { header: '状态', key: 'status_label', width: 8 },
      { header: '准确度', key: 'accuracy_class', width: 8 },
    ];

    const statusLabel = { active: '在用', scrapped: '报废', borrowed: '借出', maintenance: '维修' };

    // 按类别分组
    const groups = {};
    for (const row of rows) {
      const cat = row.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(row);
    }

    for (const [cat, catRows] of Object.entries(groups)) {
      const sheetName = cat.length > 28 ? cat.substring(0, 28) + '..' : cat;
      const sheet = workbook.addWorksheet(sheetName);

      // 标题行
      const titleRow = sheet.addRow([cat + '台账']);
      sheet.mergeCells(1, 1, 1, columns.length);
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: 'center' };
      titleRow.height = 28;

      // 表头
      const headerRow = sheet.addRow(columns.map(c => c.header));
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // 列宽
      columns.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width; });

      // 数据行
      catRows.forEach((r, idx) => {
        const classification = (() => {
          try {
            if (!r.extra_fields) return '';
            const ef = typeof r.extra_fields === 'string' ? JSON.parse(r.extra_fields) : r.extra_fields;
            return ef.classification || '';
          } catch (_) { return ''; }
        })();

        const rangeParts = [];
        if (r.range_min != null) rangeParts.push(r.range_min);
        if (r.range_max != null) rangeParts.push('~' + r.range_max);
        if (r.range_unit) rangeParts.push(r.range_unit);

        sheet.addRow([
          idx + 1,
          r.installation_location || '',
          r.model || '',
          r.manufacturer || '',
          rangeParts.join(' '),
          r.serial_number || '',
          r.inspection_date || '',
          r.valid_until || '',
          r.certificate_number || '',
          classification,
          r.inspection_unit || '',
          statusLabel[r.status] || r.status || '',
          r.accuracy_class || ''
        ]);
      });
    }

    const fileName = '台账总表_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(fileName));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('台账导出失败:', err);
    res.status(500).json({ code: 500, message: '导出失败: ' + err.message });
  }
});

// ============ 台账总表存储（fixed routes before /:id） ============
const ledgerFilePath = path.join(__dirname, '..', 'uploads', 'ledger', '台账总表.xlsx');

// GET /api/instruments/ledger/info — 检查台账总表是否存在
router.get('/ledger/info', (req, res) => {
  try {
    const exists = fs.existsSync(ledgerFilePath);
    if (!exists) return res.json({ code: 200, data: { exists: false } });
    const stat = fs.statSync(ledgerFilePath);
    res.json({
      code: 200,
      data: { exists: true, fileName: '台账总表.xlsx', size: stat.size, uploadedAt: stat.mtime.toISOString() }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/instruments/ledger — 下载台账总表
router.get('/ledger', (req, res) => {
  try {
    if (!fs.existsSync(ledgerFilePath)) {
      return res.status(404).json({ code: 404, message: '台账总表尚未上传' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'%E5%8F%B0%E8%B4%A6%E6%80%BB%E8%A1%A8.xlsx');
    res.sendFile(ledgerFilePath);
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/instruments/ledger/upload — 上传台账总表（覆盖）
const ledgerUpload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('只支持 .xlsx 和 .xls 格式'));
  }
});

router.post('/ledger/upload', ledgerUpload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传Excel文件' });
    // 覆盖保存
    if (fs.existsSync(ledgerFilePath)) fs.unlinkSync(ledgerFilePath);
    fs.renameSync(req.file.path, ledgerFilePath);
    const stat = fs.statSync(ledgerFilePath);
    res.json({
      code: 200,
      data: { fileName: '台账总表.xlsx', size: stat.size, uploadedAt: stat.mtime.toISOString() },
      message: '台账总表已保存'
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '上传失败: ' + err.message });
  }
});

// ============ Recycle bin and history APIs (fixed routes before /:id) ============
router.get('/recycle-bin/list', async (req, res) => {
  try { res.json({ code: 200, data: Instrument.listDeleted(req.query) }); }
  catch (err) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/recycle-bin/:id/restore', async (req, res) => {
  try {
    const result = Instrument.restoreDeleted(Number(req.params.id), { source: 'recycle_restore', operatorId: req.userId });
    if (!result) return res.status(404).json({ code: 404, message: '回收站中不存在该器具' });
    res.json({ code: 200, data: result, message: '恢复成功' });
  } catch (err) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/recycle-bin/:id/purge', async (req, res) => {
  try {
    const affected = Instrument.purgeDeleted(Number(req.params.id));
    if (!affected) return res.status(404).json({ code: 404, message: '回收站中不存在该器具' });
    res.json({ code: 200, data: { affected }, message: '已彻底删除' });
  } catch (err) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id/history', async (req, res) => {
  try {
    if (!Instrument.findById(Number(req.params.id))) return res.status(404).json({ code: 404, message: '记录不存在' });
    res.json({ code: 200, data: Instrument.listHistory(Number(req.params.id)) });
  } catch (err) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/history/:versionId/restore', async (req, res) => {
  try {
    if (!Instrument.findById(Number(req.params.id))) return res.status(404).json({ code: 404, message: '记录不存在或已在回收站' });
    const result = Instrument.restoreVersion(Number(req.params.id), Number(req.params.versionId), { operatorId: req.userId });
    res.json({ code: 200, data: result, message: '版本恢复成功' });
  } catch (err) {
    const status = err.message.includes('不属于') || err.message.includes('没有可恢复') ? 400 : 500;
    res.status(status).json({ code: status, message: err.message });
  }
});

// ============ GET /api/instruments/:id ============
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的ID' });

    const item = await Instrument.findById(id);
    if (!item) return res.status(404).json({ code: 404, message: '记录不存在' });

    res.json({ code: 200, data: item });
  } catch (err) {
    console.error('查询详情错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ============ POST /api/instruments ============
router.post('/', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data._changeSource;
    if (!data.category) return res.status(400).json({ code: 400, message: '器具类别不能为空' });

    if (data.extra_fields && typeof data.extra_fields === 'object') {
      data.extra_fields = JSON.stringify(data.extra_fields);
    }

    const result = await Instrument.createWithHistory(data, { source: 'manual_create', operatorId: req.userId });
    res.json({ code: 200, data: { id: result.id }, message: '新增成功' });
  } catch (err) {
    console.error('新增错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误: ' + err.message });
  }
});

// ============ PUT /api/instruments/:id ============
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的ID' });

    const exists = await Instrument.findById(id);
    if (!exists) return res.status(404).json({ code: 404, message: '记录不存在' });

    const data = { ...req.body };
    const source = data._changeSource || 'manual_edit';
    delete data._changeSource;
    if (data.extra_fields && typeof data.extra_fields === 'object') {
      data.extra_fields = JSON.stringify(data.extra_fields);
    }

    const result = await Instrument.updateWithHistory(id, data, { source, operatorId: req.userId });
    res.json({ code: 200, data: { affected: result.id ? 1 : 0, summary: result.summary, diff: result.diff }, message: '更新成功' });
  } catch (err) {
    console.error('更新错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ============ DELETE /api/instruments/:id ============
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的ID' });

    const exists = await Instrument.findById(id);
    if (!exists) return res.status(404).json({ code: 404, message: '记录不存在' });

    await Instrument.softDelete(id, { source: 'manual_delete', operatorId: req.userId });
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    console.error('删除错误:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ============ POST /api/instruments/:id/certificate ============
// 为单个器具上传证书 PDF
router.post('/:id/certificate', certFileUpload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的ID' });

    const instrument = await Instrument.findById(id);
    if (!instrument) return res.status(404).json({ code: 404, message: '器具不存在' });

    if (!req.file) return res.status(400).json({ code: 400, message: '请上传PDF文件' });

    // 文件名（不含.pdf）作为证书编号
    const certNo = req.file.originalname.replace(/\.pdf$/i, '');
    const safeCertNo = certNo.replace(/[<>:"/\\|?*]/g, '_');

    // 保存到 persisten 目录
    const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(id));
    fs.mkdirSync(certDir, { recursive: true });
    const destPath = path.join(certDir, safeCertNo + '.pdf');
    fs.copyFileSync(req.file.path, destPath);

    const updateData = {
      certificate_number: certNo,
      certificate_file: `/uploads/certificates/${id}/${safeCertNo}.pdf`
    };

    // 提取检验日期 → 计算有效日期
    const extractedDate = ValidityRules.extractInspectionDate(certNo);
    if (extractedDate) {
      updateData.inspection_date = extractedDate;
      const classification = (() => {
        try {
          if (!instrument.extra_fields) return null;
          const ef = typeof instrument.extra_fields === 'string' ? JSON.parse(instrument.extra_fields) : instrument.extra_fields;
          return String(ef.classification || '').replace(/类/g, '').trim() || null;
        } catch (_) { return null; }
      })();
      updateData.valid_until = ValidityRules.calculateValidUntil(extractedDate, instrument.category, classification);
    }

    const result = await Instrument.updateWithHistory(id, updateData, {
      source: 'manual_cert_upload', operatorId: req.userId
    });

    res.json({
      code: 200,
      data: {
        certificate_file: updateData.certificate_file,
        certificate_number: certNo,
        inspection_date: updateData.inspection_date || null,
        valid_until: updateData.valid_until || null,
        dateExtracted: !!extractedDate
      },
      message: '证书上传成功'
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '证书上传失败: ' + err.message });
  }
});

// ============ POST /api/instruments/import/upload ============
// 多Sheet版：返回所有Sheet概览供用户选择
router.post('/import/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传Excel文件' });

    const filePath = req.file.path;
    const result = await excelService.parseFile(filePath);

    // 存储文件路径供confirm阶段使用
    result._filePath = filePath;
    result._fileName = req.file.originalname;

    res.json({ code: 200, data: result });
  } catch (err) {
    console.error('导入解析错误:', err);
    res.status(400).json({ code: 400, message: err.message || '文件解析失败' });
  }
});

// ============ POST /api/instruments/import/confirm ============
// 支持两种模式：
//   A. 多Sheet独立映射（推荐）：{ fileName, filePath?, sheetMappings: [{sheetName, category, mapping}, ...] }
//   B. 旧版统一映射（兼容）：{ fileName, filePath?, mapping, sheetNames, category }
// filePath 可选：前端传回 upload 阶段返回的 _filePath，防止并发用户文件串扰
router.post('/import/confirm', async (req, res) => {
  try {
    const { filePath: clientFilePath, fileName, mapping, sheetNames, sheetName, category, sheetMappings } = req.body;

    // 解析文件路径：优先使用前端传回的精确路径（防串扰），回退到目录扫描（向后兼容）
    let filePath;
    if (clientFilePath) {
      const absPath = path.resolve(clientFilePath);
      const baseDir = path.resolve(uploadDir());
      // 路径穿越防护：确保解析后的路径在 uploads 目录内
      if (!absPath.startsWith(baseDir + path.sep) && absPath !== baseDir) {
        return res.status(400).json({ code: 400, message: '文件路径不合法' });
      }
      if (!fs.existsSync(absPath)) {
        return res.status(400).json({ code: 400, message: '上传文件已过期或不存在，请重新上传' });
      }
      filePath = absPath;
    } else {
      filePath = findUploadedFile(uploadDir());
    }

    if (!filePath) {
      return res.status(400).json({ code: 400, message: '未找到上传的文件，请重新上传' });
    }

    // ====== 模式A：多Sheet独立映射（新） ======
    if (sheetMappings && Array.isArray(sheetMappings) && sheetMappings.length > 0) {
      return handleMultiSheetImport(req, res, filePath, fileName, sheetMappings);
    }

    // ====== 模式B：旧版统一映射（向后兼容） ======
    if (!mapping || Object.keys(mapping).length === 0) {
      return res.status(400).json({ code: 400, message: '请提供列映射关系' });
    }

    // 兼容旧版单Sheet参数
    const sheetsToImport = sheetNames || (sheetName ? [sheetName] : null);
    if (!sheetsToImport || sheetsToImport.length === 0) {
      return res.status(400).json({ code: 400, message: '请指定要导入的工作表' });
    }

    // 使用旧版统一映射模式
    return handleLegacyImport(req, res, filePath, fileName, sheetsToImport, mapping, category);
  } catch (err) {
    console.error('导入确认错误:', err);
    res.status(400).json({ code: 400, message: '导入失败: ' + err.message });
  }
});

// ============ POST /api/instruments/import/resolve-conflicts ============
// 处理导入时出厂编号冲突，用户选择策略后提交
router.post('/import/resolve-conflicts', async (req, res) => {
  try {
    return await handleResolveConflicts(req, res);
  } catch (err) {
    res.status(500).json({ code: 500, message: '冲突处理失败: ' + err.message });
  }
});

function uploadDir() {
  return path.join(__dirname, '..', 'uploads');
}

function findUploadedFile(uploadDirPath) {
  let files = [];
  try {
    files = fs.readdirSync(uploadDirPath).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.xlsx', '.xls'].includes(ext) && !f.startsWith('.');
    });
  } catch (e) {
    return null;
  }
  if (files.length === 0) return null;
  // 按修改时间取最新
  files.sort((a, b) =>
    fs.statSync(path.join(uploadDirPath, b)).mtimeMs -
    fs.statSync(path.join(uploadDirPath, a)).mtimeMs
  );
  return path.join(uploadDirPath, files[0]);
}

// ============ 智能检验日期匹配 ============
// 导入台账时，若证书提取日期比台账检验日期更接近现在，则使用证书日期
function applySmartInspectionDate(data) {
  if (!data.certificate_number || !data.inspection_date) return;
  try {
    const certDate = ValidityRules.extractInspectionDate(data.certificate_number);
    if (!certDate) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const certTime = new Date(certDate + 'T00:00:00');
    const ledgerTime = new Date(data.inspection_date + 'T00:00:00');

    if (isNaN(certTime.getTime()) || isNaN(ledgerTime.getTime())) return;

    const certDiff = Math.abs(certTime - today);
    const ledgerDiff = Math.abs(ledgerTime - today);

    if (certDiff < ledgerDiff) {
      // 证书日期更接近现在 → 使用证书日期
      data.inspection_date = certDate;
    }
    // 否则保留台账日期
  } catch (_) { /* ignore */ }

  // 根据最终选定的检验日期计算有效日期
  if (data.inspection_date) {
    try {
      let cls = null;
      if (data.extra_fields) {
        const ef = typeof data.extra_fields === 'string' ? JSON.parse(data.extra_fields) : data.extra_fields;
        cls = String(ef.classification || '').replace(/类/g, '').trim() || null;
      }
      data.valid_until = ValidityRules.calculateValidUntil(data.inspection_date, data.category, cls);
    } catch (_) { /* ignore */ }
  }
}

// 新版：多Sheet独立映射导入
// filePath 由调用方传入（来自前端传回的精确路径或降级的 findUploadedFile）
async function handleMultiSheetImport(req, res, filePath, fileName, sheetMappings) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);

  // 校验所有目标Sheet是否存在
  const sheetNamesToImport = sheetMappings.map(sm => sm.sheetName);
  const missingSheets = sheetNamesToImport.filter(s => !workbook.SheetNames.includes(s));
  if (missingSheets.length > 0) {
    return res.status(400).json({ code: 400, message: '未找到指定的工作表: ' + missingSheets.join(', ') });
  }

  let totalSuccess = 0;
  let totalFail = 0;
  const allErrors = [];
  const sheetResults = [];
  const allCollectedRows = []; // { data, sheetName, sheetCategory, rowNum }

  // === Phase 1: 解析所有行，收集有效数据 ===
  for (const sm of sheetMappings) {
    const { sheetName: targetSheet, category: sheetCategory, mapping: sheetMapping } = sm;

    if (!sheetMapping || Object.keys(sheetMapping).length === 0) {
      sheetResults.push({ sheet: targetSheet, successRows: 0, failRows: 0, message: '无映射关系' });
      continue;
    }

    const worksheet = workbook.Sheets[targetSheet];
    const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    const nonEmpty = raw.filter(row =>
      row.some(cell => cell !== '' && cell !== undefined && cell !== null)
    );

    if (nonEmpty.length < 2) {
      sheetResults.push({ sheet: targetSheet, successRows: 0, failRows: 0 });
      continue;
    }

    const headerResult = detectHeaderFromRows(nonEmpty);
    const headers = headerResult.headers;
    const headerRowIdx = headerResult.headerRowIdx;
    const dataRows = nonEmpty.slice(headerRowIdx + 1);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row.some(cell => cell !== '' && cell !== undefined && cell !== null)) continue;

      const { data, errors: rowErrors } = excelService.applyMapping(
        row, headers, sheetMapping, headerRowIdx + i + 2
      );

      if (!data.category && sheetCategory) {
        data.category = sheetCategory;
      }

      const filteredErrors = rowErrors.filter(e => !e.includes('类别不能为空'));

      if (filteredErrors.length > 0) {
        failCount++;
        allErrors.push({ row: '[' + targetSheet + '] 第' + (headerRowIdx + i + 2) + '行', errors: filteredErrors });
        continue;
      }

      if (!data.category) {
        failCount++;
        allErrors.push({ row: '[' + targetSheet + '] 第' + (headerRowIdx + i + 2) + '行', errors: ['类别未映射或为空，请在上一步选择类别'] });
        continue;
      }

      applySmartInspectionDate(data);
      allCollectedRows.push({
        data,
        sheetName: targetSheet,
        sheetCategory,
        rowNum: headerRowIdx + i + 2
      });
      successCount++;
    }

    totalSuccess += successCount;
    totalFail += failCount;
    sheetResults.push({ sheet: targetSheet, successRows: successCount, failRows: failCount });
  }

  // === Phase 2: 冲突检测 ===
  const conflicts = [];
  const okRows = [];

  for (const item of allCollectedRows) {
    const { data } = item;
    if (!data.serial_number) {
      // 无编号的行直接通过（不参与冲突检测）
      okRows.push(item);
      continue;
    }

    const existing = await Instrument.findBySerialNo(String(data.serial_number));
    if (existing) {
      const conflictFields = buildConflictFields(data, existing);
      conflicts.push({
        index: conflicts.length,
        sourceSheet: item.sheetName,
        sourceRow: item.rowNum,
        importData: data,
        existingRecord: sanitizeImportForResponse(existing),
        conflictFields
      });
    } else {
      okRows.push(item);
    }
  }

  // === Phase 3: 处理 ===
  if (conflicts.length === 0) {
    // 无冲突：全部直接导入
    let importSuccess = 0, importFail = 0;
    for (const item of okRows) {
      try {
        await Instrument.createWithHistory(item.data, { source: 'excel_import', operatorId: req.userId });
        importSuccess++;
      } catch (e) {
        importFail++;
        allErrors.push({ row: '[' + item.sheetName + '] 第' + item.rowNum + '行', errors: [e.message] });
      }
    }

    totalSuccess = importSuccess;
    totalFail += importFail;

    await Instrument.createImportLog({
      file_name: (fileName || path.basename(filePath)) + ' [' + sheetNamesToImport.join(', ') + ']',
      total_rows: totalSuccess + totalFail,
      success_rows: totalSuccess,
      fail_rows: totalFail,
      error_detail: allErrors
    });

    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

    return res.json({
      code: 200,
      data: {
        sheets: sheetResults,
        totalRows: totalSuccess + totalFail,
        successRows: totalSuccess,
        failRows: totalFail,
        errors: allErrors
      }
    });
  }

  // 有冲突：先导入无冲突的行
  let importSuccess = 0, importFail = 0;
  for (const item of okRows) {
    try {
      await Instrument.createWithHistory(item.data, { source: 'excel_import', operatorId: req.userId });
      importSuccess++;
    } catch (e) {
      importFail++;
      allErrors.push({ row: '[' + item.sheetName + '] 第' + item.rowNum + '行', errors: [e.message] });
    }
  }

  // 不删除临时文件 — 冲突解决时需要重新读取
  // 记录导入日志（部分成功 + 待处理冲突）
  await Instrument.createImportLog({
    file_name: (fileName || path.basename(filePath)) + ' [部分导入，' + conflicts.length + '条冲突待处理]',
    total_rows: importSuccess + importFail + conflicts.length,
    success_rows: importSuccess,
    fail_rows: importFail,
    error_detail: allErrors
  });

  return res.json({
    code: 200,
    data: {
      sheets: sheetResults,
      totalRows: totalSuccess + totalFail,
      successRows: importSuccess,
      failRows: importFail,
      errors: allErrors,
      needsResolution: true,
      conflictCount: conflicts.length,
      conflicts,
      conflictFileData: {
        fileName: fileName || path.basename(filePath),
        filePath
      }
    }
  });
}

// 智能检测表头行
function detectHeaderFromRows(rows) {
  const allKeywords = [
    '出厂编号', '序列号', '规格型号', '生产厂家', '量程', '安装位置',
    '证书编号', '检验时间', '有效期', '检定单位', '精度', '型号', '编号',
    '分类', '厂家', '位置', '测量范围', '检验日期', '检定日期', '校准日期'
  ];

  let bestIdx = 0;
  let bestScore = 0;
  let bestHeaders = [];

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].map(c => String(c || '').trim()).filter(Boolean);
    if (cells.length < 2) continue;
    let score = 0;
    for (const cell of cells) {
      if (allKeywords.some(kw => cell.includes(kw))) score++;
    }
    if (score > bestScore) { bestScore = score; bestIdx = i; bestHeaders = rows[i].map(c => String(c || '').trim()); }
  }

  if (bestScore >= 1) {
    return { headerRowIdx: bestIdx, headers: bestHeaders };
  }

  // Fallback: 如果有标题行，使用第二行；否则第一行
  if (rows.length >= 2) {
    return { headerRowIdx: 1, headers: rows[1].map(c => String(c || '').trim()) };
  }
  return { headerRowIdx: 0, headers: rows[0].map(c => String(c || '').trim()) };
}

// 旧版：统一映射导入（向后兼容）
async function handleLegacyImport(req, res, filePath, fileName, sheetsToImport, mapping, category) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);

  let totalSuccess = 0;
  let totalFail = 0;
  const allErrors = [];
  const sheetResults = [];
  const allCollectedRows = [];

  // === Phase 1: 解析所有行 ===
  for (const targetSheet of sheetsToImport) {
    const worksheet = workbook.Sheets[targetSheet];
    const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    const nonEmpty = raw.filter(row =>
      row.some(cell => cell !== '' && cell !== undefined && cell !== null)
    );

    if (nonEmpty.length < 2) {
      sheetResults.push({ sheet: targetSheet, successRows: 0, failRows: 0 });
      continue;
    }

    const headerResult = detectHeaderFromRows(nonEmpty);
    const headers = headerResult.headers;
    const headerRowIdx = headerResult.headerRowIdx;
    const dataRows = nonEmpty.slice(headerRowIdx + 1);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row.some(cell => cell !== '' && cell !== undefined && cell !== null)) continue;

      const { data, errors: rowErrors } = excelService.applyMapping(
        row, headers, mapping, headerRowIdx + i + 2
      );

      if (!data.category && category) {
        data.category = category;
      }

      const filteredErrors = rowErrors.filter(e => !e.includes('类别不能为空'));

      if (filteredErrors.length > 0) {
        failCount++;
        allErrors.push({ row: '[' + targetSheet + '] 第' + (headerRowIdx + i + 2) + '行', errors: filteredErrors });
        continue;
      }

      if (!data.category) {
        failCount++;
        allErrors.push({ row: '[' + targetSheet + '] 第' + (headerRowIdx + i + 2) + '行', errors: ['类别未映射或为空，请在上一步选择类别'] });
        continue;
      }

      applySmartInspectionDate(data);
      allCollectedRows.push({
        data,
        sheetName: targetSheet,
        rowNum: headerRowIdx + i + 2
      });
      successCount++;
    }

    totalSuccess += successCount;
    totalFail += failCount;
    sheetResults.push({ sheet: targetSheet, successRows: successCount, failRows: failCount });
  }

  // === Phase 2: 冲突检测 ===
  const conflicts = [];
  const okRows = [];

  for (const item of allCollectedRows) {
    const { data } = item;
    if (!data.serial_number) {
      okRows.push(item);
      continue;
    }

    const existing = await Instrument.findBySerialNo(String(data.serial_number));
    if (existing) {
      const conflictFields = buildConflictFields(data, existing);
      conflicts.push({
        index: conflicts.length,
        sourceSheet: item.sheetName,
        sourceRow: item.rowNum,
        importData: data,
        existingRecord: sanitizeImportForResponse(existing),
        conflictFields
      });
    } else {
      okRows.push(item);
    }
  }

  // === Phase 3: 处理 ===
  if (conflicts.length === 0) {
    let importSuccess = 0, importFail = 0;
    for (const item of okRows) {
      try {
        await Instrument.createWithHistory(item.data, { source: 'excel_import', operatorId: req.userId });
        importSuccess++;
      } catch (e) {
        importFail++;
        allErrors.push({ row: '[' + item.sheetName + '] 第' + item.rowNum + '行', errors: [e.message] });
      }
    }

    totalSuccess = importSuccess;
    totalFail += importFail;

    await Instrument.createImportLog({
      file_name: (fileName || path.basename(filePath)) + ' [' + sheetsToImport.join(', ') + ']',
      total_rows: totalSuccess + totalFail,
      success_rows: totalSuccess,
      fail_rows: totalFail,
      error_detail: allErrors
    });

    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

    return res.json({
      code: 200,
      data: {
        sheets: sheetResults,
        totalRows: totalSuccess + totalFail,
        successRows: totalSuccess,
        failRows: totalFail,
        errors: allErrors
      }
    });
  }

  // 有冲突：先导入无冲突的行
  let importSuccess = 0, importFail = 0;
  for (const item of okRows) {
    try {
      await Instrument.createWithHistory(item.data, { source: 'excel_import', operatorId: req.userId });
      importSuccess++;
    } catch (e) {
      importFail++;
      allErrors.push({ row: '[' + item.sheetName + '] 第' + item.rowNum + '行', errors: [e.message] });
    }
  }

  await Instrument.createImportLog({
    file_name: (fileName || path.basename(filePath)) + ' [部分导入，' + conflicts.length + '条冲突待处理]',
    total_rows: importSuccess + importFail + conflicts.length,
    success_rows: importSuccess,
    fail_rows: importFail,
    error_detail: allErrors
  });

  return res.json({
    code: 200,
    data: {
      sheets: sheetResults,
      totalRows: totalSuccess + totalFail,
      successRows: importSuccess,
      failRows: importFail,
      errors: allErrors,
      needsResolution: true,
      conflictCount: conflicts.length,
      conflicts,
      conflictFileData: {
        fileName: fileName || path.basename(filePath),
        filePath
      }
    }
  });
}

// ============ POST /api/instruments/upload-photo ============
router.post('/upload-photo', photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传照片' });
    const photoUrl = '/uploads/photos/' + req.file.filename;
    res.json({
      code: 200,
      data: { photo_url: photoUrl, filename: req.file.filename, size: req.file.size },
      message: '照片上传成功'
    });
  } catch (err) {
    console.error('照片上传错误:', err);
    res.status(500).json({ code: 500, message: '照片上传失败' });
  }
});

// ============ POST /api/instruments/ocr ============
// 支持两种模式：
//   1. 上传新图片: multipart/form-data with file field "photo"
//   2. 识别已有图片: application/json with { photo_url: "..." }
router.post('/ocr', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    console.log('[OCR] JSON模式，识别已有照片');
    return ocrFromUrl(req, res);
  }
  // 否则走文件上传流程
  console.log('[OCR] 文件上传模式，Content-Type:', contentType);
  photoUpload.single('photo')(req, res, async (err) => {
    if (err) {
      console.error('[OCR] 文件上传失败:', err.message);
      return res.status(400).json({ code: 400, message: '照片上传失败: ' + err.message });
    }
    if (!req.file) {
      console.error('[OCR] 未收到文件');
      return res.status(400).json({ code: 400, message: '请上传需要识别的照片' });
    }
    console.log('[OCR] 文件已接收:', req.file.originalname, req.file.size, 'bytes');
    await ocrFromFile(req, res);
  });
});

async function ocrFromFile(req, res) {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传需要识别的照片' });

    filePath = req.file.path;
    const photoUrl = '/uploads/photos/' + req.file.filename;

    const { extracted, rawText } = await runTesseract(filePath);

    res.json({
      code: 200,
      data: { raw_text: rawText, photo_url: photoUrl, extracted },
      message: Object.keys(extracted).length > 0 ? '识别完成' : '未能识别到仪器信息，请确认照片清晰度'
    });
  } catch (err) {
    console.error('OCR错误:', err);
    res.status(500).json({ code: 500, message: 'OCR识别失败: ' + err.message });
  }
}

async function ocrFromUrl(req, res) {
  try {
    const { photo_url } = req.body;
    if (!photo_url) return res.status(400).json({ code: 400, message: '请提供照片路径' });

    // 将相对路径转为绝对路径
    const filePath = path.join(__dirname, '..', photo_url.replace(/^\/+/, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 404, message: '照片文件不存在，请重新上传' });
    }

    const { extracted, rawText } = await runTesseract(filePath);

    res.json({
      code: 200,
      data: { raw_text: rawText, photo_url, extracted },
      message: Object.keys(extracted).length > 0 ? '识别完成' : '未能识别到仪器信息，请确认照片清晰度'
    });
  } catch (err) {
    console.error('OCR(URL)错误:', err);
    res.status(500).json({ code: 500, message: 'OCR识别失败: ' + err.message });
  }
}

async function runTesseract(filePath) {
  let extracted = {};
  let rawText = '';
  let processedPath = filePath;

  try {
    // === 图片预处理：提升OCR识别率 ===
    // 对照片进行灰度化、对比度增强、二值化处理
    // 特别有助于识别仪表盘/铭牌上的文字
    try {
      // 轻量预处理：仅调整尺寸（过大缩小、过小放大）
      const { Jimp } = require('jimp');
      const resizePlugin = require('@jimp/plugin-resize');

      const image = await Jimp.read(filePath);
      console.log('[OCR] 原始图片:', image.bitmap.width, 'x', image.bitmap.height);

      let needsResize = false;
      if (image.bitmap.width > 3000) {
        resizePlugin.methods.resize(image, { w: 2000 });
        needsResize = true;
      } else if (image.bitmap.width < 800) {
        resizePlugin.methods.resize(image, { w: 1200 });
        needsResize = true;
      }

      if (needsResize) {
        const path = require('path');
        const parsedPath = path.parse(filePath);
        processedPath = path.join(parsedPath.dir, parsedPath.name + '_resized' + parsedPath.ext);
        await image.write(processedPath);
        console.log('[OCR] 尺寸调整后:', image.bitmap.width, 'x', image.bitmap.height);
      }
    } catch (preprocessErr) {
      console.warn('[OCR] 图片预处理失败，使用原始图片:', preprocessErr.message);
      processedPath = filePath;
    }

    const Tesseract = require('tesseract.js');
    console.log('[OCR] 开始Tesseract识别:', processedPath);

    // 使用 PSM 11 (稀疏文本) 模式，适合仪表盘上分散的文字
    // 同时使用 PSM 3 (默认全自动) 作为后备
    const result = await Promise.race([
      Tesseract.recognize(processedPath, 'chi_sim+eng', {
        // Tesseract 参数优化
        tessedit_pageseg_mode: '11',  // PSM 11: Sparse text — 适合仪表盘
        logger: info => {
          if (info.status === 'recognizing text') {
            console.log(`[OCR] Tesseract进度: ${Math.round(info.progress * 100)}%`);
          } else if (info.status) {
            console.log(`[OCR] Tesseract状态: ${info.status}`);
          }
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR识别超时（30秒），请尝试更小的图片')), 30000)
      )
    ]);

    rawText = result.data.text;
    console.log('[OCR] 原始文本:', rawText.substring(0, 300));

    // 如果PSM 11结果不理想，尝试PSM 3
    if (!rawText.trim() || rawText.trim().length < 10) {
      console.log('[OCR] PSM 11 结果太少，尝试 PSM 3...');
      const result2 = await Promise.race([
        Tesseract.recognize(processedPath, 'chi_sim+eng', {
          tessedit_pageseg_mode: '3',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OCR识别超时（30秒）')), 30000)
        )
      ]);
      rawText = result2.data.text;
      console.log('[OCR] PSM 3 原始文本:', rawText.substring(0, 300));
    }

    extracted = parseInstrumentText(rawText);
    console.log('[OCR] 提取字段:', Object.keys(extracted).join(', ') || '(无)');
  } catch (ocrErr) {
    console.error('[OCR] Tesseract失败:', ocrErr.message);
    throw new Error('OCR引擎未就绪，请确认已安装Tesseract: ' + ocrErr.message);
  } finally {
    // 清理预处理临时文件
    if (processedPath !== filePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
      } catch (e) { /* ignore */ }
    }
  }

  return { extracted, rawText };
}

// ============ OCR文本解析 ============
function parseInstrumentText(text) {
  if (!text || !text.trim()) return {};

  const result = {};

  // === 预处理：合并被OCR拆散的CJK字符 ===
  // OCR经常在中文之间插入空格："昆 山 圣 科" → "昆山圣科"
  // 使用循环确保所有相邻CJK字符之间的空格都被移除
  let compacted = text;
  for (let i = 0; i < 5; i++) {
    const prev = compacted;
    compacted = compacted.replace(/([一-鿿㐀-䶿])\s+([一-鿿㐀-䶿])/g, '$1$2');
    if (prev === compacted) break;
  }
  compacted = compacted.replace(/\s+/g, ' ');

  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const compactLines = compacted.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const fullText = compacted;

  console.log('[OCR] 压缩后文本:', fullText.substring(0, 300));

  // === 0. 器具类别识别 ===
  // 压力表铭牌上通常印有类别文字，按优先级匹配（更具体的优先）
  const categoryPatterns = [
    '电接点压力表', '压力变送器', '差压变送器', '温度变送器',
    '双金属温度计', '电磁流量计', '涡轮流量计', '金属管浮子流量计', '双转子流量计',
    '压力表', '真空表', '压力开关', '温度开关',
    '温度计', '温度表', '热电偶', '热电阻',
    '液位计', '流量计', '称重传感器',
  ];
  for (const cat of categoryPatterns) {
    if (fullText.includes(cat)) {
      result.category = cat;
      console.log('[OCR] 识别类别:', cat);
      break;
    }
  }
  // 未匹配预设类别时，尝试从文本中提取（更严格的匹配）
  if (!result.category) {
    // 仅匹配明确的器具类别后缀，避免 "二昆山圣科仪器" 这类误判
    const strictCatPatterns = [
      /([一-鿿]{2,4}(?:压力表|真空表|电接点压力表|温度表))/,
      /([一-鿿]{2,4}(?:变送器|传感器))/,
      /([一-鿿]{2,4}(?:温度计|液位计|流量计|湿度计|密度计|粘度计|浓度计))/,
      /([一-鿿]{2,4}(?:热电偶|热电阻))/,
      /([一-鿿]{2,4}(?:开关|阀门|调节阀))/,
    ];
    for (const pat of strictCatPatterns) {
      const m = fullText.match(pat);
      if (m) {
        result.category = m[1];
        console.log('[OCR] 推测类别:', m[1]);
        break;
      }
    }
  }

  // === 1. 生产厂家 — 通过"有限公司/仪器厂/仪表厂"等关键词反向定位 ===
  const companyPatterns = [
    /([一-鿿]{2,20}(?:有限|股份|责任)公司)/,
    /([一-鿿]{2,20}(?:仪器|仪表|计器|测控|自动化|科技|机电|电子|电气|机械)有限公司)/,
    /([一-鿿]{2,20}(?:仪器厂|仪表厂|压力表厂|传感器厂))/,
    /([一-鿿]{2,20}(?:制造|生产|科技|实业))(?:有限|责任)?公司/,
  ];
  for (const line of compactLines) {
    for (const pat of companyPatterns) {
      const m = line.match(pat);
      if (m) {
        // 向前扩展获取完整公司名
        const idx = line.indexOf(m[1]);
        const beforeText = line.substring(Math.max(0, idx - 8), idx);
        const cjkSuffix = (beforeText.match(/([一-鿿]{2,})$/) || [''])[0];
        let companyName = cjkSuffix ? cjkSuffix + m[1] : m[1];
        // 清理OCR噪声：移除开头的数字空格 + 单个孤立CJK字符（如"二"）
        companyName = companyName
          .replace(/^[\d\s]+/, '')
          .replace(/^[一-鿿](?=[一-鿿]{4,}(?:有限|股份|责任|仪器|仪表|科技|制造|实业|机电|电子|机械|自动化|测控))/, '');
        result.manufacturer = companyName;
        console.log('[OCR] 找到厂家:', companyName);
        break;
      }
    }
    if (result.manufacturer) break;
  }

  // 备选：查找包含"制造/厂家"的行
  if (!result.manufacturer) {
    for (const line of compactLines) {
      const m = line.match(/(?:厂家|制造单位|生产单位|生产厂|制造商?)[:：\s]*([一-鿿A-Za-z]{2,30})/);
      if (m) { result.manufacturer = m[1]; break; }
    }
  }

  // === 2. 出厂编号 — 标签匹配 + 铭牌位置启发式 ===
  // 标签匹配（更宽松：允许标签和值之间有噪声）
  const serialLabelRegex = /(?:出厂编号|出厂号|序列号|器具编号|自用编号|仪表编号|编号|No\.?|SN[:：]?)[:：\s]*([A-Za-z0-9\-.\s]+)/i;
  for (const line of compactLines) {
    const m = line.match(serialLabelRegex);
    if (m) {
      const raw = m[1].replace(/\s+/g, '');
      if (raw.length >= 4) {
        result.serial_number = raw.replace(/[^A-Za-z0-9\-.]/g, '');
        console.log('[OCR] 标签匹配出厂编号:', result.serial_number);
        break;
      }
    }
  }

  // 铭牌位置启发式：生产厂家行下方的数字可能是出厂编号
  if (!result.serial_number) {
    let mfrLineIdx = -1;
    for (let i = 0; i < compactLines.length; i++) {
      if (result.manufacturer && compactLines[i].includes(result.manufacturer.substring(0, Math.min(4, result.manufacturer.length)))) {
        mfrLineIdx = i;
        break;
      }
      // 或包含"生产厂家"标签
      if (/生产厂家|制造单位|生产厂|制造商?/.test(compactLines[i])) {
        mfrLineIdx = i;
        break;
      }
    }
    // 检查厂家行本身是否包含末尾数字串（如 "昆山圣科...公司 17051023"）
    if (mfrLineIdx >= 0) {
      const mfrLine = compactLines[mfrLineIdx];
      // 生产厂家行末尾的数字: 公司名后面跟的数字
      const tailNum = mfrLine.match(/(?:公司|厂家|单位|厂)\s*[：:]?\s*([\d]{5,12})\s*$/);
      if (tailNum) {
        result.serial_number = tailNum[1];
        console.log('[OCR] 厂家行末尾提取编号:', result.serial_number);
      }
    }
    // 检查厂家行的下一行（铭牌常见布局：厂家名在上，编号在下）
    if (!result.serial_number && mfrLineIdx >= 0 && mfrLineIdx + 1 < compactLines.length) {
      const nextLine = compactLines[mfrLineIdx + 1];
      // 下一行是纯数字或字母数字串（不含中文）
      const cleanNum = nextLine.match(/^[\s]*([A-Za-z0-9\-.]{4,30})[\s]*$/);
      if (cleanNum) {
        result.serial_number = cleanNum[1].replace(/\s+/g, '');
        console.log('[OCR] 厂家下行提取编号:', result.serial_number);
      }
    }
    // 再试下一行中包含数字的情况
    if (!result.serial_number && mfrLineIdx >= 0 && mfrLineIdx + 1 < compactLines.length) {
      const nextLine = compactLines[mfrLineIdx + 1];
      const numInLine = nextLine.match(/\b([\d]{5,12})\b/);
      if (numInLine && !/公司|厂|有限/.test(nextLine)) {
        result.serial_number = numInLine[1];
        console.log('[OCR] 厂家下行数字提取编号:', result.serial_number);
      }
    }
  }

  // === 3. 证书编号 — 标签匹配 ===
  const certLabelRegex = /(?:证书编号|检定证书|证书号|检定号)[:：\s]*([A-Za-z0-9\-.]+)/i;
  for (const line of compactLines) {
    const m = line.match(certLabelRegex);
    if (m && m[1].length >= 4) {
      result.certificate_number = m[1].replace(/[^A-Za-z0-9\-.]/g, '');
      console.log('[OCR] 标签匹配证书编号:', result.certificate_number);
      break;
    }
  }

  // === 4. 启发式编号提取：长数字串(>=6位)疑似编号 ===
  // 如果标签匹配失败，尝试从OCR文本中提取所有疑似编号的数字串
  const allNumbers = [];
  const numRegex = /\b([A-Z]?\d{5,}[A-Za-z0-9\-]*)\b/g;
  for (const line of compactLines) {
    let nm;
    while ((nm = numRegex.exec(line)) !== null) {
      // 过滤掉纯日期格式 (2025xxxx, 2024xxxx)
      const val = nm[1];
      if (!/^20[12]\d{4,}$/.test(val) && !/^20[12]\d[01]\d[0-3]\d$/.test(val)) {
        allNumbers.push(val);
      }
    }
  }
  console.log('[OCR] 发现数字串:', allNumbers.join(', '));

  // 如果没匹配到编号，从数字串中推断
  if (!result.serial_number && allNumbers.length >= 1) {
    // 第一个纯数字串（不含字母）作为出厂编号
    for (const n of allNumbers) {
      if (/^\d+$/.test(n) && n.length >= 6 && !result.serial_number) {
        result.serial_number = n;
        console.log('[OCR] 推断出厂编号:', n);
      }
    }
  }
  if (!result.certificate_number && allNumbers.length >= 2) {
    // 第二个数字串作为证书编号
    let found = false;
    for (const n of allNumbers) {
      if (n !== result.serial_number && !found) {
        result.certificate_number = n;
        found = true;
        console.log('[OCR] 推断证书编号:', n);
      }
    }
  }

  // === 5. 型号 — 标签匹配 + 常见型号模式 ===
  const modelLabelRegex = /(?:型号|规格|型式|Model)[:：\s]*([A-Za-z0-9\-/]+)/i;
  for (const line of compactLines) {
    const m = line.match(modelLabelRegex);
    if (m && m[1].length >= 2 && m[1].length <= 30) {
      result.model = m[1];
      break;
    }
  }
  // 常见型号模式：Y-100, YTN-150, EJA430A 等
  if (!result.model) {
    const modelPatterns = [
      /\b(Y[TN]?[-]?\d{2,4}[A-Za-z]?)\b/,
      /\b(WT[YZ]?[-]?\d{2,4})\b/,
      /\b(EJA\d{3}[A-Za-z])\b/,
      /\b([A-Z]{2,4}[-]?\d{2,4}[A-Za-z]?)\b/,
    ];
    for (const line of compactLines) {
      for (const pat of modelPatterns) {
        const m = line.match(pat);
        if (m) { result.model = m[1]; break; }
      }
      if (result.model) break;
    }
  }

  // === 6. 量程 — 多种模式 ===
  // 压力表常见量程格式: "0-0.4MPa", "0~0.4MPa", "0～0.4 MPa", "(0-0.4)MPa"
  const rangePatterns = [
    // 带标签的
    /量程[:：\s]*([\d.]+)\s*[-~～至到]\s*([\d.]+)\s*([a-zA-Z℃℉%‰]+)?/,
    /测量范围[:：\s]*([\d.]+)\s*[-~～至到]\s*([\d.]+)\s*([a-zA-Z℃℉%‰]+)?/,
    /范围[:：\s]*([\d.]+)\s*[-~～至到]\s*([\d.]+)\s*([a-zA-Z℃℉%‰]+)?/,
    // 带括号: (0-0.4)MPa
    /\(?\s*([\d.]+)\s*[-~～至到]\s*([\d.]+)\s*\)?\s*([a-zA-Z℃℉%‰]+)?/,
    // 单位在前的特殊情况: MPa 0-0.4
    /([a-zA-Z℃℉%‰]+)\s*[:：]?\s*([\d.]+)\s*[-~～至到]\s*([\d.]+)/,
    // 常见压力单位限定
    /([\d.]+)\s*[-~～至到]\s*([\d.]+)\s*(MPa|kPa|Pa|bar|psi|kgf|mmHg|mmH2O|Mpa|KPa)/i,
  ];
  for (const line of compactLines) {
    for (const pat of rangePatterns) {
      const m = line.match(pat);
      if (m) {
        // 根据不同模式提取分组
        let rMin, rMax, rUnit;
        if (pat.source.startsWith('量程') || pat.source.startsWith('测量范围') || pat.source.startsWith('范围')) {
          rMin = m[1]; rMax = m[2]; rUnit = m[3];
        } else if (pat.source.startsWith('\\(?')) {
          rMin = m[1]; rMax = m[2]; rUnit = m[3];
        } else if (pat.source.startsWith('([a-zA-Z')) {
          rUnit = m[1]; rMin = m[2]; rMax = m[3];
        } else {
          rMin = m[1]; rMax = m[2]; rUnit = m[3];
        }
        const minVal = parseFloat(rMin);
        const maxVal = parseFloat(rMax);
        if (!isNaN(minVal) && !isNaN(maxVal) && minVal < maxVal) {
          result.range_min = minVal;
          result.range_max = maxVal;
          if (rUnit) result.range_unit = rUnit.replace(/^[（(]|[）)]$/g, '');
          console.log('[OCR] 量程:', result.range_min, '~', result.range_max, result.range_unit || '');
          break;
        }
      }
    }
    if (result.range_min !== undefined) break;
  }

  // === 7. 准确度等级 ===
  // 压力表铭牌上准确度等级通常以圆圈内数字表示（如 ○1.0、①1.0）
  // OCR可能识别为 O1.0, 01.0, (1.0), 1.0级 等多种形态
  const accuracyPatterns = [
    // 标签匹配（最优先）
    /(?:准确度|精度|等级|Accuracy|准确度等级|精度等级)[:：\s]*([\d.]+)/i,
    // 圆圈/括号内的数字: ○1.0, ①1.0, O1.0, (1.0), [1.0]
    // 注意：不使用数字0作为前缀，避免 "05830038" → 准确度 "5830038" 的误判
    /[○⓪①O(（\[〔]\s*([\d.]+)\s*[)）\]〕]?/,
    // 明确标注"级": "1.0级", "1.6级"
    /\b([\d.]+)\s*级\b/,
    // 独立的小数字（准确度等级常见值 0.25~4.0），严格限定为 x.x 格式
    /\b([1-4]\.[0-9])\b/,
  ];
  for (const line of compactLines) {
    for (const pat of accuracyPatterns) {
      const m = line.match(pat);
      if (m) {
        const val = parseFloat(m[1] || m[0]);
        // 准确度等级通常在 0.01 ~ 50 范围
        if (val >= 0.01 && val <= 50) {
          result.accuracy_class = String(m[1] || m[0]).replace(/\s+/g, '');
          console.log('[OCR] 准确度:', result.accuracy_class);
          break;
        }
      }
    }
    if (result.accuracy_class) break;
  }
  // 全文中搜索准确度值（用于仪表盘中心小字）
  if (!result.accuracy_class) {
    const globalAccMatch = fullText.match(/(?:^|\s)(0?\s*[1-4]\.[0-9])(?:\s|$)/);
    if (globalAccMatch) {
      const val = parseFloat(globalAccMatch[1].replace(/\s+/g, ''));
      if (val >= 0.1 && val <= 50) {
        result.accuracy_class = String(val);
        console.log('[OCR] 全文准确度:', result.accuracy_class);
      }
    }
  }

  // === 8. 日期提取 — 多种格式 ===
  const datePatterns = [
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日]?/g,
    /(\d{4})\.(\d{2})\.(\d{2})/g,
  ];
  const dates = [];
  for (const pat of datePatterns) {
    let dm;
    while ((dm = pat.exec(fullText)) !== null) {
      const y = dm[1];
      const m = String(dm[2]).padStart(2, '0');
      const d = String(dm[3]).padStart(2, '0');
      const dateStr = y + '-' + m + '-' + d;
      // 合理日期范围
      if (parseInt(y) >= 2000 && parseInt(y) <= 2099 && parseInt(m) >= 1 && parseInt(m) <= 12) {
        dates.push(dateStr);
      }
    }
  }
  if (dates.length >= 1) result.possible_inspection_date = dates[0];
  if (dates.length >= 2) result.possible_valid_until = dates[dates.length - 1];
  console.log('[OCR] 日期:', dates.join(', '));

  // === 9. 检定单位 — 标签匹配 + 已知单位库 ===
  const unitRegex = /(?:检定单位|检验单位|校准单位|计量单位|检定机构|校准机构)[:：\s]*([一-鿿]{3,30}(?:计量|检测|校准|检定|测试)?(?:院|所|中心|公司|站|局))/;
  for (const line of compactLines) {
    const m = line.match(unitRegex);
    if (m) { result.inspection_unit = m[1]; console.log('[OCR] 检定单位:', m[1]); break; }
  }
  // 已知检定单位库匹配
  if (!result.inspection_unit) {
    const knownUnits = [
      '山东海盛海洋工程集团有限公司',
      '胜利油田分公司技术检测中心',
      '山东省计量科学研究院',
      '山东省计量检测中心',
      '东营市计量测试检定所',
      '中国测试技术研究院',
      '国家石油天然气大流量计量站',
    ];
    for (const unit of knownUnits) {
      if (fullText.includes(unit.substring(0, Math.min(4, unit.length)))) {
        result.inspection_unit = unit;
        console.log('[OCR] 已知单位匹配:', unit);
        break;
      }
    }
  }

  return result;
}

// ============ 导入冲突检测辅助 ============
function normalizeForCompare(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  return String(val).trim();
}

function buildConflictFields(importData, existingRecord) {
  const comparableFields = [
    { field: 'category', label: '类别' },
    { field: 'model', label: '型号' },
    { field: 'manufacturer', label: '生产厂家' },
    { field: 'installation_location', label: '安装位置' },
    { field: 'inspection_date', label: '检验日期' },
    { field: 'valid_until', label: '有效日期' },
    { field: 'certificate_number', label: '证书编号' },
    { field: 'range_min', label: '量程下限' },
    { field: 'range_max', label: '量程上限' },
    { field: 'range_unit', label: '量程单位' },
    { field: 'accuracy_class', label: '准确度' },
    { field: 'inspection_unit', label: '检定单位' },
    { field: 'department', label: '部门' },
    { field: 'status', label: '状态' },
  ];

  const conflicts = [];
  for (const { field, label } of comparableFields) {
    const sysVal = existingRecord[field];
    const impVal = importData[field];
    if (normalizeForCompare(sysVal) !== normalizeForCompare(impVal)) {
      conflicts.push({
        field, label,
        systemValue: sysVal != null ? sysVal : '',
        importValue: impVal != null ? impVal : ''
      });
    }
  }
  return conflicts;
}

function sanitizeImportForResponse(record) {
  if (!record) return null;
  const clean = { ...record };
  delete clean.photo_url;
  delete clean.certificate_file;
  return clean;
}

// ============ POST /api/instruments/import/resolve-conflicts ============
async function handleResolveConflicts(req, res) {
  const { filePath: clientFilePath, fileName, sheetMappings, resolutions } = req.body;

  if (!resolutions || !Array.isArray(resolutions) || resolutions.length === 0) {
    return res.status(400).json({ code: 400, message: '请提供冲突处理策略' });
  }

  let filePath;
  if (clientFilePath) {
    const absPath = path.resolve(clientFilePath);
    const baseDir = path.resolve(uploadDir());
    if (!absPath.startsWith(baseDir + path.sep) && absPath !== baseDir) {
      return res.status(400).json({ code: 400, message: '文件路径不合法' });
    }
    if (!fs.existsSync(absPath)) {
      return res.status(400).json({ code: 400, message: '上传文件已过期或不存在，请重新上传' });
    }
    filePath = absPath;
  } else {
    return res.status(400).json({ code: 400, message: '缺少文件路径，请重新上传并导入' });
  }

  let updated = 0, skipped = 0, kept = 0, created = 0;
  const errors = [];

  for (const resolution of resolutions) {
    try {
      switch (resolution.action) {
        case 'update': {
          const existing = await Instrument.findById(resolution.existingId);
          if (!existing) {
            errors.push({ index: resolution.index, error: '目标器具 #' + resolution.existingId + ' 不存在或已在回收站' });
            skipped++;
            break;
          }
          const updateData = { ...resolution.importData };
          delete updateData.serial_number;
          delete updateData.id;
          if (updateData.extra_fields && typeof updateData.extra_fields === 'object') {
            updateData.extra_fields = JSON.stringify(updateData.extra_fields);
          }
          await Instrument.updateWithHistory(resolution.existingId, updateData, {
            source: 'excel_import_overwrite',
            operatorId: req.userId
          });
          updated++;
          break;
        }
        case 'create_new': {
          const data = { ...resolution.importData };
          delete data.id;
          if (data.extra_fields && typeof data.extra_fields === 'object') {
            data.extra_fields = JSON.stringify(data.extra_fields);
          }
          await Instrument.createWithHistory(data, {
            source: 'excel_import',
            operatorId: req.userId
          });
          created++;
          break;
        }
        case 'skip':
          skipped++;
          break;
        case 'keep':
          kept++;
          break;
        default:
          skipped++;
          break;
      }
    } catch (err) {
      errors.push({ index: resolution.index, error: err.message });
    }
  }

  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

  res.json({
    code: 200,
    data: { updated, skipped, kept, created, totalProcessed: resolutions.length, errors },
    message: '冲突处理完成：更新 ' + updated + ' 条，跳过 ' + skipped + ' 条，保留 ' + kept + ' 条，新建 ' + created + ' 条'
  });
}

module.exports = router;
