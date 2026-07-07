import { ref, reactive, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getInstruments, getCategories } from '../api/instruments'
import { CATEGORIES, getCategoryColor, FIELD_OPTIONS } from '../utils/constants'

export function useInstrumentList() {
  const route = useRoute()
  const router = useRouter()

  // ---- 核心状态 ----
  const loading = ref(false)
  const tableData = ref([])
  const categories = ref(CATEGORIES)
  const denseMode = ref(false)
  const selectedRows = ref([])
  const selectAllMode = ref(false)
  const tableRef = ref(null)
  let searchTimer = null

  // ---- 日期列筛选 ----
  const inspectionDateFilterVisible = ref(false)
  const validDateFilterVisible = ref(false)
  const inspectionDateFilterTemp = ref('')
  const validDateFilterTemp = ref('')

  // ---- 筛选 & 分页 ----
  const filters = reactive({
    keyword: '',
    category: '',
    status: '',
    classification: '',
    validDate: '',
    inspectionDate: ''
  })

  const pagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0,
    sortBy: 'updated_at',
    sortOrder: 'desc'
  })

  // ---- 工具函数 ----
  function formatNumber(val) {
    if (val === null || val === undefined) return ''
    return String(Number(val))
  }

  function formatRange(row) {
    const parts = []
    if (row.range_min !== null && row.range_min !== undefined) parts.push(formatNumber(row.range_min))
    if (row.range_max !== null && row.range_max !== undefined) {
      parts.push(parts.length ? ' ~ ' + formatNumber(row.range_max) : formatNumber(row.range_max))
    }
    if (row.range_unit) parts.push(' ' + row.range_unit)
    return parts.length > 0 ? parts.join('') : '-'
  }

  function formatDate(date) {
    if (!date) return ''
    return String(date).slice(0, 10)
  }

  function formatDateTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    })
  }

  function getValidTagType(validUntil) {
    if (!validUntil) return 'info'
    const diff = Math.ceil((new Date(validUntil) - new Date()) / 86400000)
    if (diff < 0) return 'danger'
    if (diff <= 30) return 'warning'
    return 'success'
  }

  function parseExtraFields(row) {
    if (!row.extra_fields) return {}
    try {
      return typeof row.extra_fields === 'string' ? JSON.parse(row.extra_fields) : row.extra_fields
    } catch (e) { return {} }
  }

  function getClassification(row) {
    const extra = parseExtraFields(row)
    return extra.classification || extra.分类管理 || extra.分类 || ''
  }

  function getClassificationLevel(row) {
    const cls = getClassification(row)
    if (cls.includes('A') || cls.includes('a')) return 'a'
    if (cls.includes('B') || cls.includes('b')) return 'b'
    if (cls.includes('C') || cls.includes('c')) return 'c'
    return ''
  }

  function categoryStyle(category) {
    const c = getCategoryColor(category)
    return { backgroundColor: c.bg, color: c.text, borderColor: c.text + '30' }
  }

  function indexMethod(idx) {
    return (pagination.page - 1) * pagination.pageSize + idx + 1
  }

  // ---- 筛选逻辑 ----
  const activeFilterCount = computed(() => {
    let count = 0
    if (filters.keyword) count++
    if (filters.category) count++
    if (filters.status) count++
    if (filters.classification) count++
    if (filters.validDate) count++
    if (filters.inspectionDate) count++
    return count
  })

  function onSearchDebounce() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(fetchList, 300)
  }

  function resetFilters() {
    filters.keyword = ''
    filters.category = ''
    filters.status = ''
    filters.classification = ''
    filters.validDate = ''
    filters.inspectionDate = ''
    validDateFilterTemp.value = ''
    inspectionDateFilterTemp.value = ''
    pagination.page = 1
    fetchList()
  }

  function applyInspectionDateFilter() {
    filters.inspectionDate = inspectionDateFilterTemp.value || ''
    inspectionDateFilterVisible.value = false
    fetchList()
  }

  function applyValidDateFilter() {
    filters.validDate = validDateFilterTemp.value || ''
    validDateFilterVisible.value = false
    fetchList()
  }

  // ---- 核心数据获取 ----
  async function fetchList() {
    loading.value = true
    selectAllMode.value = false
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder
      }
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) { params.validFrom = filters.validDate; params.validTo = filters.validDate }
      if (filters.inspectionDate) { params.inspectionFrom = filters.inspectionDate; params.inspectionTo = filters.inspectionDate }

      // 同步 URL
      const query = {}
      if (filters.keyword) query.keyword = filters.keyword
      if (filters.category) query.category = filters.category
      if (filters.status) query.status = filters.status
      if (filters.classification) query.classification = filters.classification
      if (filters.validDate) query.validDate = filters.validDate
      if (filters.inspectionDate) query.inspectionDate = filters.inspectionDate
      router.replace({ path: '/instruments', query })

      const res = await getInstruments(params)
      tableData.value = res.data.list
      pagination.total = res.data.total
      if (tableData.value.length === 0 && pagination.page > 1 && pagination.total > 0) {
        pagination.page--
        return fetchList()
      }
      await nextTick()
      tableRef.value?.doLayout()
    } catch (err) {
      // handled
    } finally {
      loading.value = false
    }
  }

  function handleSortChange({ prop, order }) {
    if (prop) pagination.sortBy = prop === 'valid_until' ? 'valid_until' : prop
    pagination.sortOrder = order === 'ascending' ? 'asc' : 'desc'
    fetchList()
  }

  function handleSelectionChange(rows) {
    selectedRows.value = rows
    if (selectAllMode.value && rows.length < tableData.value.length) {
      selectAllMode.value = false
    }
  }

  function handleSelectAllCommand(command) {
    if (command === 'select-page') {
      selectAllMode.value = false
      tableRef.value?.toggleAllSelection()
    } else if (command === 'select-all') {
      selectAllMode.value = true
      tableRef.value?.clearSelection()
    } else if (command === 'clear-selection') {
      selectAllMode.value = false
      tableRef.value?.clearSelection()
    }
  }

  async function initCategories() {
    try {
      const catRes = await getCategories()
      if (catRes.data && catRes.data.length > 0) categories.value = catRes.data
    } catch (e) { /* use default */ }
  }

  function initFromUrl() {
    const q = route.query
    if (q.keyword) filters.keyword = q.keyword
    if (q.category) filters.category = q.category
    if (q.status) filters.status = q.status
    if (q.classification) filters.classification = q.classification
    if (q.validDate) filters.validDate = q.validDate
    if (q.inspectionDate) filters.inspectionDate = q.inspectionDate
  }

  return {
    // state
    loading, tableData, categories, denseMode, selectedRows, selectAllMode, tableRef,
    filters, pagination,
    inspectionDateFilterVisible, validDateFilterVisible,
    inspectionDateFilterTemp, validDateFilterTemp,
    // computed
    activeFilterCount,
    // formatters
    formatNumber, formatRange, formatDate, formatDateTime,
    getValidTagType, parseExtraFields, getClassification, getClassificationLevel, categoryStyle, indexMethod,
    // actions
    onSearchDebounce, resetFilters, applyInspectionDateFilter, applyValidDateFilter,
    fetchList, handleSortChange,
    handleSelectionChange, handleSelectAllCommand,
    initCategories, initFromUrl
  }
}
