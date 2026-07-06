<template>
  <div class="import-page">
    <!-- 步骤条 -->
    <div class="steps-card">
      <el-steps :active="activeStep" align-center finish-status="success">
        <el-step title="上传文件" description="选择需要导入的Excel文件" />
        <el-step title="选择Sheet" description="选择要导入的工作表" />
        <el-step title="字段映射" description="逐Sheet确认列对应关系" />
        <el-step title="导入完成" description="查看导入结果" />
      </el-steps>
    </div>

    <!-- Step 1: 上传 -->
    <div v-if="activeStep === 0" class="content-panel">
      <div class="upload-area">
        <el-upload
          ref="uploadRef"
          class="upload-dragger"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
        >
          <div class="upload-content">
            <div class="upload-icon-circle">
              <el-icon :size="40"><UploadFilled /></el-icon>
            </div>
            <h4>将Excel文件拖到此处，或 <em>点击上传</em></h4>
            <p class="upload-hint">支持 .xlsx / .xls 格式，自动识别多个工作表</p>
          </div>
        </el-upload>
      </div>

      <div v-if="parseResult" class="parse-summary">
        <el-alert
          :title="'文件解析成功：检测到 ' + parseResult.sheets.length + ' 个工作表，共约 ' + totalAllRows + ' 条数据'"
          type="success"
          :closable="false"
          show-icon
        />
        <div style="text-align:center;margin-top:20px;">
          <el-button type="primary" size="large" @click="activeStep = 1">
            下一步：选择要导入的工作表
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Step 2: 选择Sheet + 预览 -->
    <div v-if="activeStep === 1" class="content-panel">
      <el-alert
        title="请选择要导入的工作表（支持多选）。不同工作表将分别进行字段映射。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom:20px;"
      />

      <!-- 全选控制 -->
      <div class="sheet-select-actions" v-if="parseResult && parseResult.sheets.length > 1">
        <el-checkbox
          :model-value="allSheetsSelected"
          :indeterminate="someSheetsSelected && !allSheetsSelected"
          @change="toggleAllSheets"
        >
          全选
        </el-checkbox>
        <span class="selected-count">已选 {{ selectedSheetIndices.size }} / {{ parseResult.sheets.length }} 个工作表</span>
      </div>

      <!-- Sheet列表 -->
      <div class="sheet-list">
        <div
          v-for="(sheet, idx) in parseResult.sheets"
          :key="sheet.name"
          :class="['sheet-card', { active: selectedSheetIndices.has(idx) }]"
          @click="toggleSheet(idx)"
        >
          <div class="sheet-card-checkbox">
            <el-checkbox
              :model-value="selectedSheetIndices.has(idx)"
              @click.stop
              @change="toggleSheet(idx)"
            />
          </div>
          <div class="sheet-card-header">
            <div class="sheet-name">
              <el-icon><Document /></el-icon>
              {{ sheet.name }}
            </div>
            <el-tag size="small" type="primary" effect="dark">{{ sheet.category }}</el-tag>
          </div>
          <div class="sheet-card-body">
            <div class="sheet-stat">
              <span class="stat-num">{{ sheet.totalRows }}</span>
              <span class="stat-unit">条数据</span>
            </div>
            <div class="sheet-stat">
              <span class="stat-num">{{ sheet.columns.length }}</span>
              <span class="stat-unit">个字段</span>
            </div>
          </div>
          <div class="sheet-card-footer">
            <span class="sheet-preview-label">字段预览：</span>
            <span class="sheet-preview-text">{{ sheet.columns.slice(0, 6).join('、') }}{{ sheet.columns.length > 6 ? '…' : '' }}</span>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:24px;" v-if="selectedSheetIndices.size > 0">
        <el-button @click="activeStep = 0">上一步</el-button>
        <el-button type="primary" size="large" @click="goToMapping">
          下一步：确认字段映射（{{ selectedSheetIndices.size }}个工作表）
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
      <div style="text-align:center;margin-top:24px;color:var(--text-muted);" v-else>
        <el-button @click="activeStep = 0">上一步</el-button>
        <span style="margin-left:12px;">请至少选中一个工作表，然后点击下一步</span>
      </div>
    </div>

    <!-- Step 3: 映射确认 — 每个Sheet独立标签页 -->
    <div v-if="activeStep === 2" class="content-panel">
      <el-alert
        title="每个工作表可独立设置类别和字段映射。系统已根据表头自动匹配，请逐Sheet确认。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom:16px;"
      />

      <!-- Sheet Tabs -->
      <el-tabs v-model="activeSheetTab" type="card" class="sheet-mapping-tabs">
        <el-tab-pane
          v-for="(sm, idx) in sheetMappingList"
          :key="sm.sheetName"
          :label="sm.sheetName + ' (' + sm.totalRows + '条)'"
          :name="idx"
        >
          <!-- 类别选择 -->
          <div class="mapping-info-bar">
            <el-tag type="primary" size="large" effect="dark">
              {{ sm.sheetName }}
            </el-tag>
            <span class="mapping-cat-label">器具类别：</span>
            <el-select
              v-model="sm.category"
              placeholder="选择或输入类别"
              filterable
              allow-create
              size="default"
              style="width:200px"
            >
              <el-option v-for="cat in allCategories" :key="cat" :label="cat" :value="cat" />
            </el-select>
            <el-tag type="info" size="small" effect="plain" style="margin-left:12px;">
              共 {{ sm.totalRows }} 条数据
            </el-tag>
          </div>

          <!-- 映射表 -->
          <el-table :data="sm.columns.map(col => ({ column: col, mapped: sm.mapping[col] || null }))" border stripe size="small" class="mapping-table" style="margin-top:12px;">
            <el-table-column prop="column" label="Excel 列名" width="240">
              <template #default="{ row }">
                <span class="excel-col-name">{{ row.column }}</span>
              </template>
            </el-table-column>

            <el-table-column label="映射为系统字段" width="260">
              <template #default="{ row }">
                <el-select v-model="sm.mapping[row.column]" placeholder="-- 忽略此列 --" clearable size="small" style="width:100%">
                  <el-option v-for="opt in FIELD_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </template>
            </el-table-column>

            <el-table-column label="数据预览（前3条）">
              <template #default="{ row }">
                <span class="preview-text">{{ getSheetPreview(sm.sheetName, row.column) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <!-- 操作按钮 -->
      <div class="mapping-actions">
        <el-button @click="activeStep = 1">上一步</el-button>
        <el-button type="primary" size="large" :loading="importing" @click="handleImport">
          <el-icon><Upload /></el-icon>
          确认导入 {{ totalSelectedRows }} 条
        </el-button>
      </div>
    </div>

    <!-- Step 4: 冲突处理 -->
    <div v-if="activeStep === 3 && importResult.needsResolution" class="content-panel">
      <div class="conflict-resolution">
        <el-alert type="warning" :closable="false" show-icon style="margin-bottom:20px">
          <template #title>
            导入成功 <strong>{{ importResult.successRows }}</strong> 条，但有
            <strong>{{ importResult.conflictCount }} 条</strong> 数据的出厂编号与系统现有记录冲突
          </template>
          请逐条选择处理策略后点击"应用处理"。
        </el-alert>

        <!-- 批量操作工具栏 -->
        <div class="conflict-toolbar">
          <span style="font-size:14px;color:#606266;margin-right:8px">批量设置：</span>
          <el-button size="small" @click="batchSetAction('update')">全部 → 以台账为准</el-button>
          <el-button size="small" @click="batchSetAction('keep')">全部 → 以系统为准</el-button>
          <el-button size="small" @click="batchSetAction('create_new')">全部 → 强制新建</el-button>
          <el-button size="small" @click="batchSetAction('skip')">全部 → 跳过</el-button>
          <el-tag type="info" size="small" style="margin-left:12px">
            已处理 {{ resolvedCount }} / {{ importResult.conflictCount }}
          </el-tag>
        </div>

        <!-- 冲突对比列表 -->
        <div class="conflict-list">
          <div v-for="(conflict, idx) in importResult.conflicts" :key="idx"
            class="conflict-card" :class="{ resolved: conflict._action }">
            <div class="conflict-card-header">
              <span class="conflict-index">#{{ idx + 1 }}</span>
              <el-tag size="small" type="warning">{{ conflict.sourceSheet }} / 第{{ conflict.sourceRow }}行</el-tag>
              <span class="conflict-serial">
                出厂编号：<code>{{ conflict.importData.serial_number }}</code>
              </span>
              <span class="conflict-existing-id" v-if="conflict.existingRecord">
                系统记录：<el-tag size="small" type="info">#{{ conflict.existingRecord.id }}</el-tag>
              </span>
            </div>

            <!-- 对比视图 -->
            <div class="conflict-compare" v-if="conflict.conflictFields && conflict.conflictFields.length > 0">
              <div class="compare-side import-side">
                <div class="compare-label"><el-tag type="primary" size="small">📥 台账数据（导入）</el-tag></div>
                <table class="compare-table">
                  <tr v-for="field in conflict.conflictFields" :key="field.field">
                    <td class="field-label">{{ field.label }}</td>
                    <td class="field-value import-value">{{ field.importValue || '(空)' }}</td>
                  </tr>
                </table>
              </div>
              <div class="compare-divider">⟷</div>
              <div class="compare-side system-side">
                <div class="compare-label"><el-tag type="success" size="small">💾 系统记录（已有）</el-tag></div>
                <table class="compare-table">
                  <tr v-for="field in conflict.conflictFields" :key="field.field">
                    <td class="field-label">{{ field.label }}</td>
                    <td class="field-value system-value">{{ field.systemValue || '(空)' }}</td>
                  </tr>
                </table>
              </div>
            </div>
            <div v-else style="text-align:center;color:#909399;padding:12px 0">
              所有字段与系统一致
            </div>

            <!-- 处理策略选择 -->
            <div class="conflict-actions">
              <span class="action-label">处理策略：</span>
              <el-radio-group v-model="conflict._action" size="small">
                <el-radio-button value="update">以台账为准（更新系统）</el-radio-button>
                <el-radio-button value="keep">以系统为准（保留不变）</el-radio-button>
                <el-radio-button value="create_new">强制新建（允许重复编号）</el-radio-button>
                <el-radio-button value="skip">跳过此行</el-radio-button>
              </el-radio-group>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div style="text-align:center;margin-top:24px">
          <el-button @click="resetImport">取消导入</el-button>
          <el-button type="primary" size="large" :loading="resolvingConflicts"
            :disabled="resolvedCount < importResult.conflictCount"
            @click="resolveConflicts">
            应用处理（{{ resolvedCount }}/{{ importResult.conflictCount }}）
          </el-button>
        </div>
      </div>
    </div>

    <!-- Step 4: 结果（无冲突情况） -->
    <div v-if="activeStep === 3 && !importResult.needsResolution" class="content-panel">
      <div class="result-area">
        <el-result
          :icon="importResult.failRows === 0 ? 'success' : 'warning'"
          :title="importResult.failRows === 0 ? '全部导入成功！' : '导入完成'"
          :sub-title="'成功 ' + importResult.successRows + ' 条，失败 ' + importResult.failRows + ' 条'"
        >
          <template #extra>
            <el-button type="primary" @click="$router.push('/instruments')">
              <el-icon><List /></el-icon> 查看台账
            </el-button>
            <el-button @click="resetImport">
              <el-icon><Refresh /></el-icon> 继续导入
            </el-button>
          </template>
        </el-result>

        <!-- 多Sheet结果汇总 -->
        <div v-if="importResult.sheets && importResult.sheets.length >= 1" class="sheet-results-section">
          <el-divider content-position="left">各工作表导入详情</el-divider>
          <el-table :data="importResult.sheets" border stripe size="small">
            <el-table-column prop="sheet" label="工作表" />
            <el-table-column prop="successRows" label="成功" width="80" align="center">
              <template #default="{ row }">
                <span style="color:#059669;font-weight:600;">{{ row.successRows }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="failRows" label="失败" width="80" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.failRows > 0 ? '#ef4444' : '#999', fontWeight: '600' }">{{ row.failRows }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="importResult.errors && importResult.errors.length > 0" class="error-section">
          <el-divider content-position="left">
            <span style="color:#ef4444;">失败详情（{{ importResult.errors.length }} 条）</span>
          </el-divider>
          <el-table :data="importResult.errors" border stripe size="small" max-height="400">
            <el-table-column prop="row" label="行号" width="180" align="center" />
            <el-table-column label="错误原因">
              <template #default="{ row }">
                <div v-for="(err, i) in row.errors" :key="i" class="error-item">
                  <el-icon :size="14"><WarningFilled /></el-icon>
                  {{ err }}
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { UploadFilled, ArrowRight, Upload, Refresh, List, WarningFilled, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { uploadExcel, confirmImport, getCategories, resolveImportConflicts } from '../api/instruments'
import { FIELD_OPTIONS, CATEGORIES } from '../utils/constants'

const activeStep = ref(0)
const importing = ref(false)
const resolvingConflicts = ref(false)
const uploadRef = ref(null)
const currentFile = ref(null)
const parseResult = ref(null)
const uploadedFilePath = ref(null)
const selectedSheetIndices = reactive(new Set())
const allCategories = ref(CATEGORIES)

const importResult = ref({ successRows: 0, failRows: 0, errors: [] })

const resolvedCount = computed(() => {
  if (!importResult.value?.conflicts) return 0
  return importResult.value.conflicts.filter(c => c._action).length
})

// 每个选中Sheet的映射数据（独立）
const sheetMappingList = reactive([])
const activeSheetTab = ref(0)

const totalAllRows = computed(() => {
  if (!parseResult.value) return 0
  return parseResult.value.sheets.reduce((sum, s) => sum + s.totalRows, 0)
})

const allSheetsSelected = computed(() => {
  if (!parseResult.value) return false
  return selectedSheetIndices.size === parseResult.value.sheets.length && parseResult.value.sheets.length > 0
})

const someSheetsSelected = computed(() => {
  return selectedSheetIndices.size > 0
})

const totalSelectedRows = computed(() => {
  return sheetMappingList.reduce((sum, sm) => sum + sm.totalRows, 0)
})

function getSheetPreview(sheetName, column) {
  if (!parseResult.value) return ''
  const sheet = parseResult.value.sheets.find(s => s.name === sheetName)
  if (!sheet) return ''
  const samples = sheet.preview.slice(0, 3)
    .map(row => row[column] || '')
    .filter(Boolean)
  return samples.length > 0 ? samples.join(' / ') : '(空)'
}

function toggleSheet(idx) {
  if (selectedSheetIndices.has(idx)) {
    selectedSheetIndices.delete(idx)
  } else {
    selectedSheetIndices.add(idx)
  }
}

function toggleAllSheets(val) {
  if (!parseResult.value) return
  if (val) {
    parseResult.value.sheets.forEach((_, i) => selectedSheetIndices.add(i))
  } else {
    selectedSheetIndices.clear()
  }
}

function buildSheetMappingList() {
  // 清空旧的映射列表
  sheetMappingList.splice(0, sheetMappingList.length)

  if (!parseResult.value) return

  // 为每个选中的Sheet创建独立的映射数据
  const sortedIndices = [...selectedSheetIndices].sort((a, b) => a - b)
  for (const idx of sortedIndices) {
    const sheet = parseResult.value.sheets[idx]
    if (!sheet) continue

    // 深拷贝自动映射
    const mapping = {}
    if (sheet.mapping) {
      Object.assign(mapping, sheet.mapping)
    }

    sheetMappingList.push({
      sheetName: sheet.name,
      category: sheet.category || '',
      totalRows: sheet.totalRows,
      columns: sheet.columns,
      mapping
    })
  }
}

function goToMapping() {
  if (selectedSheetIndices.size === 0) {
    ElMessage.warning('请至少选择一个工作表')
    return
  }
  buildSheetMappingList()
  activeSheetTab.value = 0
  activeStep.value = 2
}

async function handleFileChange(file) {
  currentFile.value = file.raw
  try {
    const res = await uploadExcel(file.raw)
    parseResult.value = res.data

    // 保存后端返回的精确文件路径，confirm 时传回以防并发串扰
    uploadedFilePath.value = res.data._filePath

    // 默认不选中任何Sheet — 让用户自己选择
    selectedSheetIndices.clear()
  } catch (err) {
    currentFile.value = null
    uploadedFilePath.value = null
    uploadRef.value?.clearFiles()
  }
}

function handleFileRemove() {
  currentFile.value = null
  parseResult.value = null
  uploadedFilePath.value = null
  selectedSheetIndices.clear()
  sheetMappingList.splice(0, sheetMappingList.length)
}

async function handleImport() {
  // 构建每个Sheet的映射数据
  const sheetMappings = sheetMappingList.map(sm => {
    const cleanMapping = {}
    for (const [key, val] of Object.entries(sm.mapping)) {
      if (val) cleanMapping[key] = val
    }
    return {
      sheetName: sm.sheetName,
      category: sm.category,
      mapping: cleanMapping
    }
  })

  // 校验：至少有一个Sheet有映射
  const hasAnyMapping = sheetMappings.some(sm => Object.keys(sm.mapping).length > 0)
  if (!hasAnyMapping) {
    ElMessage.warning('请至少为一个工作表映射字段')
    return
  }

  // 校验：每个Sheet都必须有类别
  const missingCategory = sheetMappings.find(sm => !sm.category && Object.keys(sm.mapping).length > 0)
  if (missingCategory) {
    ElMessage.warning('工作表 "' + missingCategory.sheetName + '" 未设置器具类别，请补充')
    // 切换到对应标签页
    const tabIdx = sheetMappingList.findIndex(sm => sm.sheetName === missingCategory.sheetName)
    if (tabIdx >= 0) activeSheetTab.value = tabIdx
    return
  }

  importing.value = true
  try {
    const res = await confirmImport({
      fileName: currentFile.value?.name || '',
      filePath: uploadedFilePath.value,
      sheetMappings
    })
    importResult.value = res.data
    activeStep.value = 3
  } catch (err) {
    // handled by interceptor
  } finally {
    importing.value = false
  }
}

function resetImport() {
  activeStep.value = 0
  currentFile.value = null
  parseResult.value = null
  uploadedFilePath.value = null
  selectedSheetIndices.clear()
  sheetMappingList.splice(0, sheetMappingList.length)
  activeSheetTab.value = 0
  importResult.value = { successRows: 0, failRows: 0, errors: [] }
  uploadRef.value?.clearFiles()
}

// === 冲突处理 ===
function batchSetAction(action) {
  if (!importResult.value?.conflicts) return
  importResult.value.conflicts.forEach(c => {
    if (!c._action) c._action = action
  })
}

async function resolveConflicts() {
  if (!importResult.value?.conflicts) return

  const unresolved = importResult.value.conflicts.filter(c => !c._action)
  if (unresolved.length > 0) {
    ElMessage.warning('还有 ' + unresolved.length + ' 条冲突未选择处理策略')
    return
  }

  resolvingConflicts.value = true
  try {
    const fileData = importResult.value.conflictFileData
    if (!fileData) {
      ElMessage.error('缺少导入文件信息，请重新上传')
      return
    }

    const resolutions = importResult.value.conflicts.map(c => ({
      index: c.index,
      action: c._action,
      importData: c.importData,
      existingId: c.existingRecord?.id
    }))

    const res = await resolveImportConflicts({
      filePath: fileData.filePath,
      fileName: fileData.fileName,
      resolutions
    })

    importResult.value.needsResolution = false
    importResult.value.successRows += (res.data.updated + res.data.created)
    importResult.value.failRows += res.data.errors.length

    if (res.data.errors && res.data.errors.length > 0) {
      importResult.value.errors = [...(importResult.value.errors || []), ...res.data.errors.map(e =>
        ({ row: '冲突 #' + (e.index + 1), errors: [e.error] })
      )]
    }

    ElMessage.success(
      '冲突处理完成：更新 ' + res.data.updated + ' 条，跳过 ' + res.data.skipped +
      ' 条，保留 ' + res.data.kept + ' 条，新建 ' + res.data.created + ' 条'
    )
  } catch (err) {
    ElMessage.error('冲突处理失败：' + (err.response?.data?.message || err.message))
  } finally {
    resolvingConflicts.value = false
  }
}

onMounted(async () => {
  try {
    const catRes = await getCategories()
    if (catRes.data && catRes.data.length > 0) allCategories.value = catRes.data
  } catch (e) { /* use default */ }
})
</script>

<style scoped>
.import-page {
  max-width: 960px;
  margin: 0 auto;
}

/* 步骤条 */
.steps-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 32px 40px;
  margin-bottom: 20px;
}

/* 内容面板 */
.content-panel {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 28px;
}

/* 上传区 */
.upload-content {
  padding: 40px 20px;
  text-align: center;
}

.upload-icon-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #eff6ff;
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.upload-content h4 {
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.upload-content h4 em {
  color: var(--primary);
  font-style: normal;
  font-weight: 600;
}

.upload-hint {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

.parse-summary { margin-top: 24px; }

/* ============ 多选控制 ============ */
.sheet-select-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.selected-count {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ============ Sheet 选择卡片 ============ */
.sheet-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.sheet-card {
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: all var(--transition);
  background: #fafbfc;
  position: relative;
}

.sheet-card:hover {
  border-color: var(--primary-light);
  box-shadow: var(--shadow-md);
}

.sheet-card.active {
  border-color: var(--primary);
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(79,110,247,0.12);
}

.sheet-card-checkbox {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
}

.sheet-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sheet-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sheet-card-body {
  display: flex;
  gap: 24px;
  margin-bottom: 10px;
}

.sheet-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-unit {
  font-size: 12px;
  color: var(--text-secondary);
}

.sheet-card-footer {
  border-top: 1px dashed var(--border-color);
  padding-top: 10px;
}

.sheet-preview-label {
  font-size: 12px;
  color: var(--text-muted);
}

.sheet-preview-text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ============ 映射标签页 ============ */
.sheet-mapping-tabs {
  margin-bottom: 0;
}

.sheet-mapping-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.mapping-info-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.mapping-cat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-left: 8px;
  font-weight: 500;
}

.excel-col-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.preview-text {
  font-size: 13px;
  color: var(--text-muted);
  word-break: break-all;
}

.mapping-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.mapping-table {
  border-radius: var(--radius-sm);
  overflow: hidden;
}

/* ============ 结果 ============ */
.result-area { text-align: center; }

.sheet-results-section {
  margin-top: 20px;
  text-align: left;
}

.error-section {
  margin-top: 24px;
  text-align: left;
}

.error-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 2px;
}

/* === 冲突处理 === */
.conflict-resolution {
  text-align: left;
}

.conflict-toolbar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 8px;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
  transition: border-color 0.3s;
}

.conflict-card.resolved {
  border-color: #67c23a;
}

.conflict-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #ebeef5;
  flex-wrap: wrap;
}

.conflict-index {
  font-weight: 700;
  font-size: 15px;
  color: #303133;
}

.conflict-serial {
  font-size: 13px;
  color: #606266;
}

.conflict-serial code {
  background: #f0f2f5;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.conflict-compare {
  display: flex;
  gap: 12px;
  align-items: stretch;
  margin-bottom: 14px;
}

.compare-side {
  flex: 1;
  min-width: 0;
}

.compare-label {
  margin-bottom: 8px;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
}

.compare-table td {
  padding: 5px 8px;
  border-bottom: 1px solid #f2f3f5;
  font-size: 13px;
}

.compare-table .field-label {
  color: #909399;
  width: 85px;
  white-space: nowrap;
  font-size: 12px;
}

.compare-table .field-value {
  border-radius: 3px;
  padding: 2px 8px;
  font-family: monospace;
  font-size: 12px;
}

.compare-side.import-side .field-value {
  background: #ecf5ff;
  color: #409eff;
}

.compare-side.system-side .field-value {
  background: #f0f9eb;
  color: #67c23a;
}

.compare-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  width: 30px;
  flex-shrink: 0;
  font-size: 18px;
  font-weight: bold;
}

.conflict-actions {
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
  display: flex;
  align-items: center;
  gap: 10px;
}

.conflict-actions .action-label {
  color: #606266;
  font-size: 13px;
  font-weight: 500;
}
</style>
