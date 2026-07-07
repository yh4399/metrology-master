<template>
  <div class="workspace-page">
    <!-- ============ 批次列表模式 ============ -->
    <template v-if="!batchId">
      <div class="batch-list-page">
        <div class="page-header">
          <h3>📋 送检批次</h3>
          <div style="display:flex;gap:8px">
            <el-button type="primary" @click="showCreateDialog = true">
              <el-icon><Plus /></el-icon> 新建批次
            </el-button>
            <el-button plain @click="importFromExcel">
              <el-icon><Upload /></el-icon> 导入申请表
            </el-button>
          </div>
        </div>

        <div v-if="batches.length === 0 && !loadingBatches" class="empty-state">
          <p style="font-size:48px;margin-bottom:16px">📭</p>
          <p style="font-size:16px;color:#606266;margin-bottom:8px">暂无送检批次</p>
          <p style="font-size:13px;color:#909399">从预警页或台账列表勾选器具后创建批次，或点击"新建批次"创建空批次</p>
        </div>

        <div v-loading="loadingBatches" class="batch-list">
          <div v-for="batch in batches" :key="batch.id" class="batch-card" @click="openBatch(batch.id)">
            <div class="batch-card-left">
              <span class="batch-name">{{ batch.name }}</span>
              <div class="batch-meta">
                <el-tag :type="batch.status === 'completed' ? 'success' : batch.status === 'draft' ? 'info' : 'warning'" size="small">
                  {{ batch.status === 'completed' ? '已完成' : batch.status === 'draft' ? '草稿' : '处理中' }}
                </el-tag>
                <span class="batch-date">{{ batch.updated_at || batch.created_at }}</span>
              </div>
            </div>
            <div class="batch-card-right">
              <span class="batch-count">{{ batch.itemCount }} 个器具</span>
              <el-button text type="danger" size="small" @click.stop="deleteBatchConfirm(batch)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ 批次工作区模式 ============ -->
    <template v-else>
      <div class="workspace-header">
        <div class="header-left">
          <el-button @click="backToList" text><el-icon><ArrowLeft /></el-icon> 返回批次列表</el-button>
          <h3>📋 {{ batchName }}</h3>
          <el-tag :type="batchStatus === 'completed' ? 'success' : 'warning'" size="small">{{ batchStatus === 'completed' ? '已完成' : '处理中' }}</el-tag>
        </div>
        <div class="header-actions">
          <el-button type="success" plain @click="exportApplication">
            <el-icon><Document /></el-icon> 导出检定申请表
          </el-button>
          <el-button type="primary" plain @click="exportManagementSheet">
            <el-icon><List /></el-icon> 导出管理一览表
          </el-button>
          <el-button type="warning" plain @click="markBatchCompleted" v-if="batchStatus !== 'completed'">
            标记完成
          </el-button>
        </div>
      </div>

      <div class="workspace-body">
        <!-- A区：器具列表 -->
        <div class="panel panel-left">
          <div class="panel-header">
            <span class="panel-title">📦 待检器具（{{ batchItems.length }}）</span>
            <span style="font-size:12px;color:#909399">已更新 {{ updatedCount }} / {{ batchItems.length }}</span>
          </div>
          <div class="instrument-list">
            <div v-for="item in batchItems" :key="item.id"
              :class="['instrument-row', {
                active: detailItem?.id === item.id,
                updated: item.match_status === 'updated'
              }]"
              @click="showDetail(item)">
              <div class="inst-info">
                <div class="inst-line1">
                  <el-tag size="small" effect="dark" :type="getCategoryTagType(item.category)">{{ item.category }}</el-tag>
                  <code class="inst-serial">{{ item.serial_number }}</code>
                  <el-tag v-if="item.match_status === 'updated'" size="small" type="success">✓</el-tag>
                </div>
                <div class="inst-line2">
                  <span class="inst-location">{{ item.installation_location || '-' }}</span>
                </div>
                <div class="inst-line3">
                  <span v-if="item.new_certificate_number" style="color:#059669;font-size:12px">
                    新证书: {{ item.new_certificate_number.slice(-24) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- B区：证书上传 + C区：详情 -->
        <div class="panel panel-right">
          <div class="panel-section section-upload">
            <div class="panel-header">
              <span class="panel-title">📄 上传检定证书</span>
            </div>
            <el-upload v-model:file-list="certFiles" :auto-upload="false" :accept="'.pdf'" multiple drag :limit="200">
              <div class="upload-drag-area">
                <el-icon :size="36" color="#409EFF"><UploadFilled /></el-icon>
                <p>拖拽证书PDF到此处，或<em>点击选择</em></p>
              </div>
            </el-upload>
            <div style="margin-top:8px;display:flex;gap:8px">
              <el-button type="primary" :loading="uploadingCerts" :disabled="certFiles.length === 0" @click="uploadAndMatch">
                上传并匹配（{{ certFiles.length }} 个）
              </el-button>
            </div>
          </div>

          <!-- 匹配结果 -->
          <div class="panel-section section-results" v-if="certResults.length > 0">
            <el-table :data="certResults" size="small" max-height="200" stripe highlight-current-row @row-click="showCertMatch">
              <el-table-column prop="fileName" label="证书文件" min-width="180" show-overflow-tooltip />
              <el-table-column prop="serialNumber" label="出厂编号" width="150" />
              <el-table-column label="匹配" width="70" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row._matchedItemId" size="small" type="success">✓</el-tag>
                  <el-tag v-else size="small" type="danger">✗</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 并排核对详情 -->
          <div class="panel-section section-detail" v-if="detailItem">
            <div class="panel-header">
              <span class="panel-title">🔍 {{ detailItem.category }} / {{ detailItem.serial_number }}</span>
            </div>
            <div class="detail-compare">
              <div class="compare-side system-side">
                <div class="compare-label"><el-tag type="info" size="small">💾 系统台账</el-tag></div>
                <table class="compare-table">
                  <tr><td class="c-label">类别</td><td>{{ detailItem.category }}</td></tr>
                  <tr><td class="c-label">出厂编号</td><td class="sys-serial">{{ detailItem.serial_number }}</td></tr>
                  <tr><td class="c-label">安装位置</td><td>{{ detailItem.installation_location || '-' }}</td></tr>
                  <tr class="highlight-row"><td class="c-label">旧证书号</td><td>{{ detailItem.old_certificate_number || '(空)' }}</td></tr>
                  <tr class="highlight-row"><td class="c-label">旧检验日期</td><td>{{ detailItem.old_inspection_date || '(空)' }}</td></tr>
                  <tr class="highlight-row"><td class="c-label">旧有效日期</td><td :style="{ color: getDateColor(detailItem.old_valid_until) }">{{ detailItem.old_valid_until || '(空)' }}</td></tr>
                </table>
              </div>
              <div class="compare-divider">→</div>
              <div class="compare-side cert-side">
                <div class="compare-label"><el-tag type="success" size="small">📄 新证书</el-tag></div>
                <table class="compare-table" v-if="detailCertMatch">
                  <tr><td class="c-label">证书编号</td><td class="new-value">{{ detailCertMatch.certificateNumber }}</td></tr>
                  <tr><td class="c-label">出厂编号</td><td :class="{ 'value-mismatch': detailCertMatch.serialNumber !== detailItem.serial_number }">{{ detailCertMatch.serialNumber }}</td></tr>
                  <tr><td class="c-label">检验日期</td><td class="new-value">{{ detailCertMatch.extractedInspectionDate || '-' }}</td></tr>
                  <tr><td class="c-label">有效日期</td><td class="new-value" style="font-weight:700">{{ detailCertMatch.calculatedValidUntil || '-' }}</td></tr>
                </table>
                <div v-else class="compare-empty">未匹配到证书</div>
              </div>
            </div>
            <div class="detail-actions" v-if="detailCertMatch">
              <el-button type="primary" size="small" @click="applySingleMatch(detailItem)">确认并更新台账</el-button>
              <el-button size="small" @click="skipItem(detailItem)">跳过</el-button>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="workspace-footer">
            <el-button type="primary" size="large" :loading="applyingUpdates" @click="applyAllMatched">
              全部确认并更新台账
            </el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 新建批次对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建送检批次" width="420px">
      <el-form @submit.prevent="createAndOpen">
        <el-form-item label="批次名称">
          <el-input v-model="newBatchName" placeholder="如：2026年7月压力表送检" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelCreate">取消</el-button>
        <el-button type="primary" :disabled="!newBatchName.trim()" :loading="creatingBatch" @click="createAndOpen">创建</el-button>
      </template>
    </el-dialog>

    <!-- 导入申请表对话框 -->
    <el-dialog v-model="showImportDialog" title="📥 导入检定申请表" width="480px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        上传检定申请表 Excel 文件，系统将自动解析其中的器具信息并创建送检批次。
      </el-alert>
      <el-upload
        ref="importUploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleImportFileChange"
        :on-remove="handleImportFileRemove"
        drag
      >
        <div class="upload-drag-area">
          <el-icon :size="36" color="#409EFF"><UploadFilled /></el-icon>
          <p>拖拽Excel到此处，或<em>点击选择文件</em></p>
        </div>
      </el-upload>
      <div v-if="importPreview" style="margin-top:16px">
        <el-divider />
        <p><strong>文件名：</strong>{{ importPreview.fileName }}</p>
        <p><strong>检测到 Sheet：</strong>{{ importPreview.sheetNames?.join(', ') }}</p>
        <p><strong>预估器具数：</strong>{{ importPreview.estimatedRows }}</p>
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!importFile" :loading="importingBatch" @click="executeImportBatch">
          解析并创建批次
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, UploadFilled, Document, List, Plus, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getInstruments, batchUploadCertificates, updateInstrument, exportWarningApply, exportManagementSummary,
  getInspectionBatches, createInspectionBatch, getInspectionBatch, updateInspectionBatch, deleteInspectionBatch,
  addBatchItems, updateBatchItem
} from '../api/instruments'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()

// ===== 批次列表 =====
const batches = ref([])
const loadingBatches = ref(false)
const showCreateDialog = ref(false)
const newBatchName = ref('')
const creatingBatch = ref(false)

// ===== 批次详情（工作区） =====
const batchId = ref(null)
const batchName = ref('')
const batchStatus = ref('draft')
const batchItems = ref([])

// ===== Excel 导入 =====
const showImportDialog = ref(false)
const importFile = ref(null)
const importPreview = ref(null)
const importingBatch = ref(false)
const importUploadRef = ref(null)

// ===== 证书 =====
const certFiles = ref([])
const certResults = ref([])
const uploadingCerts = ref(false)
const applyingUpdates = ref(false)

// ===== 选中 =====
const detailItem = ref(null)

const updatedCount = computed(() => batchItems.value.filter(i => i.match_status === 'updated').length)

const detailCertMatch = computed(() => {
  if (!detailItem.value) return null
  return certResults.value.find(c => c._matchedItemId === detailItem.value.id) || null
})

const CATEGORY_COLORS = { '压力变送器': '', '温度变送器': 'warning', '普通压力表': 'danger', '耐震压力表': 'danger', '压力表': 'danger' }
function getCategoryTagType(cat) { return CATEGORY_COLORS[cat] || 'info' }
function getDateColor(date) {
  if (!date) return '#909399'
  const diff = Math.ceil((new Date(date) - new Date()) / 86400000)
  return diff < 0 ? '#ef4444' : diff <= 30 ? '#f59e0b' : '#059669'
}

// ===== 匹配算法 =====
function calcSimilarity(a, b) {
  const sa = String(a || '').replace(/-/g, '').toLowerCase()
  const sb = String(b || '').replace(/-/g, '').toLowerCase()
  if (!sa || !sb) return 0
  const m = sa.length, n = sb.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = sa[i - 1] === sb[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
  return 1 - dp[m][n] / Math.max(m, n)
}

// ===== 数据加载 =====
async function loadBatchList() {
  loadingBatches.value = true
  try {
    const res = await getInspectionBatches()
    batches.value = res.data || []
  } catch (_) { /* ignore */ }
  finally { loadingBatches.value = false }
}

async function loadBatch(id) {
  try {
    const res = await getInspectionBatch(id)
    const batch = res.data
    batchId.value = batch.id
    batchName.value = batch.name
    batchStatus.value = batch.status
    batchItems.value = batch.items || []
    certResults.value = []
    certFiles.value = []
    detailItem.value = null
  } catch (err) {
    ElMessage.error('加载批次失败')
    router.replace({ path: '/inspection-workspace' })
  }
}

function openBatch(id) {
  router.replace({ path: '/inspection-workspace', query: { id: String(id) } })
}

function backToList() {
  router.replace({ path: '/inspection-workspace' })
}

function cancelCreate() {
  showCreateDialog.value = false
  newBatchName.value = ''
  // 清理 URL 中的 ids 参数
  if (route.query.ids) {
    router.replace({ path: '/inspection-workspace' })
  }
}

async function createAndOpen() {
  const name = newBatchName.value.trim()
  if (!name) return
  creatingBatch.value = true
  try {
    const idsParam = route.query.ids
    const instrumentIds = idsParam ? String(idsParam).split(',').map(Number).filter(Boolean) : []
    const res = await createInspectionBatch({ name, instrumentIds })
    showCreateDialog.value = false
    newBatchName.value = ''
    router.replace({ path: '/inspection-workspace', query: { id: String(res.data.id) } })
  } catch (err) {
    ElMessage.error('创建失败')
  } finally {
    creatingBatch.value = false
  }
}

// ===== Excel 导入批次 =====
function importFromExcel() {
  importFile.value = null
  importPreview.value = null
  showImportDialog.value = true
}

function handleImportFileChange(file) {
  importFile.value = file.raw
  importPreview.value = {
    fileName: file.name,
    sheetNames: [],
    estimatedRows: 0
  }
}

function handleImportFileRemove() {
  importFile.value = null
  importPreview.value = null
}

async function executeImportBatch() {
  if (!importFile.value) return
  importingBatch.value = true
  try {
    const formData = new FormData()
    formData.append('file', importFile.value)
    const authStore = useAuthStore()
    const res = await axios.post('/api/inspection-batches/import', formData, {
      headers: { Authorization: 'Bearer ' + authStore.token }
    })

    showImportDialog.value = false
    importFile.value = null
    importPreview.value = null

    const data = res.data
    ElMessage.success(`批次"${data.batchName}"创建成功，导入了 ${data.itemCount} 个器具`)
    // 刷新列表并打开新批次
    await loadBatchList()
    if (data.batchId) {
      router.replace({ path: '/inspection-workspace', query: { id: String(data.batchId) } })
    }
  } catch (err) {
    ElMessage.error('导入失败：' + (err.response?.data?.message || err.message))
  } finally {
    importingBatch.value = false
  }
}

async function markBatchCompleted() {
  if (!batchId.value) return
  try {
    await updateInspectionBatch(batchId.value, { status: 'completed' })
    batchStatus.value = 'completed'
    ElMessage.success('批次已标记为完成')
  } catch (_) { /* ignore */ }
}

async function deleteBatchConfirm(batch) {
  try {
    await ElMessageBox.confirm(`确定删除批次"${batch.name}"？所有批次数据将被清除。`, '确认删除', { type: 'warning' })
    await deleteInspectionBatch(batch.id)
    ElMessage.success('已删除')
    loadBatchList()
  } catch (_) { /* ignore */ }
}

// ===== 证书上传与匹配 =====
async function uploadAndMatch() {
  if (certFiles.value.length === 0) return
  uploadingCerts.value = true
  try {
    const rawFiles = certFiles.value.map(f => f.raw || f)
    const res = await batchUploadCertificates(rawFiles)

    // 匹配证书到批次项目
    for (const cert of (res.data.results || [])) {
      cert._matchedItemId = null
      if (cert.status === 'matched' && cert.matchedInstrument) {
        // 直接在批次项目中查找
        const item = batchItems.value.find(i => i.instrument_id === cert.matchedInstrument.id)
        if (item) {
          cert._matchedItemId = item.id
          // 保存匹配结果到批次
          await updateBatchItem(batchId.value, item.id, {
            new_certificate_number: cert.certificateNumber,
            new_inspection_date: cert.extractedInspectionDate || null,
            new_valid_until: cert.calculatedValidUntil || null,
            certificate_file: cert.savedCertificateFile || null,
            match_status: 'matched'
          })
        }
      } else if (cert.status === 'unmatched' && cert.serialNumber) {
        // 尝试模糊匹配到批次项目
        for (const item of batchItems.value) {
          const sim = calcSimilarity(cert.serialNumber, item.serial_number)
          if (sim >= 0.8) {
            cert._matchedItemId = item.id
            await updateBatchItem(batchId.value, item.id, {
              match_status: 'fuzzy'
            })
            break
          }
        }
      }
    }

    certResults.value = res.data.results
    certFiles.value = []
    loadBatch(batchId.value) // 刷新
    ElMessage.success('证书处理完成')
  } catch (err) {
    ElMessage.error('上传失败：' + (err?.response?.data?.message || err?.message || ''))
  } finally {
    uploadingCerts.value = false
  }
}

// ===== 核对操作 =====
function showDetail(item) { detailItem.value = item }
function showCertMatch(certRow) {
  if (certRow._matchedItemId) {
    const item = batchItems.value.find(i => i.id === certRow._matchedItemId)
    if (item) detailItem.value = item
  }
}

async function applySingleMatch(item) {
  const cert = detailCertMatch.value
  if (!cert) return
  try {
    const updateData = {
      certificate_number: cert.certificateNumber,
      _changeSource: 'inspection_batch'
    }
    if (cert.extractedInspectionDate) updateData.inspection_date = cert.extractedInspectionDate
    if (cert.calculatedValidUntil) updateData.valid_until = cert.calculatedValidUntil
    if (cert.savedCertificateFile) updateData.certificate_file = cert.savedCertificateFile

    await updateInstrument(item.instrument_id, updateData)
    await updateBatchItem(batchId.value, item.id, {
      new_certificate_number: cert.certificateNumber,
      new_inspection_date: cert.extractedInspectionDate || null,
      new_valid_until: cert.calculatedValidUntil || null,
      certificate_file: cert.savedCertificateFile || null,
      match_status: 'updated'
    })
    item.match_status = 'updated'
    ElMessage.success('已更新')
  } catch (err) {
    ElMessage.error('更新失败')
  }
}

function skipItem(item) {
  detailItem.value = null
}

async function applyAllMatched() {
  applyingUpdates.value = true
  let count = 0
  for (const item of batchItems.value) {
    const cert = certResults.value.find(c => c._matchedItemId === item.id)
    if (!cert || item.match_status === 'updated') continue
    try {
      const updateData = { certificate_number: cert.certificateNumber, _changeSource: 'inspection_batch' }
      if (cert.extractedInspectionDate) updateData.inspection_date = cert.extractedInspectionDate
      if (cert.calculatedValidUntil) updateData.valid_until = cert.calculatedValidUntil
      if (cert.savedCertificateFile) updateData.certificate_file = cert.savedCertificateFile
      await updateInstrument(item.instrument_id, updateData)
      await updateBatchItem(batchId.value, item.id, {
        new_certificate_number: cert.certificateNumber,
        new_inspection_date: cert.extractedInspectionDate || null,
        new_valid_until: cert.calculatedValidUntil || null,
        certificate_file: cert.savedCertificateFile || null,
        match_status: 'updated'
      })
      item.match_status = 'updated'
      count++
    } catch (_) { /* skip */ }
  }
  ElMessage.success(`已更新 ${count} 条器具`)
  applyingUpdates.value = false
}

// ===== 导出 =====
async function doExport(apiFn, filename) {
  const ids = batchItems.value.map(i => i.instrument_id).join(',')
  if (!ids) { ElMessage.warning('批次中没有器具'); return }
  try {
    const authStore = useAuthStore()
    const response = await axios.get(apiFn, {
      params: { ids }, responseType: 'blob',
      headers: { Authorization: 'Bearer ' + authStore.token }
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url; link.download = filename; link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    if (err.response?.data?.code === 400) {
      ElMessage.warning('没有符合条件的数据可导出')
    } else {
      ElMessage.error('导出失败')
    }
  }
}
function exportApplication() {
  doExport('/api/instruments/export/warning-apply', '检定申请表_' + new Date().toISOString().slice(0,10) + '.xlsx')
}
function exportManagementSheet() {
  doExport('/api/instruments/export/management-summary', '管理一览表_' + new Date().toISOString().slice(0,10) + '.xlsx')
}

// ===== 初始化 =====
onMounted(async () => {
  const idParam = route.query.id
  const idsParam = route.query.ids

  await loadBatchList()

  if (idParam) {
    // 批次详情模式
    await loadBatch(Number(idParam))
  } else if (idsParam) {
    // 从外部进入，有 ids 但没有批次 → 弹出创建对话框
    // 取消后留在批次列表
    newBatchName.value = '送检批次 ' + new Date().toISOString().slice(0, 10)
    showCreateDialog.value = true
  }
  // 默认：批次列表（batchId 仍为 null）
})

// 监听 URL 变化
watch(() => route.query.id, async (newId) => {
  if (newId) await loadBatch(Number(newId))
  else { batchId.value = null; await loadBatchList() }
})
</script>

<style scoped>
.workspace-page { height: calc(100vh - 80px); display: flex; flex-direction: column; }

/* Batch List */
.batch-list-page { padding: 20px; max-width: 800px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h3 { font-size: 20px; font-weight: 700; }
.batch-list { display: flex; flex-direction: column; gap: 10px; }
.batch-card {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; background: #fff; border: 1px solid #e4e7ed; border-radius: 8px;
  cursor: pointer; transition: all 0.2s;
}
.batch-card:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(79,110,247,0.1); }
.batch-name { font-weight: 600; font-size: 15px; }
.batch-meta { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.batch-date { font-size: 12px; color: #909399; }
.batch-card-right { display: flex; align-items: center; gap: 12px; }
.batch-count { font-size: 14px; color: #606266; font-weight: 500; }

/* Workspace */
.workspace-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; background: var(--card-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h3 { font-size: 17px; font-weight: 700; }
.header-actions { display: flex; gap: 8px; }

.workspace-body {
  flex: 1; display: flex; min-height: 0;
  border: 1px solid var(--border-color); border-top: none;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg); overflow: hidden;
}
.panel { display: flex; flex-direction: column; }
.panel-left { width: 42%; border-right: 1px solid var(--border-color); background: var(--card-bg); }
.panel-right { flex: 1; background: #fafbfc; overflow-y: auto; }

.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--border-color); background: #f8fafc; }
.panel-title { font-weight: 700; font-size: 14px; }
.panel-section { border-bottom: 1px solid var(--border-color); padding: 14px; }

.instrument-list { flex: 1; overflow-y: auto; padding: 8px; }
.instrument-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border: 1px solid #e4e7ed; border-radius: 8px;
  margin-bottom: 6px; cursor: pointer; transition: all 0.2s; background: #fff;
}
.instrument-row:hover { border-color: var(--primary-light); background: #fafcff; }
.instrument-row.active { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(79,110,247,0.15); }
.instrument-row.updated { border-left: 3px solid #22c55e; }
.inst-info { flex: 1; min-width: 0; }
.inst-line1 { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.inst-serial { font-size: 12px; font-weight: 600; color: var(--primary); background: #eff6ff; padding: 1px 6px; border-radius: 3px; }
.inst-line2 { font-size: 12px; color: #606266; }
.inst-line3 { font-size: 12px; margin-top: 2px; }

.upload-drag-area { text-align: center; padding: 12px; }
.upload-drag-area p { margin-top: 8px; color: #606266; font-size: 13px; }
.upload-drag-area em { color: var(--primary); font-style: normal; }

.detail-compare { display: flex; gap: 12px; align-items: stretch; }
.compare-side { flex: 1; }
.compare-label { margin-bottom: 8px; }
.compare-divider { display: flex; align-items: center; color: #c0c4cc; font-weight: bold; font-size: 18px; flex-shrink: 0; padding: 0 8px; }
.compare-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.compare-table td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; }
.c-label { color: #909399; width: 70px; font-size: 12px; }
.sys-serial { font-family: monospace; color: var(--primary); font-weight: 600; }
.new-value { color: #059669; font-weight: 500; }
.value-mismatch { color: #ef4444; font-weight: 600; background: #fef2f2; }
.highlight-row td { background: #fafcff; }
.compare-empty { text-align: center; padding: 20px; color: #909399; }
.detail-actions { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #ebeef5; display: flex; gap: 8px; }

.workspace-footer { padding: 14px; border-top: 1px solid var(--border-color); background: #fff; display: flex; gap: 10px; justify-content: center; }
.empty-state { text-align: center; padding: 80px 20px; }
</style>
