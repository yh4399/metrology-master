const XLSX = require('xlsx');

// ========== 预设仪表类别（用于数据感知智能映射） ==========
const PRESET_CATEGORIES = [
  '普通压力表', '耐震压力表', '压力变送器', '温度变送器', '温度计',
  '液位计', '流量计', '差压变送器', '热电偶',
  '热电阻', '双金属温度计', '真空表', '电接点压力表',
  '压力开关', '温度开关', '称重传感器', '其他'
];

// 压力表子类型（用于数据感知识别）
const PRESSURE_GAUGE_TYPES = ['普通压力表', '耐震压力表', '电接点压力表', '真空表'];

// ========== Sheet名 → 类别名映射 ==========
const SHEET_CATEGORY_MAP = {
  '压变': '压力变送器', '压力变送器': '压力变送器',
  '温变': '温度变送器', '温度变送器': '温度变送器',
  '压力表': '压力表', '普通压力表': '普通压力表', '耐震压力表': '耐震压力表',
  '温度表': '温度计', '温度计': '温度计', '双金属温度计': '双金属温度计',
  '电磁流量计': '流量计',
  '差压变送器': '差压变送器',
  '液位计': '液位计',
  '双转子流量计': '流量计',
  '液位开关': '压力开关',
  '油水界面': '液位计',
  '涡轮流量计': '流量计',
  '金属管浮子流量计': '流量计',
  '热电偶': '热电偶', '热电阻': '热电阻',
  '真空表': '真空表',
  '电接点压力表': '电接点压力表',
  '温度开关': '温度开关', '压力开关': '压力开关',
  '称重传感器': '称重传感器',
};

/**
 * 字段关键词匹配表 —— 覆盖各种中文表述
 * 使用最长匹配优先算法：header "仪表检定证书编号" 会优先匹配 "仪表检定证书编号"(9字)
 *   而非 "仪表编号"(4字)，确保证书编号不会被误映射为出厂编号
 * 顺序：certificate_number 必须在 serial_number 之前作为同长度下的优先选择
 */
const FIELD_PATTERNS = [
  // [系统字段, 匹配关键词列表]
  // 注意：category 放在最前面，确保"器具类别"优先于其他包含"类别"的模式
  ['category',              ['器具类别', '仪器类别', '仪表类别', '设备类别', '器具名称', '仪器名称']],
  // 注意：certificate_number 必须在 serial_number 之前
  ['certificate_number',    ['仪表检定证书编号', '检定证书编号', '证书编号', '证书号', '检定证书号', '校准证书号', '校准编号']],
  ['serial_number',         ['出厂编号', '序列号', '器具编号', '仪表编号', '自用编号', '编号']],
  ['model',                 ['规格型号', '型号规格', '型号', '规格', '型式', '仪表型号']],
  ['manufacturer',          ['生产厂家', '制造单位', '制造厂', '厂家', '供应商', '生产单位', '生产厂']],
  ['installation_location', ['安装位置', '安装地点', '使用地点', '所在位置', '位置', '安装部位', '安装区域']],
  ['accuracy_class',        ['仪表精度', '准确度等级', '准确度', '精度等级', '精度', '精确度', '精度等级']],
  ['range_info',            ['量程', '测量范围', '量程范围', '流量范围']],  // 特殊处理：含单位的量程
  ['inspection_date',       ['检验时间', '检定时间', '检验日期', '检定日期', '检测日期', '校准日期', '校验日期', '校准时间', '检定日期']],
  ['valid_until',           ['有效期', '到期时间', '有效日期', '到期日期', '下次检定日期', '有效期至', '有效期限']],
  ['inspection_unit',       ['检验单位', '检定单位', '检测单位', '校准单位', '检定机构', '校准机构', '检验机构']],
  ['department',            ['所属部门', '使用部门', '责任部门', '部门', '车间', '管理区']],
  ['status',                ['状态', '器具状态', '使用状态', '设备状态', '运行状态']],
  ['remark',                ['备注', '说明', '补充说明']],
  ['mfg_date',              ['出厂日期', '制造日期', '制造年月', '生产日期', '生产年月', '生产日期']],
  ['classification',        ['分类管理', '分类', '管理分类', '仪表类别', '器具分类']],
  ['pressure_gauge_type',   ['压力表类别', '压力表类型', '表类别', '压力表种类', '压力表名称']],
];

