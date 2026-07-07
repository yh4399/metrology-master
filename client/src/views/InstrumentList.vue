<template>
  <div class="instrument-list-page">
    <!-- 搜索筛选卡片 -->
    <div class="filter-card">
      <div class="filter-header">
        <h4>🔍 筛选条件</h4>
        <div class="filter-header-actions">
          <el-button type="success" @click="photoSearchVisible = true"><el-icon><Camera /></el-icon> 拍照查找</el-button>
          <el-button type="primary" @click="$router.push('/instruments/add')"><el-icon><Plus /></el-icon> 新增器具</el-button>
        </div>
      </div>
      <div class="filter-body">
        <div class="filter-row">
          <el-input v-model="filters.keyword" placeholder="搜索：出厂编号 / 型号 / 厂家 / 位置 / 证书编号" clearable size="default"
            class="filter-search-input" @input="onSearchDebounce" @clear="fetchList">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filters.category" placeholder="全部类别" clearable size="default" @change="fetchList" style="width:140px;flex-shrink:0">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable size="default" @change="fetchList" style="width:120px;flex-shrink:0">
            <el-option v-for="opt in STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-select v-model="filters.classification" placeholder="全部分类" clearable size="default" @change="fetchList" style="width:110px;flex-shrink:0">
            <el-option label="A 类" value="A" /><el-option label="B 类" value="B" /><el-option label="C 类" value="C" />
          </el-select>
          <el-button type="primary" @click="fetchList" style="flex-shrink:0"><el-icon><Search /></el-icon> 搜索</el-button>
          <el-button @click="resetFilters" style="flex-shrink:0"><el-icon><Refresh /></el-icon> 重置</el-button>
          <div class="filter-spacer"></div>
          <el-button @click="$router.push('/instruments/import')" style="flex-shrink:0"><el-icon><Upload /></el-icon> 导入Excel</el-button>
          <el-dropdown trigger="click" @command="handleExportCommand" style="flex-shrink:0">
            <el-button type="default"><el-icon><Download /></el-icon> 导出 <el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="export-all">📋 导出全部（台帐格式）</el-dropdown-item>
                <el-dropdown-item command="summary-selected" :disabled="selectedRows.length === 0">📊 导出管理一览表（选中 {{ selectedRows.length }} 条）</el-dropdown-item>
                <el-dropdown-item command="summary-all">📊 导出管理一览表（全部）</el-dropdown-item>
                <el-dropdown-item divided command="apply-selected" :disabled="selectedRows.length === 0">📝 导出检定申请表（选中 {{ selectedRows.length }} 条）</el-dropdown-item>
                <el-dropdown-item command="apply-all">📝 导出检定申请表（全部）</el-dropdown-item>
                <el-dropdown-item divided command="workspace-selected" style="color:#409EFF;font-weight:600">🔧 送检工作台{{ selectedRows.length > 0 ? '（选中 ' + selectedRows.length + ' 条）' : '' }}</el-dropdown-item>
                <el-dropdown-item divided command="custom-apply" style="color:#e6a23c">✏️ 自定义导出（自选列）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="success" plain @click="batchCertVisible = true" style="flex-shrink:0"><el-icon><UploadFilled /></el-icon> 批量上传证书</el-button>
          <el-button type="warning" plain @click="certCheckVisible = true" style="flex-shrink:0"><el-icon><Warning /></el-icon> 证书日期校验</el-button>
          <el-button plain @click="rulesConfigVisible = true" style="flex-shrink:0"><el-icon><Setting /></el-icon> 有效期规则</el-button>
          <el-button plain @click="ledgerViewVisible = true" style="flex-shrink:0"><el-icon><FolderOpened /></el-icon> 查看台账总表</el-button>
          <el-button plain @click="uploadLedgerDialog = true" style="flex-shrink:0"><el-icon><Upload /></el-icon> 上传台账总表</el-button>
          <el-button plain @click="recycleBinVisible = true" style="flex-shrink:0"><el-icon><Delete /></el-icon> 回收站</el-button>
          <el-dropdown trigger="click" @command="handleClearCommand" style="flex-shrink:0">
            <el-button type="danger" plain><el-icon><Delete /></el-icon> 清空数据 <el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="clear-category"><el-icon><FolderDelete /></el-icon> 按类别清空...</el-dropdown-item>
                <el-dropdown-item command="clear-all" divided><el-icon><Warning /></el-icon> 清空全部数据</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div v-if="activeFilterCount > 0" class="active-filters">
          <span class="filter-tags-label">当前筛选：</span>
          <el-tag v-if="filters.keyword" closable size="small" type="primary" @close="filters.keyword = ''; fetchList()">关键词：{{ filters.keyword }}</el-tag>
          <el-tag v-if="filters.category" closable size="small" type="success" @close="filters.category = ''; fetchList()">类别：{{ filters.category }}</el-tag>
          <el-tag v-if="filters.status" closable size="small" :type="filters.status === 'active' ? 'success' : filters.status === 'scrapped' ? 'info' : 'warning'" @close="filters.status = ''; fetchList()">状态：{{ STATUS_MAP[filters.status] || filters.status }}</el-tag>
          <el-tag v-if="filters.classification" closable size="small" type="info" @close="filters.classification = ''; fetchList()">分类管理：{{ filters.classification }} 类</el-tag>
          <el-tag v-if="filters.validDate" closable size="small" type="danger" @close="filters.validDate = ''; fetchList()">有效日期：{{ filters.validDate }}</el-tag>
          <el-tag v-if="filters.inspectionDate" closable size="small" type="warning" @close="filters.inspectionDate = ''; fetchList()">检验日期：{{ filters.inspectionDate }}</el-tag>
          <el-button text size="small" type="primary" @click="resetFilters">清除全部筛选</el-button>
        </div>
      </div>
    </div>

    <!-- ====== 对话框组件 ====== -->
    <PhotoSearchDialog v-model:visible="photoSearchVisible" :loading="photoSearchLoading"
      :photoSearchPreview="photoSearchPreview" :result="photoSearchResult" :photoUrlWithToken="photoUrlWithToken"
      @fileSelect="handlePhotoSearchFile" @goDetail="(id) => { photoSearchVisible = false; $router.push('/instruments/' + id) }" />

    <BatchCertUploadDialog v-model:visible="batchCertVisible" :files="batchFiles"
      :uploading="batchUploading" :progress="batchProgress" :results="batchResults" :summary="batchSummary"
      @reset="resetBatchUpload" @upload="handleBatchUpload" @clearResults="clearBatchResults"
      @multiMatch="openMultiMatchDialog" @unmatchedAction="handleUnmatchedAction" />

    <FuzzyMatchDialog v-model:visible="fuzzyMatchVisible" :cert="activeUnmatched"
      :candidates="fuzzyCandidates" :searching="fuzzySearching" :searched="fuzzySearched"
      @confirm="confirmFuzzyMatch" @createNew="handleUnmatchedAction('create', activeUnmatched)" @search="(kw) => { fuzzySearchKeyword = kw; searchFuzzyMatch() }" />

    <ConfirmMatchDialog v-model:visible="confirmMatchVisible" v-model:updateSerial="confirmUpdateSerial"
      :cert="activeUnmatched" :target="confirmMatchTarget" :loading="forceMatching" @confirm="doExecuteForceMatch" />

    <ManualMatchDialog v-model:visible="manualMatchVisible" :cert="activeUnmatched"
      :candidates="manualCandidates" :searching="manualSearching" :selected="manualTarget"
      @search="(kw) => { manualSearchKeyword = kw; loadManualCandidates() }" @select="selectManualTarget" @confirm="confirmManualMatch" />

    <CreateFromCertDialog v-model:visible="createFromCertVisible" :form="newFromCertForm"
      :categories="categories" :loading="creatingFromCert" @confirm="executeCreateFromCert" />

    <MultiMatchDialog v-model:visible="multiMatchVisible" :cert="multiMatchCert"
      :selected="multiMatchSelected" :loading="multiMatching" :dateColor="getMmDateColor"
      @toggle="toggleMultiSelect" @confirm="executeMultiMatch" />

    <CertCheckDialog v-model:visible="certCheckVisible" :loading="certCheckLoading" :data="certCheckData"
      :onlyMismatch="certCheckOnlyMismatch" :selected="certCheckSelected"
      @load="loadCertCheck" @update:selected="(v) => certCheckSelected = v" @batchUpdate="handleBatchUpdateDates" />

    <RulesConfigDialog v-model:visible="rulesConfigVisible" :loading="rulesLoading" :rules="rulesList"
      @load="loadRules" @reset="handleResetRules" @addRule="openRuleForm(null)" @editRule="openRuleForm" @deleteRule="handleDeleteRule" />

    <RuleFormDialog v-model:visible="ruleFormVisible" :editing="!!editingRule" :form="ruleForm"
      :categories="categories" @save="saveRule" />

    <ClearCategoryDialog v-model:visible="clearCategoryVisible" :categories="categories"
      :counts="categoryCounts" :loading="clearCategoryLoading" @confirm="(cat) => { clearCategory = cat; handleClearByCategory().then(r => r && fetchList()) }" />

    <UploadLedgerDialog v-model:visible="uploadLedgerDialog" :hasFile="!!ledgerFile" :uploading="uploadingLedger"
      @fileChange="handleLedgerFileChange" @fileRemove="handleLedgerFileRemove" @upload="handleUploadLedger" />

    <LedgerViewDialog v-model:visible="ledgerViewVisible" :loading="ledgerViewLoading"
      :sheets="ledgerSheets" :history="ledgerHistory" :currentFile="ledgerCurrentFile"
      :editingRow="ledgerEditing" :adding="ledgerAdding" :editRow="ledgerEditRow" :newRow="ledgerNewRow"
      :editCell="ledgerEditCell" v-model:editValue="ledgerEditValue"
      :readOnly="ledgerReadOnly" :fmtLabel="fmtLedgerHistoryLabel" :title="ledgerTitle"
      @load="loadLedgerView()" @switchVersion="switchLedgerVersion" @deleteVersion="confirmDeleteLedgerVersion"
      @download="downloadLedger" @addRow="startAddLedgerRow"
      @editRow="editLedgerRow" @saveRow="saveLedgerRow" @deleteRow="deleteLedgerRowConfirm"
      @saveNewRow="saveNewLedgerRow" @cancelEdit="cancelLedgerEdit"
      @startCellEdit="startCellEdit" @saveCellEdit="saveCellEdit" />

    <ExportColumnsDialog v-model:visible="exportColumnsVisible" :fieldOptions="EXPORT_FIELD_OPTIONS"
      :selected="exportSelectedColumns" @toggle="toggleExportColumn" @confirm="confirmExportWithColumns" />

    <InstrumentHistoryDrawer v-model="historyVisible" :instrument="historyInstrument" @restored="fetchList" />
    <InstrumentRecycleBin v-model="recycleBinVisible" @restored="fetchList" />

    <!-- ====== 数据表格 ====== -->
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">
          <span>📋 计量器具台账</span>
          <el-tag type="info" size="small" effect="plain" round>共 {{ pagination.total }} 条</el-tag>
        </div>
        <div class="table-actions">
          <el-tooltip content="左右滑动查看更多列" placement="top">
            <span class="scroll-hint"><el-icon><DArrowRight /></el-icon> 横向滚动查看更多</span>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleSelectAllCommand" style="flex-shrink:0">
            <el-button size="small" plain><el-icon><Select /></el-icon> 全选 <el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="select-page">📄 全选当前页（{{ tableData.length }} 条）</el-dropdown-item>
                <el-dropdown-item command="select-all">📋 全选所有筛选结果（{{ pagination.total }} 条）</el-dropdown-item>
                <el-dropdown-item command="clear-selection" divided>✖ 清除选中</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span v-if="selectAllMode" class="select-all-badge">🟢 已全选 {{ pagination.total }} 条</span>
          <el-button :type="denseMode ? 'primary' : 'default'" size="small" plain @click="denseMode = !denseMode">{{ denseMode ? '紧凑' : '默认' }}模式</el-button>
        </div>
      </div>

      <div class="table-scroll-wrapper">
      <el-table v-loading="loading" :data="tableData" stripe :size="denseMode ? 'small' : 'default'"
        style="width: 100%" max-height="calc(100vh - 340px)" @sort-change="handleSortChange"
        @selection-change="handleSelectionChange" ref="tableRef" class="modern-table">
        <el-table-column type="selection" width="45" fixed="left" />
        <el-table-column type="index" label="序号" width="60" align="center" fixed="left" :index="indexMethod" />
        <el-table-column prop="category" label="器具类别" width="130" fixed="left" show-overflow-tooltip>
          <template #default="{ row }"><span class="category-tag" :style="categoryStyle(row.category)">{{ row.category || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="installation_location" label="安装位置" width="150" fixed="left" show-overflow-tooltip />
        <el-table-column prop="serial_number" label="出厂编号" width="150" show-overflow-tooltip>
          <template #default="{ row }"><span class="serial-number">{{ row.serial_number || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="certificate_number" label="证书编号" width="180" show-overflow-tooltip>
          <template #default="{ row }"><span class="cert-number">{{ row.certificate_number || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="变更信息" width="230" align="center">
          <template #default="{ row }">
            <div v-if="row.latest_change_at" class="change-info-cell">
              <el-tag type="success" size="small" class="updated-tag" @click.stop="openHistory(row)">已更新</el-tag>
              <button class="change-meta" type="button" @click.stop="openHistory(row)">{{ formatDateTime(row.latest_change_at) }}<template v-if="row.latest_change_summary"> · {{ row.latest_change_summary }}</template></button>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="inspection_date" width="120" align="center">
          <template #header>
            <div class="date-col-header">
              <span>检验日期</span>
              <el-popover v-model:visible="inspectionDateFilterVisible" placement="bottom" :width="260" trigger="manual" :hide-after="0" @show="inspectionDateFilterTemp = filters.inspectionDate || ''">
                <template #reference><el-icon class="date-filter-icon" :class="{ 'filter-active': !!filters.inspectionDate }" :size="14" @click.stop="inspectionDateFilterVisible = !inspectionDateFilterVisible"><Filter /></el-icon></template>
                <div class="date-filter-popover" @click.stop>
                  <el-date-picker v-model="inspectionDateFilterTemp" type="date" placeholder="选择检验日期" value-format="YYYY-MM-DD" size="small" style="width:100%" :teleported="false" />
                  <div class="date-filter-actions">
                    <el-button size="small" @click="inspectionDateFilterTemp = ''; inspectionDateFilterVisible = false; filters.inspectionDate = ''; fetchList()">清除</el-button>
                    <el-button size="small" type="primary" @click="applyInspectionDateFilter">确定</el-button>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
          <template #default="{ row }">{{ formatDate(row.inspection_date) }}</template>
        </el-table-column>
        <el-table-column prop="valid_until" width="130" sortable="custom" align="center">
          <template #header>
            <div class="date-col-header">
              <span>有效日期</span>
              <el-popover v-model:visible="validDateFilterVisible" placement="bottom" :width="260" trigger="manual" :hide-after="0" @show="validDateFilterTemp = filters.validDate || ''">
                <template #reference><el-icon class="date-filter-icon" :class="{ 'filter-active': !!filters.validDate }" :size="14" @click.stop="validDateFilterVisible = !validDateFilterVisible"><Filter /></el-icon></template>
                <div class="date-filter-popover" @click.stop>
                  <el-date-picker v-model="validDateFilterTemp" type="date" placeholder="选择有效日期" value-format="YYYY-MM-DD" size="small" style="width:100%" :teleported="false" />
                  <div class="date-filter-actions">
                    <el-button size="small" @click="validDateFilterTemp = ''; validDateFilterVisible = false; filters.validDate = ''; fetchList()">清除</el-button>
                    <el-button size="small" type="primary" @click="applyValidDateFilter">确定</el-button>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
          <template #default="{ row }"><el-tag :type="getValidTagType(row.valid_until)" size="small" effect="dark" class="valid-tag">{{ formatDate(row.valid_until) || '-' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="分类管理" width="85" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="getClassification(row)" :class="'classification-badge classification-' + getClassificationLevel(row)">{{ getClassification(row) }}</span>
            <span v-else class="classification-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="型号规格" width="120" show-overflow-tooltip />
        <el-table-column prop="manufacturer" label="生产厂家" width="150" show-overflow-tooltip />
        <el-table-column label="量程" width="150" show-overflow-tooltip><template #default="{ row }">{{ formatRange(row) }}</template></el-table-column>
        <el-table-column prop="accuracy_class" label="准确度" width="85" align="center" show-overflow-tooltip />
        <el-table-column prop="inspection_unit" label="检定单位" width="160" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="75" align="center">
          <template #default="{ row }"><span class="status-dot-badge" :class="'status-' + row.status">{{ STATUS_MAP[row.status] || row.status }}</span></template>
        </el-table-column>
        <el-table-column prop="photo_url" label="照片" width="70" align="center">
          <template #default="{ row }">
            <el-image v-if="row.photo_url" :src="photoUrlWithToken(row.photo_url)" :preview-src-list="[photoUrlWithToken(row.photo_url)]" fit="cover" style="width: 40px; height: 40px; border-radius: 8px;" lazy>
              <template #error><el-icon :size="22"><PictureFilled /></el-icon></template>
            </el-image>
            <div v-else class="no-photo"><el-icon :size="20"><PictureFilled /></el-icon></div>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="85" align="center">
          <template #default="{ row }">
            <template v-if="row.certificate_file">
              <el-button link type="primary" size="small" @click="viewCertificate(row)"><el-icon :size="16"><Document /></el-icon></el-button>
            </template>
            <input type="file" accept=".pdf" :ref="el => certInputRefs[row.id] = el" style="display:none" @change="(e) => handleSingleCertUpload(row, e)" />
            <el-button link size="small" :type="row.certificate_file ? 'default' : 'primary'" @click="certInputRefs[row.id]?.click()"><el-icon :size="14"><FolderAdd /></el-icon></el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="$router.push('/instruments/' + row.id)"><el-icon><Edit /></el-icon> 编辑</el-button>
            <el-divider direction="vertical" />
            <el-popconfirm title="确定删除该记录？" confirm-button-text="删除" cancel-button-text="取消" @confirm="handleDelete(row.id)">
              <template #reference><el-button type="danger" link size="small"><el-icon><Delete /></el-icon> 删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <div class="table-footer">
        <div class="table-info">第 {{ pagination.page }} 页 / 共 {{ Math.ceil(pagination.total / pagination.pageSize) }} 页，显示第 {{ (pagination.page - 1) * pagination.pageSize + 1 }} - {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 条</div>
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 30, 50, 100, 200, 400]" :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper" background @size-change="fetchList" @current-change="fetchList" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus, Upload, Download, Refresh, Edit, Delete, PictureFilled, DArrowRight, Camera, FolderOpened, ArrowDown, UploadFilled, FolderDelete, Warning, Filter, Select, Document, Setting, FolderAdd, List } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getInstruments, deleteInstrument, uploadCertificateForInstrument, getCategories } from '../api/instruments'
import { STATUS_OPTIONS, STATUS_MAP } from '../utils/constants'
import { useAuthStore } from '../stores/auth'
import InstrumentHistoryDrawer from '../components/InstrumentHistoryDrawer.vue'
import InstrumentRecycleBin from '../components/InstrumentRecycleBin.vue'

