const express = require('express');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
const { generateVerificationApplication, generateManagementSummary, generateWarningExport } = require('../services/export');

const router = express.Router();

// GET /api/export/verification-application - 导出检定申请单
router.get('/verification-application', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const items = await Instrument.findExpiring(days);
    const buf = generateVerificationApplication(items);

    const filename = encodeURIComponent('计量器具检定申请.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ code: 500, message: '导出失败: ' + err.message });
  }
});

// GET /api/export/management-summary - 导出管理一览表
router.get('/management-summary', auth, async (req, res) => {
  try {
    const { category } = req.query;
    const buf = generateManagementSummary(category || null);

    const filename = encodeURIComponent('计量器具管理一览表.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ code: 500, message: '导出失败: ' + err.message });
  }
});

// GET /api/export/warning - 导出到期预警
router.get('/warning', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const items = await Instrument.findExpiring(days);
    const buf = generateWarningExport(items);

    const filename = encodeURIComponent('到期预警清单.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ code: 500, message: '导出失败: ' + err.message });
  }
});

module.exports = router;
