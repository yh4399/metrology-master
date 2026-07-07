import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getLedgerInfo, uploadLedger, viewLedgerData, addLedgerRow,
  updateLedgerRow, deleteLedgerRow, deleteLedgerFile
} from '../api/instruments'

export function useLedgerView(authStore) {
  const uploadLedgerDialog = ref(false)
  const ledgerFile = ref(null)
  const uploadingLedger = ref(false)
  const ledgerUploadRef = ref(null)

  const ledgerViewVisible = ref(false)
  const ledgerViewLoading = ref(false)
  const ledgerSheets = ref([])
  const ledgerActiveSheet = ref(0)
  const ledgerEditing = ref(null)
  const ledgerAdding = ref(false)
  const ledgerEditRow = ref([])
  const ledgerNewRow = ref([])
  const ledgerHistory = ref([])
  const ledgerCurrentFile = ref('')
  // 单元格级编辑
  const ledgerEditCell = ref(null)     // { row, col } or null
  const ledgerEditValue = ref('')

  const currentLedgerSheet = computed(() => ledgerSheets.value[ledgerActiveSheet.value] || null)
  const ledgerTitle = computed(() => {
    const base = '📋 台账总表'
    if (ledgerCurrentFile.value) {
      const match = ledgerCurrentFile.value.match(/(\d{8}_\d{6})/)
      if (match) {
        const ts = match[1]
        return base + ' — ' + ts.slice(0,4) + '-' + ts.slice(4,6) + '-' + ts.slice(6,8) + ' ' + ts.slice(9,11) + ':' + ts.slice(11,13) + ':' + ts.slice(13,15)
      }
    }
    return base
  })
  const ledgerReadOnly = computed(() => {
    if (!ledgerCurrentFile.value || ledgerHistory.value.length === 0) return false
    return ledgerCurrentFile.value !== ledgerHistory.value[0]?.fileName
  })

  // ---- 上传 ----
  function handleLedgerFileChange(file) { ledgerFile.value = file.raw }
  function handleLedgerFileRemove() { ledgerFile.value = null }

  async function handleUploadLedger() {
    if (!ledgerFile.value) return
    uploadingLedger.value = true
    try {
      const res = await uploadLedger(ledgerFile.value)
      ElMessage.success(res.message || '台账总表已保存')
      uploadLedgerDialog.value = false
      ledgerFile.value = null
      ledgerUploadRef.value?.clearFiles()
    } catch (err) {
      ElMessage.error('上传失败：' + (err.response?.data?.message || err.message))
    } finally {
      uploadingLedger.value = false
    }
  }

  // ---- 查看 ----
  async function loadLedgerView(file) {
    ledgerViewLoading.value = true
    ledgerSheets.value = []
    ledgerActiveSheet.value = 0
    cancelLedgerEdit()
    try {
      const infoRes = await getLedgerInfo()
      ledgerHistory.value = infoRes.data.history || []

      const res = await viewLedgerData(file)
      const sheets = res.data.sheets || []
      ledgerCurrentFile.value = res.data.fileName || infoRes.data.current?.fileName || ''

      const headerKeywords = ['序号', '出厂编号', '安装位置', '证书编号', '检验时间', '器具名称']
      for (const sheet of sheets) {
        let bestIdx = 1, bestScore = 0
        for (let i = 0; i < Math.min(sheet.rows.length, 6); i++) {
          const cells = (sheet.rows[i] || []).map(c => String(c || '').trim())
          const score = headerKeywords.filter(kw => cells.some(c => c.includes(kw))).length
          if (score > bestScore) { bestScore = score; bestIdx = i }
        }
        sheet._headerIdx = bestScore >= 1 ? bestIdx : 1
      }
      ledgerSheets.value = sheets
    } catch (err) {
      if (err.response?.status === 404) {
        ElMessage.warning('尚未上传台账总表，请先上传')
      } else {
        ElMessage.error('加载失败')
      }
      ledgerViewVisible.value = false
    } finally {
      ledgerViewLoading.value = false
    }
  }

  function fmtLedgerHistoryLabel(h) {
    const match = h.fileName.match(/(\d{8}_\d{6})/)
    if (!match) return h.fileName
    const ts = match[1]
    const label = ts.slice(0,4) + '-' + ts.slice(4,6) + '-' + ts.slice(6,8) + ' ' + ts.slice(9,11) + ':' + ts.slice(11,13)
    const sizeKB = Math.round(h.size / 1024)
    return label + '  (' + sizeKB + ' KB)'
  }

  async function switchLedgerVersion(fileName) {
    await loadLedgerView(fileName)
  }

  async function confirmDeleteLedgerVersion(h) {
    try {
      await ElMessageBox.confirm('确定删除历史版本 ' + fmtLedgerHistoryLabel(h) + '？', '确认删除', { type: 'warning' })
      await deleteLedgerFile({ file: h.fileName })
      ElMessage.success('已删除')
      const infoRes = await getLedgerInfo()
      ledgerHistory.value = infoRes.data.history || []
    } catch (err) {
      if (err !== 'cancel') ElMessage.error('删除失败')
    }
  }

  // ---- CRUD ----
  function editLedgerRow(ri, row) {
    ledgerEditing.value = ri
    ledgerAdding.value = false
    ledgerEditRow.value = [...row]
  }

  // ---- 单元格双击编辑 ----
  function startCellEdit(ri, ci, value) {
    ledgerEditCell.value = { row: ri, col: ci }
    ledgerEditValue.value = String(value ?? '')
  }

  async function saveCellEdit() {
    const cell = ledgerEditCell.value
    if (!cell) return
    const sheet = currentLedgerSheet.value
    if (!sheet) { ledgerEditCell.value = null; return }

    const ri = cell.row, ci = cell.col
    const newVal = ledgerEditValue.value
    const oldVal = sheet.rows[ri]?.[ci]

    ledgerEditCell.value = null

    if (String(newVal) === String(oldVal ?? '')) return // 没变化

    // 更新本地
    if (sheet.rows[ri]) sheet.rows[ri][ci] = newVal

    try {
      await updateLedgerRow({ sheetName: sheet.name, rowIndex: ri, rowData: sheet.rows[ri] })
      ElMessage.success('已更新')
    } catch (err) {
      // 回滚
      if (sheet.rows[ri]) sheet.rows[ri][ci] = oldVal
      ElMessage.error('更新失败：' + (err.response?.data?.message || err.message))
    }
  }

  function cancelLedgerEdit() {
    ledgerEditCell.value = null
    if (ledgerAdding.value) {
      const sheet = currentLedgerSheet.value
      if (sheet && sheet.rows.length > 0) sheet.rows.pop()
    }
    ledgerEditing.value = null
    ledgerAdding.value = false
    ledgerEditRow.value = []
    ledgerNewRow.value = []
  }

  async function saveLedgerRow(ri) {
    const sheet = currentLedgerSheet.value
    if (!sheet) return
    try {
      await updateLedgerRow({ sheetName: sheet.name, rowIndex: ri, rowData: ledgerEditRow.value })
      sheet.rows[ri] = [...ledgerEditRow.value]
      cancelLedgerEdit()
      ElMessage.success('已更新')
    } catch (err) {
      ElMessage.error('保存失败：' + (err.response?.data?.message || err.message))
    }
  }

  async function deleteLedgerRowConfirm(ri) {
    const sheet = currentLedgerSheet.value
    if (!sheet) return
    try {
      await ElMessageBox.confirm('确定删除第 ' + (ri + 1) + ' 行？', '确认删除', { type: 'warning' })
      await deleteLedgerRow({ sheetName: sheet.name, rowIndex: ri })
      sheet.rows.splice(ri, 1)
      ElMessage.success('已删除')
    } catch (err) {
      if (err !== 'cancel') ElMessage.error('删除失败：' + (err.response?.data?.message || err.message))
    }
  }

  function startAddLedgerRow() {
    const sheet = currentLedgerSheet.value
    if (!sheet) return
    ledgerEditing.value = null
    ledgerAdding.value = true
    const refRow = sheet.rows.find((r, i) => i !== sheet.rows.length - 1 && r.some(c => c !== '' && c !== undefined)) || sheet.rows[0]
    ledgerNewRow.value = Array(refRow?.length || 10).fill('')
    sheet.rows.push([...ledgerNewRow.value])
  }

  async function saveNewLedgerRow() {
    const sheet = currentLedgerSheet.value
    if (!sheet || !ledgerAdding.value) return
    try {
      await addLedgerRow({ sheetName: sheet.name, rowData: ledgerNewRow.value })
      sheet.rows[sheet.rows.length - 1] = [...ledgerNewRow.value]
      cancelLedgerEdit()
      ElMessage.success('已添加')
    } catch (err) {
      sheet.rows.pop()
      cancelLedgerEdit()
      ElMessage.error('添加失败：' + (err.response?.data?.message || err.message))
    }
  }

  function downloadLedger() {
    window.open('/api/instruments/ledger?token=' + authStore.token, '_blank')
  }

  return {
    uploadLedgerDialog, ledgerFile, uploadingLedger, ledgerUploadRef,
    ledgerViewVisible, ledgerViewLoading, ledgerSheets, ledgerActiveSheet,
    ledgerEditing, ledgerAdding, ledgerEditRow, ledgerNewRow,
    ledgerHistory, ledgerCurrentFile,
    ledgerEditCell, ledgerEditValue,
    currentLedgerSheet, ledgerTitle, ledgerReadOnly,
    handleLedgerFileChange, handleLedgerFileRemove, handleUploadLedger,
    loadLedgerView, fmtLedgerHistoryLabel, switchLedgerVersion, confirmDeleteLedgerVersion,
    editLedgerRow, cancelLedgerEdit, saveLedgerRow, deleteLedgerRowConfirm,
    startAddLedgerRow, saveNewLedgerRow, downloadLedger,
    startCellEdit, saveCellEdit
  }
}