// ---- 对话框组件 ----
import PhotoSearchDialog from '../components/instrument/PhotoSearchDialog.vue'
import BatchCertUploadDialog from '../components/instrument/BatchCertUploadDialog.vue'
import FuzzyMatchDialog from '../components/instrument/FuzzyMatchDialog.vue'
import ConfirmMatchDialog from '../components/instrument/ConfirmMatchDialog.vue'
import ManualMatchDialog from '../components/instrument/ManualMatchDialog.vue'
import CreateFromCertDialog from '../components/instrument/CreateFromCertDialog.vue'
import MultiMatchDialog from '../components/instrument/MultiMatchDialog.vue'
import CertCheckDialog from '../components/instrument/CertCheckDialog.vue'
import RulesConfigDialog from '../components/instrument/RulesConfigDialog.vue'
import RuleFormDialog from '../components/instrument/RuleFormDialog.vue'
import ClearCategoryDialog from '../components/instrument/ClearCategoryDialog.vue'
import UploadLedgerDialog from '../components/instrument/UploadLedgerDialog.vue'
import LedgerViewDialog from '../components/instrument/LedgerViewDialog.vue'
import ExportColumnsDialog from '../components/instrument/ExportColumnsDialog.vue'

// ---- Composables ----
import { useInstrumentList } from '../composables/useInstrumentList'
import { useCertificateUpload } from '../composables/useCertificateUpload'
import { useCertificateMatch } from '../composables/useCertificateMatch'
import { useCertCheck } from '../composables/useCertCheck'
import { useExport } from '../composables/useExport'
import { usePhotoSearch } from '../composables/usePhotoSearch'
import { useValidityRules } from '../composables/useValidityRules'
import { useLedgerView } from '../composables/useLedgerView'
import { useDataClear } from '../composables/useDataClear'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function photoUrlWithToken(url) {
  if (!url || !authStore.token || url.startsWith('blob:')) return url
  return url + (url.includes('?') ? '&' : '?') + 'token=' + authStore.token
}

