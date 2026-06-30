const express = require('express');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
const { CATEGORY_TABLES, TABLE_CATEGORIES } = require('../models/db');

const router = express.Router();

// GET /api/dashboard/stats - 仪表盘统计
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Instrument.stats();
    res.json({ code: 200, data: stats });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取统计失败: ' + err.message });
  }
});

// GET /api/dashboard/expiring - 即将到期列表
router.get('/expiring', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const items = await Instrument.findExpiring(days);
    res.json({ code: 200, data: { items, total: items.length } });
  } catch (err) {
    res.status(500).json({ code: 500, message: '查询失败: ' + err.message });
  }
});

// GET /api/dashboard/categories - 类别列表
router.get('/categories', auth, async (req, res) => {
  res.json({ code: 200, data: Object.keys(CATEGORY_TABLES) });
});

module.exports = router;