/**
 * 解析上传的Excel文件（多Sheet版）
 * 返回每个Sheet的概览信息，供用户选择
 */
function parseFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames.filter(n => n !== 'Sheet1' || workbook.SheetNames.length === 1);

  if (sheetNames.length === 0) throw new Error('Excel文件中没有工作表');

  const sheets = [];

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // 过滤全空行
    const nonEmptyRows = raw.filter(row =>
      row.some(cell => cell !== '' && cell !== undefined && cell !== null)
    );

    if (nonEmptyRows.length < 2) continue; // 至少需要表头+1行数据

    // 智能检测表头行：找到含有关键字段最多的行
    const headerInfo = detectHeaderRow(nonEmptyRows.slice(0, 10));
    if (!headerInfo) continue;

    const { headerRowIdx, headers } = headerInfo;
    const dataRows = nonEmptyRows.slice(headerRowIdx + 1).filter(row =>
      row.some(cell => cell !== '' && cell !== undefined && cell !== null)
    );

    if (dataRows.length === 0) continue;

    // 确定类别
    const category = guessCategory(sheetName, headers, dataRows[0]);

    // 自动映射
    const mapping = buildAutoMapping(headers);

    // 数据感知智能修正：检测列数据，自动纠正映射
    refineMapping(headers, mapping, dataRows);

    // 预览前3条
    const preview = dataRows.slice(0, 3).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
      });
      return obj;
    });

    sheets.push({
      name: sheetName,
      category,
      totalRows: dataRows.length,
      columns: headers,
      preview,
      mapping
    });
  }

  if (sheets.length === 0) throw new Error('未在任何工作表中检测到有效数据');

  return { sheets };
}

/**
 * 智能检测表头行
 * 在文件的前几行中，找到含有关键字段关键词最多的行作为表头
 */
function detectHeaderRow(rows) {
  if (rows.length === 0) return null;

  const allKeywords = FIELD_PATTERNS.flatMap(([, kws]) => kws);

  let bestIdx = -1;
  let bestScore = 0;
  let bestHeaders = [];

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].map(c => String(c || '').trim()).filter(Boolean);
    if (cells.length < 2) continue;

    let score = 0;
    for (const cell of cells) {
      for (const kw of allKeywords) {
        if (cell.includes(kw)) { score++; break; }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestHeaders = rows[i].map(c => String(c || '').trim());
    }
  }

  // 至少匹配到2个关键字
  if (bestScore >= 2) {
    return { headerRowIdx: bestIdx, headers: bestHeaders };
  }

  // 如果没找到明显的表头行，尝试用第二行（常见模式：Row0=标题, Row1=表头）
  if (rows.length >= 2) {
    const row1 = rows[1].map(c => String(c || '').trim()).filter(Boolean);
    if (row1.length >= 2) {
      return { headerRowIdx: 1, headers: rows[1].map(c => String(c || '').trim()) };
    }
  }

  // 最后尝试第一行
  const row0 = rows[0].map(c => String(c || '').trim()).filter(Boolean);
  if (row0.length >= 2) {
    return { headerRowIdx: 0, headers: rows[0].map(c => String(c || '').trim()) };
  }

  return null;
}

/**
 * 推测类别：Sheet名优先，其次根据表头和数据推断
 */
function guessCategory(sheetName, headers, firstDataRow) {
  // Sheet名直接匹配
  if (SHEET_CATEGORY_MAP[sheetName]) return SHEET_CATEGORY_MAP[sheetName];

  // 尝试部分匹配
  for (const [key, cat] of Object.entries(SHEET_CATEGORY_MAP)) {
    if (sheetName.includes(key) || key.includes(sheetName)) return cat;
  }

  // 从表头或数据中推测
  const allText = [...headers, ...(firstDataRow || []).map(c => String(c || ''))].join(' ');
  if (allText.includes('压力变送器')) return '压力变送器';
  if (allText.includes('温度变送器')) return '温度变送器';
  if (allText.includes('压力表')) return '压力表';
  if (allText.includes('温度计') || allText.includes('温度表')) return '温度计';
  if (allText.includes('流量计')) return '流量计';
  if (allText.includes('液位计')) return '液位计';
  if (allText.includes('热电偶')) return '热电偶';

  return sheetName; // 兜底：直接用Sheet名
}

/**
 * 自动映射表头 → 系统字段
 */