// ---- 核心数据 ----
const {
  loading, tableData, categories, denseMode, selectedRows, selectAllMode, tableRef,
  filters, pagination,
  inspectionDateFilterVisible, validDateFilterVisible, inspectionDateFilterTemp, validDateFilterTemp,
  activeFilterCount,
  formatNumber, formatRange, formatDate, formatDateTime,
  getValidTagType, parseExtraFields, getClassification, getClassificationLevel, categoryStyle, indexMethod,
  onSearchDebounce, resetFilters, applyInspectionDateFilter, applyValidDateFilter,
  fetchList, handleSortChange,
  handleSelectionChange, handleSelectAllCommand,
  initCategories, initFromUrl
} = useInstrumentList()

// ---- 批量上传证书 ----
const { batchCertVisible, batchFiles, batchUploading, batchProgress, batchResults, batchSummary, certInputRefs,
  resetBatchUpload, handleBatchUpload: doBatchUpload, clearBatchResults } = useCertificateUpload()
function handleBatchUpload() { doBatchUpload(fetchList) }

// ---- 证书匹配 ----
const {
  fuzzyMatchVisible, confirmMatchVisible, manualMatchVisible, createFromCertVisible,
  multiMatchVisible, multiMatchCert, multiMatchSelected, multiMatching,
  activeUnmatched, confirmMatchTarget, confirmUpdateSerial,
  fuzzySearchKeyword, fuzzyCandidates, fuzzySearching, fuzzySearched, forceMatching,
  manualSearchKeyword, manualCandidates, manualTarget, manualSearching,
  newFromCertForm, creatingFromCert,
  handleUnmatchedAction,
  searchFuzzyMatch, onFuzzySearchDebounce, confirmFuzzyMatch,
  loadManualCandidates, selectManualTarget, confirmManualMatch,
  openMultiMatchDialog, toggleMultiSelect, getMmDateColor,
  executeForceMatch, executeCreateFromCert, executeMultiMatch
} = useCertificateMatch()

