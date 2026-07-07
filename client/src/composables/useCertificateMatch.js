import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getInstruments, searchUnmatchedCert, forceMatchCert,
  createInstrumentFromCert, confirmCertMatch
} from '../api/instruments'

export function useCertificateMatch() {
  // ---- 未匹配证书处理 ----
  const fuzzyMatchVisible = ref(false)
  const confirmMatchVisible = ref(false)
  const manualMatchVisible = ref(false)
  const createFromCertVisible = ref(false)
  const multiMatchVisible = ref(false)
  const multiMatchCert = ref(null)
  const multiMatchSelected = reactive(new Set())
  const multiMatching = ref(false)
  const activeUnmatched = ref(null)
  const confirmMatchTarget = ref(null)
  const confirmUpdateSerial = ref(false)
  const fuzzySearchKeyword = ref('')
  const fuzzyCandidates = ref([])
  const fuzzySearching = ref(false)
  const fuzzySearched = ref(false)
  let fuzzySearchTimer = null
  const forceMatching = ref(false)
  const manualSearchKeyword = ref('')
  const manualCandidates = ref([])
  const manualTarget = ref(null)
  const manualSearching = ref(false)
  const newFromCertForm = ref({
    category: '', serialNumber: '', certificateNumber: '',
    inspectionDate: '', validUntil: '', classification: '', location: ''
  })
  const creatingFromCert = ref(false)

  // ---- 导航入口 ----
  function handleUnmatchedAction(cmd, row) {
    activeUnmatched.value = row
    confirmUpdateSerial.value = false
    switch (cmd) {
      case 'search':
        fuzzySearchKeyword.value = ''
        fuzzyCandidates.value = []
        fuzzySearched.value = false
        fuzzyMatchVisible.value = true
        searchFuzzyMatch()
        break
      case 'manual':
        manualSearchKeyword.value = ''
        manualTarget.value = null
        manualMatchVisible.value = true
        loadManualCandidates()
        break
      case 'create':
        newFromCertForm.value = {
          category: row.category || '',
          serialNumber: row.serialNumber || '',
          certificateNumber: row.certificateNumber || '',
          inspectionDate: row.extractedInspectionDate || '',
          validUntil: row.calculatedValidUntil || '',
          classification: '', location: ''
        }
        createFromCertVisible.value = true
        break
    }
  }

  // ---- 模糊搜索 ----
  async function searchFuzzyMatch() {
    if (!activeUnmatched.value) return
    fuzzySearching.value = true
    fuzzySearched.value = true
    try {
      const res = await searchUnmatchedCert({
        serialNumber: activeUnmatched.value.serialNumber,
        certificateNumber: activeUnmatched.value.certificateNumber,
        category: activeUnmatched.value.category,
        keyword: fuzzySearchKeyword.value
      })
      fuzzyCandidates.value = res.data.candidates || []
    } catch (err) {
      ElMessage.error('搜索失败：' + (err.response?.data?.message || err.message))
    } finally {
      fuzzySearching.value = false
    }
  }

  function onFuzzySearchDebounce() {
    if (fuzzySearchTimer) clearTimeout(fuzzySearchTimer)
    fuzzySearchTimer = setTimeout(() => searchFuzzyMatch(), 400)
  }

  function confirmFuzzyMatch(candidate) {
    confirmMatchTarget.value = candidate
    confirmUpdateSerial.value = candidate.similarity < 1
    confirmMatchVisible.value = true
  }

  // ---- 强制匹配 ----
  async function executeForceMatch(batchResults, batchSummary, fetchListCallback) {
    if (!activeUnmatched.value || !confirmMatchTarget.value) return
    forceMatching.value = true
    try {
      const res = await forceMatchCert({
        certificateSerialNumber: activeUnmatched.value.serialNumber,
        certificateNumber: activeUnmatched.value.certificateNumber,
        category: activeUnmatched.value.category,
        targetInstrumentId: confirmMatchTarget.value.id,
        updateSerialNumber: confirmUpdateSerial.value,
        tempFilePath: activeUnmatched.value.tempFilePath,
        inspectionDate: activeUnmatched.value.extractedInspectionDate || null,
        validUntil: activeUnmatched.value.calculatedValidUntil || null
      })
      ElMessage.success(res.message || '已关联证书')
      confirmMatchVisible.value = false
      fuzzyMatchVisible.value = false
      manualMatchVisible.value = false
      // 更新 batchResults
      if (batchResults.value) {
        const idx = batchResults.value.findIndex(r => r === activeUnmatched.value)
        if (idx >= 0) {
          batchResults.value[idx].status = 'matched'
          batchResults.value[idx].matchedInstrument = { serial_number: confirmMatchTarget.value.serial_number }
          batchSummary.value.matched++
          batchSummary.value.unmatched--
        }
      }
      if (fetchListCallback) fetchListCallback()
    } catch (err) {
      ElMessage.error('修正失败：' + (err.response?.data?.message || err.message))
    } finally {
      forceMatching.value = false
    }
  }

  // ---- 手动选择 ----
  async function loadManualCandidates() {
    manualSearching.value = true
    try {
      const keyword = manualSearchKeyword.value || ''
      const res = await getInstruments({ pageSize: 50, keyword: keyword || undefined })
      manualCandidates.value = res.data.list || []
    } catch (err) {
      ElMessage.error('加载失败：' + (err.response?.data?.message || err.message))
    } finally {
      manualSearching.value = false
    }
  }

  function selectManualTarget(row) { manualTarget.value = row }

  function confirmManualMatch() {
    if (!manualTarget.value) return
    confirmMatchTarget.value = manualTarget.value
    confirmUpdateSerial.value = true
    confirmMatchVisible.value = true
  }

  // ---- 从证书新建器具 ----
  async function executeCreateFromCert(batchResults, batchSummary, fetchListCallback) {
    const form = newFromCertForm.value
    if (!form.category) { ElMessage.warning('请选择器具类别'); return }
    creatingFromCert.value = true
    try {
      const res = await createInstrumentFromCert({
        serialNumber: form.serialNumber,
        certificateNumber: form.certificateNumber,
        category: form.category,
        inspectionDate: form.inspectionDate || null,
        validUntil: form.validUntil || null,
        classification: form.classification || null,
        location: form.location || '',
        tempFilePath: activeUnmatched.value?.tempFilePath
      })
      ElMessage.success(res.message || '已创建器具并关联证书')
      createFromCertVisible.value = false
      if (batchResults.value && activeUnmatched.value) {
        const idx = batchResults.value.findIndex(r => r === activeUnmatched.value)
        if (idx >= 0) {
          batchResults.value[idx].status = 'matched'
          batchResults.value[idx].matchedInstrument = { serial_number: form.serialNumber }
          batchSummary.value.matched++
          batchSummary.value.unmatched--
        }
      }
      if (fetchListCallback) fetchListCallback()
    } catch (err) {
      ElMessage.error('创建失败：' + (err.response?.data?.message || err.message))
    } finally {
      creatingFromCert.value = false
    }
  }

  // ---- 多条匹配 ----
  function openMultiMatchDialog(row) {
    multiMatchCert.value = row
    multiMatchSelected.clear()
    row.matchedInstruments?.forEach(inst => {
      if (inst.categoryMatch !== false) multiMatchSelected.add(inst.id)
    })
    multiMatchVisible.value = true
  }

  function toggleMultiSelect(id) {
    if (multiMatchSelected.has(id)) multiMatchSelected.delete(id)
    else multiMatchSelected.add(id)
  }

  function getMmDateColor(date) {
    if (!date) return '#909399'
    const diff = Math.ceil((new Date(date) - new Date()) / 86400000)
    return diff < 0 ? '#ef4444' : diff <= 30 ? '#f59e0b' : '#059669'
  }

  async function executeMultiMatch(batchResults, batchSummary, fetchListCallback) {
    if (!multiMatchCert.value || multiMatchSelected.size === 0) return
    multiMatching.value = true
    try {
      const res = await confirmCertMatch({
        tempFilePath: multiMatchCert.value.tempFilePath,
        certificateNumber: multiMatchCert.value.certificateNumber,
        serialNumber: multiMatchCert.value.serialNumber,
        category: multiMatchCert.value.category,
        selectedInstrumentIds: [...multiMatchSelected],
        inspectionDate: multiMatchCert.value.extractedInspectionDate || null,
        validUntil: multiMatchCert.value.calculatedValidUntil || null
      })
      ElMessage.success(res.message || '已更新')
      multiMatchVisible.value = false
      if (batchResults.value) {
        const idx = batchResults.value.findIndex(r => r === multiMatchCert.value)
        if (idx >= 0) {
          batchResults.value[idx].status = 'matched'
          batchSummary.value.matched++
          batchSummary.value.unmatched--
        }
      }
      if (fetchListCallback) fetchListCallback()
    } catch (err) {
      ElMessage.error('确认失败：' + (err.response?.data?.message || err.message))
    } finally {
      multiMatching.value = false
    }
  }

  return {
    // state
    fuzzyMatchVisible, confirmMatchVisible, manualMatchVisible, createFromCertVisible,
    multiMatchVisible, multiMatchCert, multiMatchSelected, multiMatching,
    activeUnmatched, confirmMatchTarget, confirmUpdateSerial,
    fuzzySearchKeyword, fuzzyCandidates, fuzzySearching, fuzzySearched, forceMatching,
    manualSearchKeyword, manualCandidates, manualTarget, manualSearching,
    newFromCertForm, creatingFromCert,
    // actions
    handleUnmatchedAction,
    searchFuzzyMatch, onFuzzySearchDebounce, confirmFuzzyMatch, executeForceMatch,
    loadManualCandidates, selectManualTarget, confirmManualMatch, executeCreateFromCert,
    openMultiMatchDialog, toggleMultiSelect, getMmDateColor, executeMultiMatch
  }
}