function buildAutoMapping(headers) {
  const mapping = {};

  for (const header of headers) {
    if (!header || header === '序号' || header.match(/^\d+$/)) continue;

    // 最长匹配优先：评估所有字段/关键词组合，选择最长的匹配
    let bestScore = 0;
    let bestField = null;
    for (const [field, keywords] of FIELD_PATTERNS) {
      for (const kw of keywords) {
        if (header.includes(kw) && kw.length > bestScore) {
          bestScore = kw.length;
          bestField = field;
        }
      }
    }
    if (bestField) mapping[header] = bestField;
  }

  return mapping;
}

/**
 * 数据感知智能修正：根据列数据内容自动纠正误映射
 * - 若某列被映射到 classification，但数据看起来像仪表类别名 → 改为 category
 * - 若某列未被映射，但数据匹配压力表子类型 → 映射到 pressure_gauge_type
 */
function refineMapping(headers, mapping, dataRows) {
  // 采样前5行数据
  const sampleSize = Math.min(5, dataRows.length);

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const header = headers[colIdx];
    if (!header) continue;
    const currentMapping = mapping[header];

    // 采样该列的非空值
    const samples = [];
    for (let r = 0; r < sampleSize; r++) {
      const val = String(dataRows[r]?.[colIdx] || '').trim();
      if (val) samples.push(val);
    }
    if (samples.length === 0) continue;

    // 情况1：已映射到 classification，但数据全是压力表子类型 → 改为 pressure_gauge_type
    if (currentMapping === 'classification') {
      const allArePressureTypes = samples.every(s => PRESSURE_GAUGE_TYPES.includes(s));
      if (allArePressureTypes) {
        mapping[header] = 'pressure_gauge_type';
        continue;
      }
      // 数据全是预设类别名 → 改为 category
      const allAreCategories = samples.every(s => PRESET_CATEGORIES.includes(s));
      if (allAreCategories) {
        mapping[header] = 'category';
        continue;
      }
    }

    // 情况2：未映射的列，检查数据是否是压力表子类型
    if (!currentMapping) {
      const allArePressureTypes = samples.every(s => PRESSURE_GAUGE_TYPES.includes(s));
      if (allArePressureTypes) {
        mapping[header] = 'pressure_gauge_type';
        continue;
      }
      // 检查数据是否全是预设类别名
      const allAreCategories = samples.every(s => PRESET_CATEGORIES.includes(s));
      if (allAreCategories) {
        mapping[header] = 'category';
        continue;
      }
    }

    // 情况3：已映射到某个字段但不是 category/pressure_gauge_type，
    // 数据是压力表子类型 → 改为 pressure_gauge_type
    // 数据全是预设类别名 → 改为 category
    if (currentMapping && currentMapping !== 'category' && currentMapping !== 'pressure_gauge_type') {
      const allArePressureTypes = samples.every(s => PRESSURE_GAUGE_TYPES.includes(s));
      if (allArePressureTypes) {
        mapping[header] = 'pressure_gauge_type';
        continue;
      }
      const allAreCategories = samples.every(s => PRESET_CATEGORIES.includes(s));
      if (allAreCategories) {
        mapping[header] = 'category';
      }
    }
  }
}

/**
 * 解析单个Sheet的完整数据（用于最终导入）
 */
function parseSheetData(workbook, sheetName, headerRowIdx) {
  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const headers = raw[headerRowIdx].map(c => String(c || '').trim());

  const dataRows = raw.slice(headerRowIdx + 1).filter(row =>
    row.some(cell => cell !== '' && cell !== undefined && cell !== null)
  );

  return { headers, dataRows };
}

/**
 * 应用列映射，将Excel行转换为数据库记录
 */