function doExecuteForceMatch() { executeForceMatch(batchResults, batchSummary, fetchList) }
function doExecuteCreateFromCert() { executeCreateFromCert(batchResults, batchSummary, fetchList) }
function doExecuteMultiMatch() { executeMultiMatch(batchResults, batchSummary, fetchList) }

// ---- 证书校验 ----
const { certCheckVisible, certCheckLoading, certCheckData, certCheckOnlyMismatch, certCheckSelected,
  loadCertCheck, handleBatchUpdateDates } = useCertCheck()
async function doHandleBatchUpdateDates() {
  const ok = await handleBatchUpdateDates()
  if (ok) fetchList()
}

// ---- 导出 ----
const { EXPORT_FIELD_OPTIONS, exportColumnsVisible, exportSelectedColumns, pendingExportCommand,
  toggleExportColumn, openExportColumnPicker, confirmExportWithColumns: doConfirmExport,
  handleExportCommand: doHandleExportCommand } = useExport()
function handleExportCommand(command) {
  doHandleExportCommand(command, null, filters, pagination, selectedRows.value, selectAllMode.value, tableData.value, router)
}
function confirmExportWithColumns() { doConfirmExport(handleExportCommand) }

// ---- 拍照查找 ----
const { photoSearchVisible, photoSearchLoading, photoSearchPreview, photoSearchResult,
  cameraSearchRef, fileSearchRef, handlePhotoSearchFile } = usePhotoSearch()

