// 计量器具类别
export const CATEGORIES = [
  '普通压力表', '耐震压力表', '压力变送器', '温度变送器', '温度计',
  '液位计', '流量计', '差压变送器', '热电偶',
  '热电阻', '双金属温度计', '真空表', '电接点压力表',
  '压力开关', '温度开关', '称重传感器', '其他'
]

// 类别颜色映射 — 不同类别用不同颜色区分，便于快速识别
export const CATEGORY_COLORS = {
  '普通压力表':       { bg: '#ecfdf5', text: '#059669', tag: 'success' },
  '耐震压力表':       { bg: '#dbeafe', text: '#1d4ed8', tag: '' },
  '压力变送器':       { bg: '#fef3c7', text: '#b45309', tag: 'warning' },
  '温度变送器':       { bg: '#fce7f3', text: '#be185d', tag: 'danger' },
  '温度计':          { bg: '#f0f9ff', text: '#0369a1', tag: 'info' },
  '液位计':          { bg: '#f0fdf4', text: '#15803d', tag: 'success' },
  '流量计':          { bg: '#eff6ff', text: '#1e40af', tag: 'primary' },
  '差压变送器':       { bg: '#fefce8', text: '#a16207', tag: 'warning' },
  '热电偶':          { bg: '#fdf2f8', text: '#9d174d', tag: 'danger' },
  '热电阻':          { bg: '#ecfeff', text: '#0e7490', tag: 'info' },
  '双金属温度计':     { bg: '#f5f3ff', text: '#6d28d9', tag: '' },
  '真空表':          { bg: '#faf5ff', text: '#7c3aed', tag: '' },
  '电接点压力表':     { bg: '#fff7ed', text: '#c2410c', tag: 'warning' },
  '压力开关':        { bg: '#f1f5f9', text: '#334155', tag: 'info' },
  '温度开关':        { bg: '#f8fafc', text: '#0f172a', tag: 'info' },
  '称重传感器':       { bg: '#fef2f2', text: '#991b1b', tag: 'danger' },
  '其他':            { bg: '#f9fafb', text: '#374151', tag: 'info' }
}

// 获取类别颜色（带默认值）
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || { bg: '#f9fafb', text: '#374151', tag: 'info' }
}

// 器具状态
export const STATUS_OPTIONS = [
  { value: 'active', label: '在用' },
  { value: 'scrapped', label: '报废' },
  { value: 'borrowed', label: '借出' },
  { value: 'maintenance', label: '维修' }
]

export const STATUS_MAP = {
  active: '在用',
  scrapped: '报废',
  borrowed: '借出',
  maintenance: '维修'
}

export const STATUS_COLOR = {
  active: 'success',
  scrapped: 'info',
  borrowed: 'warning',
  maintenance: 'danger'
}

// 检验结果
export const RESULT_OPTIONS = [
  { value: '合格', label: '合格' },
  { value: '不合格', label: '不合格' },
  { value: '待检', label: '待检' }
]

// 量程单位
export const RANGE_UNITS = [
  'MPa', 'kPa', 'Pa', 'bar', 'psi',
  '℃', '℉', 'K',
  'mm', 'cm', 'm',
  'm³/h', 'L/min', 'L/s',
  't', 'kg', 'g',
  '%', 'ppm',
  'V', 'mV', 'mA', 'A',
  '其他'
]

// 有效期状态
export function getValidStatus(validUntil) {
  if (!validUntil) return { text: '未知', color: 'info' }
  const now = new Date()
  const valid = new Date(validUntil)
  const diff = Math.ceil((valid - now) / (1000 * 60 * 60 * 24))

  if (diff < 0) return { text: '已过期', color: 'danger' }
  if (diff <= 30) return { text: diff + '天后到期', color: 'warning' }
  if (diff <= 60) return { text: diff + '天后到期', color: '' }
  return { text: '有效', color: 'success' }
}

// 导入字段映射选项
export const FIELD_OPTIONS = [
  { value: 'category', label: '器具类别' },
  { value: 'serial_number', label: '出厂编号' },
  { value: 'model', label: '型号' },
  { value: 'manufacturer', label: '生产厂家' },
  { value: 'range', label: '量程（合并）' },
  { value: 'rangeMin', label: '量程下限' },
  { value: 'rangeMax', label: '量程上限' },
  { value: 'rangeUnit', label: '单位' },
  { value: 'accuracy_class', label: '准确度等级' },
  { value: 'installation_location', label: '安装位置' },
  { value: 'department', label: '所属部门' },
  { value: 'certificate_number', label: '证书编号' },
  { value: 'inspection_date', label: '检验日期' },
  { value: 'valid_until', label: '有效日期' },
  { value: 'inspection_result', label: '检验结果' },
  { value: 'inspection_unit', label: '检定单位' },
  { value: 'status', label: '状态' },
  { value: 'remark', label: '备注' },
  { value: 'classification', label: '分类管理' },
  { value: 'pressure_gauge_type', label: '压力表类别' },
  { value: 'mfg_date', label: '出厂日期' }
]
