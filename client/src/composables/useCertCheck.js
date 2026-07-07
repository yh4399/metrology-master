import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { checkCertDates, batchUpdateCertDates } from '../api/instruments'

export function useCertCheck() {
  const certCheckVisible = ref(false)
  const certCheckLoading = ref(false)
  const certCheckData = ref(null)
  const certCheckOnlyMismatch = ref(true)
  const certCheckSelected = ref([])

  async function loadCertCheck() {
    certCheckLoading.value = true
    certCheckSelected.value = []
    try {
      const params = { pageSize: 500 }
      if (certCheckOnlyMismatch.value) params.onlyMismatch = '1'
      const res = await checkCertDates(params)
      certCheckData.value = res.data
    } catch (err) {
      ElMessage.error('校验失败：' + (err.response?.data?.message || err.message))
    } finally {
      certCheckLoading.value = false
    }
  }

  async function handleBatchUpdateDates() {
    if (certCheckSelected.value.length === 0) {
      ElMessage.warning('请先选择要更新的记录')
      return
    }
    try {
      await ElMessageBox.confirm(
        `确定更新选中的 ${certCheckSelected.value.length} 条记录的检验日期和有效日期吗？`,
        '确认批量更新',
        { confirmButtonText: '确定更新', cancelButtonText: '取消', type: 'warning' }
      )
    } catch { return }

    try {
      const items = certCheckSelected.value.map(r => {
        const item = { id: r.id }
        const needCertFix = r.cert_status === 'cert_mismatch' || r.cert_status === 'cert_missing'
        if (needCertFix && r.extracted_date) {
          item.inspection_date = r.extracted_date
          if (r.cert_expected_valid_until) item.valid_until = r.cert_expected_valid_until
        }
        const needValidFix = r.valid_status === 'valid_mismatch' || r.valid_status === 'valid_missing'
        if (needValidFix && r.expected_valid_until && !item.valid_until) {
          item.valid_until = r.expected_valid_until
        }
        return item
      })
      const res = await batchUpdateCertDates({ items })
      ElMessage.success(res.message || `成功更新 ${res.data.updated} 条记录`)
      certCheckSelected.value = []
      await loadCertCheck()
      return true // signal success → caller should refresh list
    } catch (err) {
      ElMessage.error('批量更新失败：' + (err.response?.data?.message || err.message))
    }
    return false
  }

  return {
    certCheckVisible, certCheckLoading, certCheckData, certCheckOnlyMismatch, certCheckSelected,
    loadCertCheck, handleBatchUpdateDates
  }
}