// ---- 有效期规则 ----
const { rulesConfigVisible, rulesLoading, rulesList, ruleFormVisible, editingRule, ruleForm,
  loadRules, openRuleForm, saveRule, handleDeleteRule, handleResetRules } = useValidityRules()

// ---- 台账查看 ----
const { uploadLedgerDialog, ledgerFile, uploadingLedger, ledgerUploadRef,
  ledgerViewVisible, ledgerViewLoading, ledgerSheets, ledgerActiveSheet,
  ledgerEditing, ledgerAdding, ledgerEditRow, ledgerNewRow,
  ledgerHistory, ledgerCurrentFile,
  currentLedgerSheet, ledgerTitle, ledgerReadOnly,
  handleLedgerFileChange, handleLedgerFileRemove, handleUploadLedger,
  loadLedgerView, fmtLedgerHistoryLabel, switchLedgerVersion, confirmDeleteLedgerVersion,
  editLedgerRow, cancelLedgerEdit, saveLedgerRow, deleteLedgerRowConfirm,
  startAddLedgerRow, saveNewLedgerRow, downloadLedger,
  ledgerEditCell, ledgerEditValue, startCellEdit, saveCellEdit } = useLedgerView(authStore)

// ---- 数据清空 ----
const { clearCategoryVisible, clearCategory, clearCategoryLoading, categoryCounts,
  loadCategoryCounts, categoryDataCount, handleClearByCategory, handleClearAll } = useDataClear()

