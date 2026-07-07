import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getInstruments, uploadPhoto, ocrFromUrl } from '../api/instruments'

export function usePhotoSearch() {
  const photoSearchVisible = ref(false)
  const photoSearchLoading = ref(false)
  const photoSearchPreview = ref('')
  const photoSearchResult = ref(null)
  const cameraSearchRef = ref(null)
  const fileSearchRef = ref(null)

  async function handlePhotoSearchFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); return }

    if (photoSearchPreview.value) URL.revokeObjectURL(photoSearchPreview.value)
    photoSearchPreview.value = URL.createObjectURL(file)
    photoSearchLoading.value = true
    photoSearchResult.value = null

    try {
      const ocrRes = await uploadPhoto(file)
      const result = await ocrFromUrl(ocrRes.data.photo_url)
      const extracted = result.data?.extracted
      const serialNumber = extracted?.serial_number

      if (!serialNumber) {
        photoSearchResult.value = { found: false }
        ElMessage.info('未能从照片中识别到出厂编号，请尝试更清晰的照片')
        return
      }

      const searchRes = await getInstruments({ keyword: serialNumber, pageSize: 50 })
      if (searchRes.data.list && searchRes.data.list.length > 0) {
        photoSearchResult.value = { found: true, instrument: searchRes.data.list[0] }
        ElMessage.success(`已找到：${searchRes.data.list[0].serial_number}`)
      } else {
        photoSearchResult.value = { found: false }
        ElMessage.warning(`未找到出厂编号为 "${serialNumber}" 的器具`)
      }
    } catch (err) {
      ElMessage.error('识别失败，请检查照片清晰度后重试')
    } finally {
      photoSearchLoading.value = false
      event.target.value = ''
    }
  }

  return {
    photoSearchVisible, photoSearchLoading, photoSearchPreview, photoSearchResult,
    cameraSearchRef, fileSearchRef,
    handlePhotoSearchFile
  }
}
