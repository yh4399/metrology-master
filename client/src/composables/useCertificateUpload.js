import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchUploadCertificates, uploadCertificateForInstrument } from '../api/instruments'

export function useCertificateUpload() {
  const batchCertVisible = ref(false)
  const batchFiles = ref([])
  const batchUploading = ref(false)
  const batchProgress = ref(0)
  const batchResults = ref(null)
  const batchSummary = ref({ matched: 0, unmatched: 0, error: 0 })
  const certInputRefs = ref({})

  function resetBatchUpload() {
    batchFiles.value = []
    batchResults.value = null
    batchSummary.value = { matched: 0, unmatched: 0, error: 0 }
    batchProgress.value = 0
  }

  async function handleBatchUpload(fetchListCallback) {
    if (batchFiles.value.length === 0) {
      ElMessage.warning('请先选择PDF文件')
      return
    }

    let appendMode = false
    if (batchResults.value) {
      try {
        await ElMessageBox.confirm(
          '检测到已有匹配结果。是否将新上传的结果追加到现有结果之后？<br/>点击「追加」保留旧结果并添加新结果，点击「覆盖」将清除旧结果并仅显示新结果。',
          '已有匹配结果',
          { confirmButtonText: '追加', cancelButtonText: '覆盖', type: 'warning', distinguishCancelAndClose: true, dangerouslyUseHTMLString: true }
        )
        appendMode = true
      } catch (action) {
        if (action === 'cancel') { clearBatchResults() }
        else { return }
      }
    }

    batchUploading.value = true
    batchProgress.value = 30

    try {
      const rawFiles = batchFiles.value.map(f => f.raw || f)
      const res = await batchUploadCertificates(rawFiles)
      batchProgress.value = 100

      if (appendMode && batchResults.value) {
        batchResults.value = [...batchResults.value, ...res.data.results]
        batchSummary.value.matched += res.data.matched
        batchSummary.value.unmatched += res.data.unmatched
        batchSummary.value.error += res.data.error
      } else {
        batchResults.value = res.data.results
        batchSummary.value = { matched: res.data.matched, unmatched: res.data.unmatched, error: res.data.error }
      }

      if (res.data.matched > 0) {
        ElMessage.success(`成功匹配 ${res.data.matched} 条记录，证书编号已自动填入`)
        if (fetchListCallback) fetchListCallback()
      } else if (res.data.unmatched > 0) {
        ElMessage.warning(`${res.data.unmatched} 个证书未找到对应器具，请检查出厂编号`)
      }
      batchFiles.value = []
    } catch (err) {
      ElMessage.error('批量上传失败：' + (err.response?.data?.message || err.message))
      batchProgress.value = 0
    } finally {
      batchUploading.value = false
    }
  }

  function clearBatchResults() {
    batchResults.value = null
    batchSummary.value = { matched: 0, unmatched: 0, error: 0 }
    batchProgress.value = 0
  }

  async function handleSingleCertUpload(row, fetchListCallback, photoUrlFn) {
    const inputEl = certInputRefs.value[row.id]
    const file = inputEl?.files?.[0]  // fallback: we need real DOM event
    // This is a composable wrapper — the actual file picker trigger is in template
    // The real upload logic is called from template via the callback
  }

  return {
    batchCertVisible, batchFiles, batchUploading, batchProgress, batchResults, batchSummary, certInputRefs,
    resetBatchUpload, handleBatchUpload, clearBatchResults
  }
}
