import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getInstrumentStats, clearAllInstruments, clearByCategory } from '../api/instruments'

export function useDataClear() {
  const clearCategoryVisible = ref(false)
  const clearCategory = ref('')
  const clearCategoryLoading = ref(false)
  const categoryCounts = ref({})

  async function loadCategoryCounts() {
    try {
      const res = await getInstrumentStats()
      if (res.data && res.data.byCategory) {
        const counts = {}
        for (const item of res.data.byCategory) counts[item.category] = item.count
        categoryCounts.value = counts
      }
    } catch (e) { categoryCounts.value = {} }
  }

  function categoryDataCount(cat) {
    return categoryCounts.value[cat] || 0
  }

  async function handleClearByCategory() {
    if (!clearCategory.value) { ElMessage.warning('请选择要清空的类别'); return }
    clearCategoryLoading.value = true
    try {
      const res = await clearByCategory(clearCategory.value)
      ElMessage.success(res.message || `已清空类别"${clearCategory.value}"的数据`)
      clearCategoryVisible.value = false
      clearCategory.value = ''
      return true // signal success → caller should refresh
    } catch (err) { /* handled */ } finally {
      clearCategoryLoading.value = false
    }
    return false
  }

  async function handleClearAll() {
    try {
      const res = await clearAllInstruments()
      ElMessage.success(res.message || '已清空全部数据')
      return true
    } catch (err) { /* handled */ }
    return false
  }

  return {
    clearCategoryVisible, clearCategory, clearCategoryLoading, categoryCounts,
    loadCategoryCounts, categoryDataCount, handleClearByCategory, handleClearAll
  }
}