function applyMapping(rowData, headers, mapping, rowIndex) {
  const data = { status: 'active' };
  const errors = [];

  // 先收集原始值
  const rawValues = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const targetField = mapping[header];
    if (!targetField) continue;

    let val = rowData[i];
    if (val === undefined || val === null) val = '';
    if (typeof val === 'object' && val.richText) {
      val = val.richText.map(t => t.text).join('');
    } else if (val instanceof Date) {
      val = val.toISOString().slice(0, 10);
    } else {
      val = String(val).trim();
    }

    if (val === '') continue;
    rawValues[targetField] = { val, header };
  }

  // === 处理量程（range_info）: "0-4.0MPa", "0～100℃", "300～3900" ===
  if (rawValues.range_info) {
    const { val, header } = rawValues.range_info;
    // 从表头提取单位: "量程（MPa）" → "MPa", "量程(℃)" → "℃", "量程（mm）" → "mm"
    let headerUnit = null;
    const headerUnitMatch = header.match(/[（(]([a-zA-Z℃℉%]+)[）)]/);
    if (headerUnitMatch) headerUnit = headerUnitMatch[1];

    // 匹配: 数字 [-~～至到] 数字 [单位]
    const rangeMatch = val.match(/^(-?[\d.]+)\s*[-~～至到]\s*(-?[\d.]+)\s*([a-zA-Z℃℉%]+)?$/);
    if (rangeMatch) {
      data.range_min = parseFloat(rangeMatch[1]);
      data.range_max = parseFloat(rangeMatch[2]);
      data.range_unit = rangeMatch[3] || headerUnit || null;
    } else {
      // 匹配纯数字范围如 "60-600m³/h"
      const altMatch = val.match(/^(-?[\d.]+)\s*[-~]\s*(-?[\d.]+)\s*(.+)?$/);
      if (altMatch) {
        data.range_min = parseFloat(altMatch[1]);
        data.range_max = parseFloat(altMatch[2]);
        data.range_unit = altMatch[3] || headerUnit || null;
      }
    }
    delete rawValues.range_info;
  }

  // === 处理各字段 ===
  for (const [field, { val, header }] of Object.entries(rawValues)) {
    switch (field) {
      case 'serial_number': {
        // 可能是纯数字，保留原样
        const sn = val.replace(/\s+/g, '');
        data.serial_number = sn || val;
        break;
      }
      case 'certificate_number': {
        data.certificate_number = val.replace(/\s+/g, '');
        break;
      }
      case 'model': {
        data.model = val.length > 200 ? val.substring(0, 200) : val;
        break;
      }
      case 'manufacturer': {
        data.manufacturer = val.length > 200 ? val.substring(0, 200) : val;
        break;
      }
      case 'installation_location': {
        data.installation_location = val;
        break;
      }
      case 'accuracy_class': {
        const acc = val.match(/([\d.]+)/);
        data.accuracy_class = acc ? acc[1] : val;
        break;
      }
      case 'inspection_date':
      case 'valid_until':
      case 'mfg_date': {
        const dateField = field === 'mfg_date' ? 'remark' :
                          field === 'inspection_date' ? 'inspection_date' : 'valid_until';
        const normalized = normalizeDate(val);
        if (normalized) {
          if (field === 'mfg_date') {
            data.remark = (data.remark || '') + '出厂日期:' + normalized + ';';
          } else {
            data[dateField] = normalized;
          }
        } else {
          // 尝试部分日期如 "2016.05"
          const partial = val.match(/^(\d{4})[.\-/](\d{1,2})$/);
          if (partial) {
            data[dateField] = partial[1] + '-' + partial[2].padStart(2, '0') + '-01';
          }
        }
        break;
      }
      case 'inspection_unit': {
        data.inspection_unit = val;
        break;
      }
      case 'classification': {
        // 分类信息存 extra_fields.classification，与手动新增/编辑保持一致
        const extra = data.extra_fields ?
          (typeof data.extra_fields === 'string' ? JSON.parse(data.extra_fields) : data.extra_fields) : {};
        extra.classification = val;
        data.extra_fields = JSON.stringify(extra);
        // 若分类值恰好是已知的仪表类别名，则同时设置 category
        // （常见情况：Excel列名为"分类管理"但数据是"普通压力表"/"耐震压力表"等）
        if (!data.category && PRESET_CATEGORIES.includes(val)) {
          data.category = val;
        }
        break;
      }
      case 'pressure_gauge_type': {
        // 压力表类别区分："压力表类别"列值为压力表子类型时，
        // 覆盖category为具体的压力表子类型（而非通用的"压力表"）
        if (PRESSURE_GAUGE_TYPES.includes(val)) {
          data.category = val;
        }
        // 同时也存入extra_fields以便后续查阅
        const extra = data.extra_fields ?
          (typeof data.extra_fields === 'string' ? JSON.parse(data.extra_fields) : data.extra_fields) : {};
        extra.pressure_gauge_type = val;
        data.extra_fields = JSON.stringify(extra);
        break;
      }
      case 'category': {
        // 直接设置类别（优先级最高），来自列映射的类别值
        data.category = val;
        break;
      }
      case 'status': {
        const statusMap = {
          '在用': 'active', '使用中': 'active', '正常': 'active', '运行': 'active',
          '报废': 'scrapped', '已报废': 'scrapped', '停用': 'scrapped',
          '借出': 'borrowed', '已借出': 'borrowed',
          '维修': 'maintenance', '维修中': 'maintenance', '待修': 'maintenance',
        };
        data.status = statusMap[val] || 'active';
        break;
      }
      case 'department':
      case 'remark': {
        if (val) {
          data[field] = data[field] ? data[field] + val + ';' : val;
        }
        break;
      }
      case 'rangeMin': {
        const num = parseFloat(val);
        if (!isNaN(num) && data.range_min == null) {
          data.range_min = num;
        }
        break;
      }
      case 'rangeMax': {
        const num = parseFloat(val);
        if (!isNaN(num) && data.range_max == null) {
          data.range_max = num;
        }
        break;
      }
      case 'rangeUnit': {
        if (val && data.range_unit == null) {
          data.range_unit = val;
        }
        break;
      }
      default: {
        // 未识别的字段存备注
        if (val && field !== 'range_info') {
          data.remark = (data.remark || '') + field + ':' + val + ';';
        }
      }
    }
  }

  // 清理remark末尾分号
  if (data.remark) {
    data.remark = data.remark.replace(/;+$/, '');
  }

  // 必填校验
  if (!data.category) {
    errors.push(`第${rowIndex}行: 类别不能为空`);
  }

  return { data, errors };
}

