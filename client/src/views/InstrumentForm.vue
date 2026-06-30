<template>
  <div class="instrument-form-page">
    <div class="form-card">
      <!-- 顶部标题栏 -->
      <div class="form-topbar">
        <el-button @click="$router.back()" text>
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <h3>{{ isEdit ? '编辑计量器具' : '新增计量器具' }}</h3>
        <div></div>
      </div>

      <!-- 表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="right"
        class="main-form"
      >
        <!-- ===== 基础信息 ===== -->
        <div class="form-section">
          <div class="section-title">
            <el-icon><InfoFilled /></el-icon> 基础信息
          </div>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="器具类别" prop="category">
                <el-select v-model="form.category" placeholder="请选择或输入类别" filterable allow-create style="width:100%">
                  <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="出厂编号" prop="serial_number">
                <el-input v-model="form.serial_number" placeholder="器具铭牌上的出厂编号" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="分类管理">
                <el-select v-model="form.classification" placeholder="选择分类" clearable style="width:100%">
                  <el-option label="A类" value="A类" />
                  <el-option label="B类" value="B类" />
                  <el-option label="C类" value="C类" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="型号规格">
                <el-input v-model="form.model" placeholder="如 Y-100、EJA430A" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="生产厂家">
                <el-input v-model="form.manufacturer" placeholder="制造单位全称" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="准确度等级">
                <el-input v-model="form.accuracy_class" placeholder="如 1.6、0.5" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- ===== 量程信息 ===== -->
        <div class="form-section">
          <div class="section-title">
            <el-icon><TrendCharts /></el-icon> 量程信息
          </div>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="量程下限">
                <el-input-number v-model="form.range_min" placeholder="下限" style="width:100%" controls-position="right" :precision="4" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="量程上限">
                <el-input-number v-model="form.range_max" placeholder="上限" style="width:100%" controls-position="right" :precision="4" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="单位">
                <el-select v-model="form.range_unit" placeholder="选择单位" filterable allow-create style="width:100%">
                  <el-option v-for="u in RANGE_UNITS" :key="u" :label="u" :value="u" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- ===== 位置与部门 ===== -->
        <div class="form-section">
          <div class="section-title">
            <el-icon><Location /></el-icon> 位置与归属
          </div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="安装位置">
                <el-input v-model="form.installation_location" placeholder="如 锅炉房1号、汽轮机厂房" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="所属部门">
                <el-input v-model="form.department" placeholder="如 动力车间、能源部" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- ===== 检验信息 ===== -->
        <div class="form-section">
          <div class="section-title">
            <el-icon><Checked /></el-icon> 检验信息
          </div>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="检验日期">
                <el-date-picker
                  v-model="form.inspection_date"
                  type="date"
                  placeholder="选择日期"
                  value-format="YYYY-MM-DD"
                  style="width:100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="有效日期">
                <el-date-picker
                  v-model="form.valid_until"
                  type="date"
                  placeholder="选择日期"
                  value-format="YYYY-MM-DD"
                  style="width:100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="检定单位">
                <el-input v-model="form.inspection_unit" placeholder="如 市计量院" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="检验结果">
                <el-select v-model="form.inspection_result" placeholder="选择结果" clearable style="width:100%">
                  <el-option v-for="r in RESULT_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="状态" prop="status">
                <el-select v-model="form.status" style="width:100%">
                  <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="备注">
                <el-input v-model="form.remark" placeholder="备注信息" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- ===== 照片 & OCR ===== -->
        <div class="form-section">
          <div class="section-title">
            <el-icon><CameraFilled /></el-icon> 仪器照片 & 智能识别
          </div>
          <div class="photo-area">
            <!-- 照片预览 -->
            <div class="photo-preview-wrap" v-if="form.photo_url || photoPreviewUrl">
              <el-image
                :src="photoDisplayUrl"
                fit="cover"
                style="width:220px;height:220px;border-radius:12px;border:2px solid var(--border-color);"
                :preview-src-list="[photoDisplayUrl]"
              />
              <el-button type="danger" size="small" circle class="photo-remove" @click="removePhoto">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>

            <!-- 上传按钮组 -->
            <div class="photo-actions">
              <input ref="cameraInputRef" type="file" accept="image/*" capture="environment" style="display:none" @change="handlePhotoSelected" />
              <el-button type="primary" @click="openCamera">
                <el-icon><Camera /></el-icon> 拍照
              </el-button>

              <input ref="fileInputRef" type="file" accept="image/*" style="display:none" @change="handlePhotoSelected" />
              <el-button @click="openFilePicker">
                <el-icon><FolderOpened /></el-icon> 上传图片
              </el-button>

              <el-button
                type="warning"
                :loading="ocrLoading"
                :disabled="!photoFile && !form.photo_url"
                @click="handleOcr"
              >
                <el-icon><Reading /></el-icon> AI识别
              </el-button>
            </div>

            <!-- OCR结果 -->
            <div v-if="ocrResult" class="ocr-result">
              <el-alert title="AI识别完成！已自动填充以下字段，请核对：" type="success" :closable="true" show-icon @close="ocrResult = null">
                <template #default>
                  <div class="ocr-tags">
                    <el-tag v-if="ocrResult.extracted?.category" size="small" effect="dark" type="success" round>类别: {{ ocrResult.extracted.category }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.serial_number" size="small" effect="dark" round>出厂编号: {{ ocrResult.extracted.serial_number }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.model" size="small" effect="dark" round>型号: {{ ocrResult.extracted.model }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.range_min !== undefined" size="small" effect="dark" round>量程: {{ ocrResult.extracted.range_min }}~{{ ocrResult.extracted.range_max }} {{ ocrResult.extracted.range_unit || '' }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.accuracy_class" size="small" effect="dark" round>准确度: {{ ocrResult.extracted.accuracy_class }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.manufacturer" size="small" effect="dark" round>厂家: {{ ocrResult.extracted.manufacturer }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.certificate_number" size="small" effect="dark" round>证书: {{ ocrResult.extracted.certificate_number }}</el-tag>
                    <el-tag v-if="ocrResult.extracted?.inspection_unit" size="small" effect="dark" type="warning" round>检定单位: {{ ocrResult.extracted.inspection_unit }}</el-tag>
                  </div>
                </template>
              </el-alert>
            </div>
          </div>
        </div>

        <!-- ===== 提交按钮 ===== -->
        <div class="form-footer">
          <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit" class="submit-btn">
            <el-icon><Check /></el-icon> {{ isEdit ? '保存修改' : '确认新增' }}
          </el-button>
          <el-button size="large" @click="$router.back()">取消</el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, InfoFilled, TrendCharts, Location, Checked,
  CameraFilled, Camera, FolderOpened, Reading, Close, Check
} from '@element-plus/icons-vue'
import { createInstrument, updateInstrument, getInstrument, getCategories, uploadPhoto, ocrPhoto, ocrFromUrl } from '../api/instruments'
import { CATEGORIES, STATUS_OPTIONS, RESULT_OPTIONS, RANGE_UNITS } from '../utils/constants'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)
const categories = ref(CATEGORIES)

const cameraInputRef = ref(null)
const fileInputRef = ref(null)
const photoFile = ref(null)
const photoPreviewUrl = ref('')
const ocrLoading = ref(false)
const ocrResult = ref(null)

const authStore = useAuthStore()
const isEdit = computed(() => !!route.params.id)
const photoDisplayUrl = computed(() => {
  // 优先使用服务器URL（已保存的照片），否则使用本地预览（blob URL）
  const url = form.photo_url || photoPreviewUrl.value
  if (!url) return ''
  // blob URL 不需要鉴权 token（浏览器本地资源）
  if (url.startsWith('blob:')) return url
  const sep = url.includes('?') ? '&' : '?'
  return authStore.token ? url + sep + 'token=' + authStore.token : url
})

const form = reactive({
  category: '',
  serial_number: '',
  certificate_number: '',
  model: '',
  manufacturer: '',
  accuracy_class: '',
  range_min: null,
  range_max: null,
  range_unit: '',
  installation_location: '',
  department: '',
  classification: '',
  inspection_date: '',
  valid_until: '',
  inspection_result: '',
  inspection_unit: '',
  status: 'active',
  remark: '',
  photo_url: ''
})

const rules = {
  category: [{ required: true, message: '请选择器具类别', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const data = { ...form }

    // 将分类管理合并到 extra_fields（保留已有的 extra_fields）
    let extraFields = {}
    if (data.extra_fields) {
      try {
        extraFields = typeof data.extra_fields === 'string' ? JSON.parse(data.extra_fields) : data.extra_fields
      } catch (e) { /* ignore */ }
    }
    if (data.classification) {
      extraFields.classification = data.classification
    } else {
      delete extraFields.classification
    }
    data.extra_fields = Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : null
    delete data.classification

    Object.keys(data).forEach(k => {
      if (data[k] === '' || data[k] === undefined) data[k] = null
    })

    if (isEdit.value) {
      await updateInstrument(route.params.id, data)
      ElMessage.success('更新成功')
    } else {
      await createInstrument(data)
      ElMessage.success('新增成功')
    }
    router.push('/instruments')
  } catch (err) {
    // handled
  } finally {
    submitting.value = false
  }
}

// ============ 照片处理 ============
function openCamera() { cameraInputRef.value?.click() }
function openFilePicker() { fileInputRef.value?.click() }

async function handlePhotoSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); return }
  if (file.size > 20 * 1024 * 1024) { ElMessage.warning('图片大小不能超过20MB'); return }

  photoFile.value = file
  if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
  photoPreviewUrl.value = URL.createObjectURL(file)

  try {
    const res = await uploadPhoto(file)
    form.photo_url = res.data.photo_url
    ElMessage.success('照片上传成功')
  } catch (err) {
    ElMessage.warning('照片上传失败，请稍后重试')
  }
  event.target.value = ''
}