function handleClearCommand(cmd) {
  if (cmd === 'clear-category') {
    clearCategoryVisible.value = true
    loadCategoryCounts()
  } else if (cmd === 'clear-all') {
    ElMessageBox.confirm('确定要清空所有计量器具数据吗？此操作不可撤销！', '清空全部数据', { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'error' })
      .then(() => handleClearAll().then(r => r && fetchList())).catch(() => {})
  }
}

// ---- 单证书上传 & 删除 ----
const { certInputRefs: certRefs } = useCertificateUpload()
async function handleSingleCertUpload(row, event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    await uploadCertificateForInstrument(row.id, file)
    ElMessage.success('证书上传成功')
    fetchList()
  } catch (err) {
    ElMessage.error('上传失败：' + (err.response?.data?.message || err.message))
  }
  event.target.value = ''
}

async function handleDelete(id) {
  try { await deleteInstrument(id); ElMessage.success('删除成功'); fetchList() } catch (err) { /* handled */ }
}

function viewCertificate(row) {
  window.open(photoUrlWithToken(row.certificate_file), '_blank')
}

// ---- 历史 & 回收站 ----
const historyVisible = ref(false)
const historyInstrument = ref(null)
const recycleBinVisible = ref(false)
function openHistory(row) { historyInstrument.value = row; historyVisible.value = true }