/**
 * 日期归一化: 支持多种格式
 * "2026.07.11" / "2026/07/11" / "2026-07-11" / "2026年07月11日"
 * "2025.07.12" / "2016.05" (年月) / "20181221" (紧凑)
 */
function normalizeDate(val) {
  if (!val || typeof val !== 'string') {
    if (typeof val === 'number' && val > 30000 && val < 100000) {
      // Excel日期序列号
      const d = new Date((val - 25569) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  val = val.trim();
  if (!val) return null;

  // 已经是标准格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  // Excel序列号（字符串形式）
  const num = parseInt(val, 10);
  if (num > 30000 && num < 100000 && !val.includes('.') && !val.includes('-')) {
    const d = new Date((num - 25569) * 86400000);
    const result = d.toISOString().slice(0, 10);
    if (result.startsWith('19') || result.startsWith('20')) return result;
  }

  // 紧凑格式: "20181221"
  const compact = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const y = parseInt(compact[1]);
    if (y >= 2000 && y <= 2100) {
      return compact[1] + '-' + compact[2] + '-' + compact[3];
    }
  }

  // "2026.07.11" / "2026/07/11" / "2026-07-11"
  const fullMatch = val.match(/^(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (fullMatch) {
    return fullMatch[1] + '-' + fullMatch[2].padStart(2, '0') + '-' + fullMatch[3].padStart(2, '0');
  }

  // "2016.05" (只有年月)
  const ymMatch = val.match(/^(\d{4})[.\-/年](\d{1,2})$/);
  if (ymMatch) {
    return ymMatch[1] + '-' + ymMatch[2].padStart(2, '0') + '-01';
  }

  return null;
}

// 导出表头定义
const EXPORT_HEADERS = [
  { key: 'category',              label: '器具类别',  width: 14 },
  { key: 'serial_number',         label: '出厂编号',  width: 18 },
  { key: 'model',                 label: '型号',      width: 14 },
  { key: 'manufacturer',          label: '生产厂家',  width: 20 },
  { key: 'range_min',             label: '量程下限',  width: 12 },
  { key: 'range_max',             label: '量程上限',  width: 12 },
  { key: 'range_unit',            label: '单位',      width: 8  },
  { key: 'accuracy_class',        label: '准确度等级',width: 12 },
  { key: 'installation_location', label: '安装位置',  width: 20 },
  { key: 'department',            label: '所属部门',  width: 14 },
  { key: 'certificate_number',    label: '证书编号',  width: 22 },
  { key: 'inspection_date',       label: '检验日期',  width: 12 },
  { key: 'valid_until',           label: '有效日期',  width: 12 },
  { key: 'inspection_result',     label: '检验结果',  width: 10 },
  { key: 'inspection_unit',       label: '检定单位',  width: 22 },
  { key: 'status',                label: '状态',      width: 8  },
  { key: 'remark',                label: '备注',      width: 20 },
];

module.exports = { parseFile, parseSheetData, applyMapping, EXPORT_HEADERS };
