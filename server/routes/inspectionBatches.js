const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
const InspectionBatch = require('../models/inspectionBatch');

const router = express.Router();
router.use(auth);

const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('只支持 .xlsx 和 .xls 格式'));
  }
});

// ============ GET /api/inspection-batches — 批次列表 ============
router.get('/', (req, res) => {
  try {
    const batches = InspectionBatch.list();
    res.json({ code: 200, data: batches });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ POST /api/inspection-batches — 创建批次 ============
router.post('/', async (req, res) => {
  try {
    const { name, instrumentIds } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '批次名称不能为空' });

    const batch = InspectionBatch.create(name.trim());

    // 添加器具到批次
    if (instrumentIds && Array.isArray(instrumentIds) && instrumentIds.length > 0) {
      const instruments = [];
      for (const id of instrumentIds) {
        const inst = await Instrument.findById(Number(id));
        if (inst) instruments.push(inst);
      }
      if (instruments.length > 0) {
        InspectionBatch.addItems(batch.id, instruments);
      }
    }

    res.json({ code: 200, data: batch, message: '批次创建成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ GET /api/inspection-batches/:id — 批次详情 ============
router.get('/:id', (req, res) => {
  try {
    const batch = InspectionBatch.findById(Number(req.params.id));
    if (!batch) return res.status(404).json({ code: 404, message: '批次不存在' });

    const items = InspectionBatch.getItems(batch.id);
    res.json({ code: 200, data: { ...batch, items } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ PUT /api/inspection-batches/:id — 更新批次 ============
router.put('/:id', (req, res) => {
  try {
    const batch = InspectionBatch.findById(Number(req.params.id));
    if (!batch) return res.status(404).json({ code: 404, message: '批次不存在' });

    const changes = InspectionBatch.update(batch.id, req.body);
    res.json({ code: 200, data: { changes }, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ DELETE /api/inspection-batches/:id — 删除批次 ============
router.delete('/:id', (req, res) => {
  try {
    const changes = InspectionBatch.delete(Number(req.params.id));
    if (!changes) return res.status(404).json({ code: 404, message: '批次不存在' });
    res.json({ code: 200, message: '已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ POST /api/inspection-batches/:id/items — 添加器具到批次 ============
router.post('/:id/items', async (req, res) => {
  try {
    const batchId = Number(req.params.id);
    const batch = InspectionBatch.findById(batchId);
    if (!batch) return res.status(404).json({ code: 404, message: '批次不存在' });

    const { instrumentIds } = req.body;
    if (!instrumentIds || !Array.isArray(instrumentIds) || instrumentIds.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供器具ID列表' });
    }

    const instruments = [];
    for (const id of instrumentIds) {
      const inst = await Instrument.findById(Number(id));
      if (inst) instruments.push(inst);
    }

    const count = InspectionBatch.addItems(batchId, instruments);
    res.json({ code: 200, data: { added: count }, message: `已添加 ${count} 个器具` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ DELETE /api/inspection-batches/:id/items/:itemId — 移除器具 ============
router.delete('/:id/items/:itemId', (req, res) => {
  try {
    const changes = InspectionBatch.removeItem(Number(req.params.id), Number(req.params.itemId));
    if (!changes) return res.status(404).json({ code: 404, message: '项目不存在' });
    res.json({ code: 200, message: '已移除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ PUT /api/inspection-batches/:id/items/:itemId — 更新匹配状态 ============
router.put('/:id/items/:itemId', (req, res) => {
  try {
    const changes = InspectionBatch.updateItem(Number(req.params.id), Number(req.params.itemId), req.body);
    if (!changes) return res.status(404).json({ code: 404, message: '项目不存在' });
    res.json({ code: 200, data: { changes }, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ============ POST /api/inspection-batches/import — 导入申请表Excel创建批次 ============
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传Excel文件' });

    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ code: 400, message: 'Excel文件中未找到工作表' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // 检测表头行 — 查找包含"出厂编号"或"器具名称"的行
    let headerRowIdx = -1;
    const headerKeywords = ['出厂编号', '器具名称', '序号', '安装地点', '规格型号'];
    for (let i = 0; i < Math.min(raw.length, 8); i++) {
      const cells = (raw[i] || []).map(c => String(c || '').trim()).filter(Boolean);
      const matchCount = headerKeywords.filter(kw => cells.some(c => c.includes(kw))).length;
      if (matchCount >= 2) { headerRowIdx = i; break; }
    }

    if (headerRowIdx < 0) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ code: 400, message: '无法识别表格表头，请确认文件格式' });
    }

    const headers = raw[headerRowIdx].map(c => String(c || '').trim());
    const dataRows = raw.slice(headerRowIdx + 1).filter(row =>
      row.some(cell => cell !== '' && cell !== undefined && cell !== null)
    );

    // 字段映射：申请表表头 → 批次项目字段
    const fieldMap = {};
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (h.includes('器具名称') || h.includes('类别')) fieldMap.category = i;
      else if (h.includes('出厂编号') || h.includes('序列号')) fieldMap.serial_number = i;
      else if (h.includes('安装地点') || h.includes('安装位置')) fieldMap.installation_location = i;
      else if (h.includes('规格型号') || h.includes('型号')) fieldMap.model = i;
      else if (h.includes('生产厂家') || h.includes('厂家')) fieldMap.manufacturer = i;
    }

    if (!fieldMap.serial_number && fieldMap.serial_number !== 0) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ code: 400, message: '未找到"出厂编号"列，请确认文件格式' });
    }

    // 生成批次名称
    const dateLabel = new Date().toISOString().slice(0, 10);
    const batchName = '导入: ' + path.basename(req.file.originalname, path.extname(req.file.originalname)) + ' (' + dateLabel + ')';

    // 创建批次
    const batch = InspectionBatch.create(batchName);

    // 解析数据行，构建器具列表
    const items = [];
    for (const row of dataRows) {
      const serialNumber = String(row[fieldMap.serial_number] || '').trim();
      if (!serialNumber) continue; // 跳过无编号行

      items.push({
        id: 0, // 虚拟 ID，不关联系统器具
        serial_number: serialNumber,
        category: fieldMap.category !== undefined ? String(row[fieldMap.category] || '').trim() : '',
        installation_location: fieldMap.installation_location !== undefined ? String(row[fieldMap.installation_location] || '').trim() : '',
        model: fieldMap.model !== undefined ? String(row[fieldMap.model] || '').trim() : '',
        manufacturer: fieldMap.manufacturer !== undefined ? String(row[fieldMap.manufacturer] || '').trim() : '',
        certificate_number: '',
        inspection_date: '',
        valid_until: ''
      });
    }

    // 尝试匹配系统已有器具（按出厂编号）
    for (const item of items) {
      if (item.serial_number) {
        const existing = await Instrument.findBySerialNo(item.serial_number);
        if (existing) {
          item.id = existing.id;
          if (!item.category) item.category = existing.category;
          if (!item.installation_location) item.installation_location = existing.installation_location;
          item.certificate_number = existing.certificate_number || '';
          item.inspection_date = existing.inspection_date || '';
          item.valid_until = existing.valid_until || '';
        }
      }
    }

    const added = InspectionBatch.addItems(batch.id, items);

    try { fs.unlinkSync(req.file.path); } catch (_) {}

    res.json({
      code: 200,
      data: { batchId: batch.id, batchName, itemCount: added, totalRows: dataRows.length },
      message: `批次创建成功，导入了 ${added} 个器具（共 ${dataRows.length} 行数据）`
    });
  } catch (err) {
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ code: 500, message: '导入失败: ' + err.message });
  }
});

module.exports = router;
