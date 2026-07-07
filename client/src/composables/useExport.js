import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportInstruments, exportManagementSummary, exportWarningApply } from '../api/instruments'
import { FIELD_OPTIONS } from '../utils/constants'

export function useExport() {
  const EXPORT_FIELD_OPTIONS = FIELD_OPTIONS.filter(o => !['range', 'classification', 'pressure_gauge_type'].includes(o.value))
  const exportColumnsVisible = ref(false)
  const exportSelectedColumns = ref(EXPORT_FIELD_OPTIONS.map(o => o.value))
  const pendingExportCommand = ref(null)

  function toggleExportColumn(value, checked) {
    if (checked) {
      if (!exportSelectedColumns.value.includes(value)) exportSelectedColumns.value.push(value)
    } else {
      exportSelectedColumns.value = exportSelectedColumns.value.filter(v => v !== value)
    }
  }

  function openExportColumnPicker(command) {
    pendingExportCommand.value = command
    exportColumnsVisible.value = true
  }

  function confirmExportWithColumns(handleExportCommandFn) {
    exportColumnsVisible.value = false
    if (exportSelectedColumns.value.length === 0) {
      ElMessage.warning('请至少选择一列')
      return
    }
    handleExportCommandFn(pendingExportCommand.value, exportSelectedColumns.value.join(','))
  }

  function buildFilterParams(filters, pagination) {
    const params = {}
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.category) params.category = filters.category
    if (filters.status) params.status = filters.status
    if (filters.classification) params.classification = filters.classification
    if (filters.validDate) { params.validFrom = filters.validDate; params.validTo = filters.validDate }
    if (filters.inspectionDate) { params.inspectionFrom = filters.inspectionDate; params.inspectionTo = filters.inspectionDate }
    params.sortBy = pagination.sortBy
    params.sortOrder = pagination.sortOrder
    return params
  }

  function downloadBlob(data, filename) {
    const url = window.URL.createObjectURL(new Blob([data]))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  async function handleExportCommand(command, columns, filters, pagination, selectedRows, selectAllMode, tableData, router) {
    try {
      const params = {}
      let filename = ''

      if (command === 'custom-apply') {
        openExportColumnPicker('apply-all')
        return
      }

      // === 台帐格式导出 ===
      if (command === 'export-all') {
        const p = buildFilterParams(filters, pagination)
        const res = await exportInstruments(p)
        downloadBlob(res.data, '计量器具台账_' + new Date().toISOString().slice(0, 10) + '.xlsx')
        ElMessage.success('导出成功')
        return
      }

      // === 管理一览表 ===
      const doSummaryExport = async (p, fname) => {
        const res = await exportManagementSummary(p)
        downloadBlob(res.data, fname)
        ElMessage.success('管理一览表导出成功')
      }

      if (command === 'summary-selected') {
        if (selectAllMode) {
          const p = buildFilterParams(filters, pagination)
          await doSummaryExport(p, `计量器具管理一览表（全选${pagination.total}条）_${new Date().toISOString().slice(0, 10)}.xlsx`)
          return
        }
        if (selectedRows.length === 0) { ElMessage.warning('请先选择要导出的计量器具'); return }
        params.ids = selectedRows.map(r => r.id).join(',')
        await doSummaryExport(params, `计量器具管理一览表（选中${selectedRows.length}条）_${new Date().toISOString().slice(0, 10)}.xlsx`)
        return
      }

      if (command === 'summary-all') {
        const p = buildFilterParams(filters, pagination)
        await doSummaryExport(p, `计量器具管理一览表_${new Date().toISOString().slice(0, 10)}.xlsx`)
        return
      }

      // === 检定申请表 ===
      const doApplyExport = async (p, fname) => {
        if (columns) p.columns = columns
        const res = await exportWarningApply(p)
        downloadBlob(res.data, fname)
        ElMessage.success('检定申请表导出成功')
      }

      if (command === 'apply-selected') {
        if (selectAllMode) {
          const p = buildFilterParams(filters, pagination)
          await doApplyExport(p, `计量器具检定申请表（全选${pagination.total}条）_${new Date().toISOString().slice(0, 10)}.xlsx`)
          return
        }
        if (selectedRows.length === 0) { ElMessage.warning('请先选择要导出的计量器具'); return }
        params.ids = selectedRows.map(r => r.id).join(',')
        if (columns) params.columns = columns
        await doApplyExport(params, `计量器具检定申请表（选中${selectedRows.length}条）_${new Date().toISOString().slice(0, 10)}.xlsx`)
        return
      }

      if (command === 'apply-all') {
        const p = buildFilterParams(filters, pagination)
        if (columns) p.columns = columns
        await doApplyExport(p, `计量器具检定申请表_${new Date().toISOString().slice(0, 10)}.xlsx`)
        return
      }

      // === 送检工作台 ===
      if (command === 'workspace-selected') {
        if (selectedRows.length > 0) {
          router.push({ path: '/inspection-workspace', query: { ids: selectedRows.map(r => r.id).join(',') } })
        } else {
          router.push({ path: '/inspection-workspace' })
        }
      }
    } catch (err) {
      ElMessage.error('导出失败')
    }
  }

  return {
    EXPORT_FIELD_OPTIONS, exportColumnsVisible, exportSelectedColumns, pendingExportCommand,
    toggleExportColumn, openExportColumnPicker, confirmExportWithColumns,
    buildFilterParams, handleExportCommand
  }
}
