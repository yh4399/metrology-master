const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
const excelService = require('../services/excel');
const { CATEGORY_TABLES } = require('../models/db');

const router = express.Router();

// 上传临时目录
const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .xlsx / .xls 文件'));
  },
});

// POST /api/import/preview - 预览导入数据
router.post('/preview', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传文件' });

    const result = excelService.parseLedger(req.file.path);
    const preview = {};

    for (const [sheetName, sheetData] of Object.entries(result)) {
      if (!CATEGORY_TABLES[sheetName]) {
        preview[sheetName] = { headers: sheetData.headers, totalRows: sheetData.data.length, mapped: false, reason: '未识别的类别' };
        continue;
      }
      const mappedRows = excelService.mapSheetToDB(sheetName, sheetData.headers, sheetData.data.slice(0, 3));
      preview[sheetName] = {
        headers: sheetData.headers,
        totalRows: sheetData.data.length,
        mapped: true,
        tableName: CATEGORY_TABLES[sheetName],
        sample: mappedRows,
      };
    }

    res.json({ code: 200, data: { fileName: req.file.originalname, filePath: req.file.path, sheets: preview } });
  } catch (err) {
    res.status(500).json({ code: 500, message: '解析失败: ' + err.message });
  }
});

// POST /api/import/execute - 执行导入
router.post('/execute', auth, async (req, res) => {
  try {
    const { filePath, sheets: selectedSheets } = req.body;
    if (!filePath || !selectedSheets || selectedSheets.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择要导入的Sheet' });
    }

    const result = excelService.parseLedger(filePath);
    const logs = [];

    for (const sheetName of selectedSheets) {
      const sheetData = result[sheetName];
      if (!sheetData) continue;

      const mappedRows = excelService.mapSheetToDB(sheetName, sheetData.headers, sheetData.data);
      const inserted = await Instrument.batchInsert(sheetName, mappedRows);

      logs.push({ category: sheetName, total: sheetData.data.length, success: inserted, fail: sheetData.data.length - inserted });
    }

    const totalSuccess = logs.reduce((s, l) => s + l.success, 0);
    const totalRows = logs.reduce((s, l) => s + l.total, 0);

    await Instrument.createImportLog({
      file_name: path.basename(filePath),
      category: selectedSheets.join(','),
      total_rows: totalRows,
      success_rows: totalSuccess,
      fail_rows: totalRows - totalSuccess,
    });

    res.json({ code: 200, data: { logs, totalSuccess, totalRows }, message: `成功导入 ${totalSuccess}/${totalRows} 条` });
  } catch (err) {
    res.status(500).json({ code: 500, message: '导入失败: ' + err.message });
  }
});

module.exports = router;