function removePhoto() {
  photoFile.value = null
  form.photo_url = ''
  if (photoPreviewUrl.value) { URL.revokeObjectURL(photoPreviewUrl.value); photoPreviewUrl.value = '' }
  ocrResult.value = null
}

async function handleOcr() {
  // 情况1：有新的图片文件 → 先确保上传，然后用URL进行OCR（避免重复发送大文件）
  if (photoFile.value) {
    if (!form.photo_url) {
      try {
        const res = await uploadPhoto(photoFile.value)
        form.photo_url = res.data.photo_url
        ElMessage.success('照片已上传，正在识别...')
      } catch (err) {
        ElMessage.error('照片上传失败，请重试')
        return
      }
    }
    await doOcrWithUrl()
    return
  }

  // 情况2：没有新文件，但已有照片URL → 直接用URL进行OCR
  if (form.photo_url) {
    await doOcrWithUrl()
    return
  }

  // 情况3：什么都没有
  ElMessage.warning('请先拍照或上传图片')
}

async function doOcrWithFile() {
  ocrLoading.value = true
  ocrResult.value = null
  try {
    const res = await ocrPhoto(photoFile.value)
    applyOcrResult(res)
  } catch (err) {
    ElMessage.error('识别失败，请检查照片清晰度后重试')
  } finally {
    ocrLoading.value = false
  }
}