onMounted(async () => {
  await initCategories()
  initFromUrl()
  fetchList()
})
</script>

<style scoped>
.instrument-list-page { max-width: 1600px; margin: 0 auto; }
.filter-card { background: var(--card-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-color); margin-bottom: 16px; overflow: hidden; }
.filter-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
.filter-header h4 { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.filter-header-actions { display: flex; gap: 8px; }
.filter-body { padding: 16px 20px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.filter-search-input { flex: 1 1 260px; min-width: 200px; }
.filter-spacer { flex: 1 1 20px; min-width: 0; }
.active-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color); }
.filter-tags-label { font-size: 13px; color: var(--text-secondary); margin-right: 4px; }
.table-card { background: var(--card-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-color); overflow: hidden; }
.table-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
.table-title { display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 700; color: var(--text-primary); }
.table-actions { display: flex; align-items: center; gap: 12px; }
.scroll-hint { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); cursor: default; user-select: none; }
.select-all-badge { font-size: 13px; font-weight: 600; color: #059669; white-space: nowrap; padding: 2px 10px; background: #ecfdf5; border-radius: 12px; border: 1px solid #a7f3d0; }
.modern-table :deep(.el-table__header), .modern-table :deep(.el-table__body) { table-layout: fixed; }
.modern-table :deep(.el-table__header th) { background: #f1f5f9 !important; font-weight: 700; font-size: 14px; color: var(--text-primary); border-bottom: 2px solid var(--border-color); }
.modern-table :deep(.el-table__body td) { font-size: 13px; }
.serial-number { font-weight: 500; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 13px; color: var(--primary); }
.cert-number { font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 12px; color: var(--text-secondary); }
.change-info-cell { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.updated-tag { flex-shrink: 0; cursor: pointer; }
.change-meta { display: block; max-width: 100%; margin-top: 3px; padding: 0; border: 0; background: transparent; color: #16a34a; font: inherit; font-size: 11px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.change-meta:hover { text-decoration: underline; }
.no-photo { width: 40px; height: 40px; border-radius: 8px; background: #f1f5f9; display: inline-flex; align-items: center; justify-content: center; color: #cbd5e1; }
.valid-tag { font-weight: 600; }
.status-dot-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
.status-active { background: #f0fdf4; color: #16a34a; }
.status-scrapped { background: #f1f5f9; color: #64748b; }
.status-borrowed { background: #fffbeb; color: #d97706; }
.status-maintenance { background: #fef2f2; color: #dc2626; }
.category-tag { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; border: 1px solid; white-space: nowrap; }
.classification-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
.classification-a { background: #fee2e2; color: #dc2626; }
.classification-b { background: #fef3c7; color: #b45309; }
.classification-c { background: #dbeafe; color: #1d4ed8; }
.classification-empty { color: #cbd5e1; font-size: 12px; }
.table-footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px; }
.table-info { font-size: 13px; color: var(--text-muted); white-space: nowrap; }
.table-footer :deep(.el-pagination) { flex-shrink: 0; }
.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal) { height: 10px !important; opacity: 1 !important; }
.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb) { height: 8px !important; background: #cbd5e1 !important; border-radius: 4px !important; min-width: 60px !important; opacity: 0.85 !important; }
.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb:hover) { background: #94a3b8 !important; height: 10px !important; }
.table-scroll-wrapper::-webkit-scrollbar { height: 10px; width: 8px; }
.table-scroll-wrapper::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 5px; }
.table-scroll-wrapper::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; min-width: 60px; }
.table-scroll-wrapper::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.date-col-header { display: flex; align-items: center; gap: 4px; justify-content: center; }
.date-filter-icon { cursor: pointer; color: #c0c4cc; transition: color .2s; }
.date-filter-icon:hover { color: #409EFF; }
.date-filter-icon.filter-active { color: #409EFF; }
.date-filter-popover { display: flex; flex-direction: column; gap: 8px; }
.date-filter-actions { display: flex; gap: 8px; justify-content: flex-end; }
.photo-search-body { text-align: center; }
.photo-search-hint { color: #909399; margin-bottom: 16px; }
.photo-search-preview { margin-bottom: 16px; }
.photo-search-actions { display: flex; gap: 12px; margin-bottom: 16px; }
.photo-search-result { margin-top: 16px; }
.photo-search-match { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-top: 12px; text-align: left; }
.match-row { padding: 4px 0; font-size: 14px; }
.batch-cert-body :deep(.el-upload-dragger) { padding: 24px; }
.upload-drag-area { text-align: center; }
.upload-drag-area p { margin: 8px 0 0; color: #606266; }
.upload-hint { color: #909399 !important; font-size: 12px; }
.batch-results { margin-top: 16px; }
.results-summary { display: flex; gap: 8px; }
.export-columns-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
.multi-match-list { max-height: 400px; overflow-y: auto; }
.multi-match-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid #e4e7ed; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all .2s; }
.multi-match-item:hover { border-color: #409EFF; }
.multi-match-item.selected { border-color: #409EFF; background: #ecf5ff; }
.multi-match-item.mismatch { border-color: #f56c6c; background: #fef0f0; }
.mm-info { flex: 1; min-width: 0; }
.mm-line1, .mm-line2, .mm-line3 { display: flex; gap: 8px; font-size: 12px; margin-bottom: 3px; flex-wrap: wrap; align-items: center; }
.mm-category { font-weight: 600; }
.mm-serial { font-size: 13px; color: #409EFF; }
.ledger-table-wrap { overflow: auto; max-height: calc(95vh - 200px); border: 1px solid #e4e7ed; border-radius: 8px; }
.ledger-table { border-collapse: collapse; min-width: max-content; }
.ledger-table td { padding: 4px 8px; border: 1px solid #e4e7ed; font-size: 12px; white-space: nowrap; }
.ledger-table .header-row td { background: #f1f5f9; font-weight: 600; font-size: 13px; }
.ledger-table .data-row td { background: #fff; }
.ledger-table .zebra-even td { background: #fafafa; }
.ledger-table .col-frozen { position: sticky; left: 0; z-index: 1; background: inherit; }
.ledger-table .header-row .col-frozen { background: #f1f5f9; }
.ledger-table .ledger-actions { text-align: center; background: #f9fafb; }
.ledger-edit-input { width: 100%; min-width: 80px; border: 1px solid #409EFF; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.ledger-cell-input { width: 100%; min-width: 60px; border: 2px solid #409EFF; padding: 2px 6px; border-radius: 3px; font-size: 12px; outline: none; box-sizing: border-box; }
.cell-editing { padding: 0 !important; }
</style>
