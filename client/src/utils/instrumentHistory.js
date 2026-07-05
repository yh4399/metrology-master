const SOURCE_LABELS = {
  manual_create: '手动新增',
  manual_edit: '手动编辑',
  manual_delete: '删除器具',
  certificate_upload: '批量上传证书',
  certificate_save: '证书信息保存',
  excel_import: 'Excel 导入',
  restore_version: '恢复历史版本',
  restore_deleted: '从回收站恢复',
  version_restore: '恢复历史版本',
  recycle_restore: '从回收站恢复'
}

export function parseHistoryDiff(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function formatHistoryValue(value) {
  if (value === null || value === undefined || value === '') return '空'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || '未知来源'
}