async function doOcrWithUrl() {
  ocrLoading.value = true
  ocrResult.value = null
  try {
    const res = await ocrFromUrl(form.photo_url)
    applyOcrResult(res)
  } catch (err) {
    ElMessage.error('识别失败，请检查照片清晰度后重试')
  } finally {
    ocrLoading.value = false
  }
}

function applyOcrResult(res) {
  const extracted = res.data?.extracted
  if (!extracted || Object.keys(extracted).length === 0) {
    ElMessage.info('未能从图片中识别到仪器信息，请尝试更清晰的照片')
    return
  }

  let filledCount = 0
  const fieldMapping = {
    category: 'category',
    serial_number: 'serial_number',
    model: 'model',
    manufacturer: 'manufacturer',
    range_min: 'range_min',
    range_max: 'range_max',
    range_unit: 'range_unit',
    accuracy_class: 'accuracy_class',
    certificate_number: 'certificate_number',
    inspection_unit: 'inspection_unit'
  }

  for (const [ocrField, formField] of Object.entries(fieldMapping)) {
    const value = extracted[ocrField]
    if (value !== undefined && value !== null && value !== '') {
      if (!form[formField] || form[formField] === '' || form[formField] === null) {
        form[formField] = value
        filledCount++
      }
    }
  }

  if (extracted.possible_inspection_date && !form.inspection_date) {
    form.inspection_date = extracted.possible_inspection_date
    filledCount++
  }
  if (extracted.possible_valid_until && !form.valid_until) {
    form.valid_until = extracted.possible_valid_until
    filledCount++
  }
  if (res.data?.photo_url) {
    form.photo_url = res.data.photo_url
  }

  ocrResult.value = res.data
  ElMessage.success(`AI识别完成，已自动填充 ${filledCount} 个字段，请核对后保存`)
}

onMounted(async () => {
  try {
    const catRes = await getCategories()
    if (catRes.data && catRes.data.length > 0) categories.value = catRes.data
  } catch (e) { /* use default */ }

  if (isEdit.value) {
    try {
      const res = await getInstrument(route.params.id)
      Object.assign(form, res.data)
      // 从 extra_fields 提取分类管理
      if (res.data.extra_fields) {
        try {
          const extra = typeof res.data.extra_fields === 'string' ? JSON.parse(res.data.extra_fields) : res.data.extra_fields
          if (extra.classification) {
            form.classification = extra.classification
          }
        } catch (e) { /* ignore */ }
      }
    } catch (err) {
      ElMessage.error('加载数据失败')
      router.push('/instruments')
    }
  }
})
</script>

<style scoped>
.instrument-form-page {
  max-width: 1000px;
  margin: 0 auto;
}

.form-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.form-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  background: #fafbfc;
}

.form-topbar h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.main-form {
  padding: 24px;
}

/* ============ 分组 ============ */
.form-section {
  background: #fafbfc;
  border-radius: var(--radius-md);
  padding: 20px 24px;
  margin-bottom: 20px;
  border: 1px solid #f1f5f9;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title .el-icon {
  color: var(--primary);
}

/* ============ 照片区 ============ */
.photo-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.photo-preview-wrap {
  position: relative;
  display: inline-block;
}

.photo-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
}

.photo-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ocr-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

/* ============ 提交 ============ */
.form-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
}

.submit-btn {
  min-width: 140px;
}

/* ============ Element Plus 微调 ============ */
:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 13px;
}

:deep(.el-input__wrapper),
:deep(.el-input-number__wrapper) {
  border-radius: 8px;
}

:deep(.el-select .el-input__wrapper) {
  border-radius: 8px;
}
</style>
