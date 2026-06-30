<template>
  <div class="instrument-list-page">
    <!-- 搜索筛选卡片 -->
    <div class="filter-card">
      <div class="filter-header">
        <h4>🔍 筛选条件</h4>
        <div class="filter-header-actions">
          <el-button type="success" @click="photoSearchVisible = true">
            <el-icon><Camera /></el-icon> 拍照查找
          </el-button>
          <el-button type="primary" @click="$router.push('/instruments/add')">
            <el-icon><Plus /></el-icon> 新增器具
          </el-button>
        </div>
      </div>
      <div class="filter-body">
        <div class="filter-row">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索：出厂编号 / 型号 / 厂家 / 位置 / 证书编号"
            clearable
            size="default"
            class="filter-search-input"
            @input="onSearchDebounce"
            @clear="fetchList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select v-model="filters.category" placeholder="全部类别" clearable size="default" @change="fetchList" style="width:140px;flex-shrink:0">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>

          <el-select v-model="filters.status" placeholder="全部状态" clearable size="default" @change="fetchList" style="width:120px;flex-shrink:0">
            <el-option v-for="opt in STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>

          <el-select v-model="filters.classification" placeholder="全部分类" clearable size="default" @change="fetchList" style="width:110px;flex-shrink:0">
            <el-option label="A 类" value="A" />
            <el-option label="B 类" value="B" />
            <el-option label="C 类" value="C" />
          </el-select>

          <el-button type="primary" @click="fetchList" style="flex-shrink:0">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilters" style="flex-shrink:0">
            <el-icon><Refresh /></el-icon> 重置
          </el-button>

          <div class="filter-spacer"></div>

          <el-button @click="$router.push('/instruments/import')" style="flex-shrink:0">
            <el-icon><Upload /></el-icon> 导入Excel
          </el-button>
          <el-dropdown trigger="click" @command="handleExportCommand" style="flex-shrink:0">
            <el-button type="default">
              <el-icon><Download /></el-icon> 导出 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="export-all">📋 导出全部（台帐格式）</el-dropdown-item>
                <el-dropdown-item command="summary-selected" :disabled="selectedRows.length === 0">
                  📊 导出管理一览表（选中 {{ selectedRows.length }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="summary-all">📊 导出管理一览表（全部）</el-dropdown-item>
                <el-dropdown-item divided command="apply-selected" :disabled="selectedRows.length === 0">
                  📝 导出检定申请表（选中 {{ selectedRows.length }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="apply-all">📝 导出检定申请表（全部）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="success" plain @click="batchCertVisible = true" style="flex-shrink:0">
            <el-icon><UploadFilled /></el-icon> 批量上传证书
          </el-button>
          <el-dropdown trigger="click" @command="handleClearCommand" style="flex-shrink:0">
            <el-button type="danger" plain>
              <el-icon><Delete /></el-icon> 清空数据 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="clear-category">
                  <el-icon><FolderDelete /></el-icon> 按类别清空...
                </el-dropdown-item>
                <el-dropdown-item command="clear-all" divided>
                  <el-icon><Warning /></el-icon> 清空全部数据
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 激活的筛选标签 -->
        <div v-if="activeFilterCount > 0" class="active-filters">
          <span class="filter-tags-label">当前筛选：</span>
          <el-tag
            v-if="filters.keyword"
            closable size="small" type="primary"
            @close="filters.keyword = ''; fetchList()"
          >
            关键词：{{ filters.keyword }}
          </el-tag>
          <el-tag
            v-if="filters.category"
            closable size="small" type="success"
            @close="filters.category = ''; fetchList()"
          >
            类别：{{ filters.category }}
          </el-tag>
          <el-tag
            v-if="filters.status"
            closable size="small" :type="filters.status === 'active' ? 'success' : filters.status === 'scrapped' ? 'info' : 'warning'"
            @close="filters.status = ''; fetchList()"
          >
            状态：{{ STATUS_MAP[filters.status] || filters.status }}
          </el-tag>
          <el-tag
            v-if="filters.classification"
            closable size="small" type="info"
            @close="filters.classification = ''; fetchList()"
          >
            分类管理：{{ filters.classification }} 类
          </el-tag>
          <el-tag
            v-if="filters.validDate"
            closable size="small" type="danger"
            @close="filters.validDate = ''; fetchList()"
          >
            有效日期：{{ filters.validDate }}
          </el-tag>
          <el-tag
            v-if="filters.inspectionDate"
            closable size="small" type="warning"
            @close="filters.inspectionDate = ''; fetchList()"
          >
            检验日期：{{ filters.inspectionDate }}
          </el-tag>
          <el-button text size="small" type="primary" @click="resetFilters">
            清除全部筛选
          </el-button>
        </div>
      </div>
    </div>

    <!-- 拍照查找对话框 -->
    <el-dialog v-model="photoSearchVisible" title="📷 拍照查找计量器具" width="500px" :close-on-click-modal="false">
      <div class="photo-search-body">
        <p class="photo-search-hint">拍照或上传铭牌照片，系统自动识别出厂编号并查找对应器具</p>

        <div v-if="photoSearchPreview" class="photo-search-preview">
          <el-image :src="photoUrlWithToken(photoSearchPreview)" fit="contain" style="width:100%;max-height:280px;border-radius:12px" />
        </div>

        <div class="photo-search-actions">
          <input ref="cameraSearchRef" type="file" accept="image/*" capture="environment" style="display:none" @change="handlePhotoSearchFile" />
          <el-button type="primary" size="large" @click="cameraSearchRef?.click()" :loading="photoSearchLoading" style="flex:1">
            <el-icon><Camera /></el-icon> 拍照
          </el-button>

          <input ref="fileSearchRef" type="file" accept="image/*" style="display:none" @change="handlePhotoSearchFile" />
          <el-button size="large" @click="fileSearchRef?.click()" :loading="photoSearchLoading" style="flex:1">
            <el-icon><FolderOpened /></el-icon> 上传图片
          </el-button>
        </div>

        <div v-if="photoSearchResult" class="photo-search-result">
          <el-alert
            :title="photoSearchResult.found ? '已找到匹配器具！' : '未找到匹配器具'"
            :type="photoSearchResult.found ? 'success' : 'warning'"
            :closable="false"
            show-icon
          />
          <div v-if="photoSearchResult.found && photoSearchResult.instrument" class="photo-search-match">
            <div class="match-row"><strong>出厂编号：</strong>{{ photoSearchResult.instrument.serial_number }}</div>
            <div class="match-row"><strong>器具类别：</strong>{{ photoSearchResult.instrument.category }}</div>
            <div class="match-row"><strong>型号：</strong>{{ photoSearchResult.instrument.model || '-' }}</div>
            <div class="match-row"><strong>安装位置：</strong>{{ photoSearchResult.instrument.installation_location || '-' }}</div>
            <el-button type="primary" style="margin-top:12px;width:100%" @click="goToPhotoSearchResult">
              查看详情
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 批量上传证书对话框 -->
    <el-dialog v-model="batchCertVisible" title="📄 批量上传证书" width="700px" :close-on-click-modal="false" @close="resetBatchUpload">
      <div class="batch-cert-body">
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
          <template #title>
            支持批量上传PDF证书文件，系统将自动从文件名提取出厂编号并匹配对应器具<br/>
            <small>文件名格式：<code>YB-H1-ZX1-2026040306-2313072607.pdf</code>（最后一段为出厂编号）</small>
          </template>
        </el-alert>

        <!-- 上传区域 -->
        <el-upload
          ref="batchUploadRef"
          v-model:file-list="batchFiles"
          :auto-upload="false"
          :accept="'.pdf'"
          multiple
          drag
          :limit="50"
        >
          <template #default>
            <div class="upload-drag-area">
              <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
              <p>将PDF证书拖拽到此处，或<em>点击选择文件</em></p>
              <p class="upload-hint">支持同时选择多个PDF文件，最多50个</p>
            </div>
          </template>
        </el-upload>

        <!-- 上传中进度 -->
        <div v-if="batchUploading" style="margin-top:16px; text-align:center">
          <el-progress :percentage="batchProgress" :status="batchProgress === 100 ? 'success' : ''" />
          <p style="color:#909399;margin-top:8px">正在处理中...</p>
        </div>

        <!-- 结果展示 -->
        <div v-if="batchResults && batchResults.length > 0" class="batch-results" style="margin-top:16px">
          <el-divider />
          <div class="results-summary" style="margin-bottom:12px">
            <el-tag type="success">匹配成功: {{ batchSummary.matched }}</el-tag>
            <el-tag type="warning" style="margin-left:8px">未匹配: {{ batchSummary.unmatched }}</el-tag>
            <el-tag type="danger" style="margin-left:8px">出错: {{ batchSummary.error }}</el-tag>
          </div>
          <el-table :data="batchResults" max-height="300" size="small" stripe>
            <el-table-column prop="fileName" label="文件名" min-width="280" show-overflow-tooltip />
            <el-table-column prop="serialNumber" label="出厂编号" width="140" show-overflow-tooltip />
            <el-table-column prop="category" label="类别前缀" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="匹配结果" width="160">
              <template #default="{ row }">
                <template v-if="row.status === 'matched'">
                  <el-tag size="small" type="success">✅ {{ row.matchedInstrument?.serial_number }}</el-tag>
                </template>
                <template v-else-if="row.status === 'unmatched'">
                  <el-tag size="small" type="warning">⚠ 未找到对应器具</el-tag>
                </template>
                <template v-else>
                  <el-tag size="small" type="danger">❌ {{ row.error || '解析失败' }}</el-tag>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="batchCertVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :disabled="batchFiles.length === 0"
          :loading="batchUploading"
          @click="handleBatchUpload"
        >
          <el-icon><UploadFilled /></el-icon>
          上传并匹配（{{ batchFiles.length }} 个文件）
        </el-button>
      </template>
    </el-dialog>

    <!-- 数据表格 -->
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">
          <span>📋 计量器具台账</span>
          <el-tag type="info" size="small" effect="plain" round>共 {{ pagination.total }} 条</el-tag>
        </div>
        <div class="table-actions">
          <el-tooltip content="左右滑动查看更多列" placement="top">
            <span class="scroll-hint">
              <el-icon><DArrowRight /></el-icon> 横向滚动查看更多
            </span>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleSelectAllCommand" style="flex-shrink:0">
            <el-button size="small" plain>
              <el-icon><Select /></el-icon> 全选 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="select-page">
                  📄 全选当前页（{{ tableData.length }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="select-all">
                  📋 全选所有筛选结果（{{ pagination.total }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="clear-selection" divided>
                  ✖ 清除选中
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span v-if="selectAllMode" class="select-all-badge">
            🟢 已全选 {{ pagination.total }} 条
          </span>
          <el-button
            :type="denseMode ? 'primary' : 'default'"
            size="small"
            plain
            @click="denseMode = !denseMode"
          >
            {{ denseMode ? '紧凑' : '默认' }}模式
          </el-button>
        </div>
      </div>

      <div class="table-scroll-wrapper">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        :size="denseMode ? 'small' : 'default'"
        style="width: 100%"
        max-height="calc(100vh - 340px)"
        @sort-change="handleSortChange"
        @selection-change="handleSelectionChange"
        ref="tableRef"
        class="modern-table"
      >
        <el-table-column type="selection" width="45" fixed="left" />
        <el-table-column type="index" label="序号" width="60" align="center" fixed="left" :index="indexMethod" />

        <el-table-column prop="category" label="器具类别" width="130" fixed="left" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="category-tag" :style="categoryStyle(row.category)">
              {{ row.category || '-' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="installation_location" label="安装位置" width="150" fixed="left" show-overflow-tooltip />

        <el-table-column prop="serial_number" label="出厂编号" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="serial-number">{{ row.serial_number || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="certificate_number" label="证书编号" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cert-number">{{ row.certificate_number || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="inspection_date" width="120" align="center">
          <template #header>
            <div class="date-col-header">
              <span>检验日期</span>
              <el-popover
                v-model:visible="inspectionDateFilterVisible"
                placement="bottom"
                :width="260"
                trigger="manual"
                :hide-after="0"
                @show="inspectionDateFilterTemp = filters.inspectionDate || ''"
              >
                <template #reference>
                  <el-icon
                    class="date-filter-icon"
                    :class="{ 'filter-active': !!filters.inspectionDate }"
                    :size="14"
                    @click.stop="inspectionDateFilterVisible = !inspectionDateFilterVisible"
                  ><Filter /></el-icon>
                </template>
                <div class="date-filter-popover" @click.stop>
                  <el-date-picker
                    v-model="inspectionDateFilterTemp"
                    type="date"
                    placeholder="选择检验日期"
                    value-format="YYYY-MM-DD"
                    size="small"
                    style="width:100%"
                    :teleported="false"
                  />
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
              <el-popover
                v-model:visible="validDateFilterVisible"
                placement="bottom"
                :width="260"
                trigger="manual"
                :hide-after="0"
                @show="validDateFilterTemp = filters.validDate || ''"
              >
                <template #reference>
                  <el-icon
                    class="date-filter-icon"
                    :class="{ 'filter-active': !!filters.validDate }"
                    :size="14"
                    @click.stop="validDateFilterVisible = !validDateFilterVisible"
                  ><Filter /></el-icon>
                </template>
                <div class="date-filter-popover" @click.stop>
                  <el-date-picker
                    v-model="validDateFilterTemp"
                    type="date"
                    placeholder="选择有效日期"
                    value-format="YYYY-MM-DD"
                    size="small"
                    style="width:100%"
                    :teleported="false"
                  />
                  <div class="date-filter-actions">
                    <el-button size="small" @click="validDateFilterTemp = ''; validDateFilterVisible = false; filters.validDate = ''; fetchList()">清除</el-button>
                    <el-button size="small" type="primary" @click="applyValidDateFilter">确定</el-button>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
          <template #default="{ row }">
            <el-tag :type="getValidTagType(row.valid_until)" size="small" effect="dark" class="valid-tag">
              {{ formatDate(row.valid_until) || '-' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="分类管理" width="85" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="getClassification(row)" :class="'classification-badge classification-' + getClassificationLevel(row)">
              {{ getClassification(row) }}
            </span>
            <span v-else class="classification-empty">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="model" label="型号规格" width="120" show-overflow-tooltip />

        <el-table-column prop="manufacturer" label="生产厂家" width="150" show-overflow-tooltip />

        <el-table-column label="量程" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatRange(row) }}</template>
        </el-table-column>

        <el-table-column prop="accuracy_class" label="准确度" width="85" align="center" show-overflow-tooltip />

        <el-table-column prop="inspection_unit" label="检定单位" width="160" show-overflow-tooltip />

        <el-table-column prop="status" label="状态" width="75" align="center">
          <template #default="{ row }">
            <span class="status-dot-badge" :class="'status-' + row.status">
              {{ STATUS_MAP[row.status] || row.status }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="photo_url" label="照片" width="70" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.photo_url"
              :src="photoUrlWithToken(row.photo_url)"
              :preview-src-list="[photoUrlWithToken(row.photo_url)]"
              fit="cover"
              style="width: 40px; height: 40px; border-radius: 8px;"
              lazy
            >
              <template #error>
                <el-icon :size="22"><PictureFilled /></el-icon>
              </template>
            </el-image>
            <div v-else class="no-photo">
              <el-icon :size="20"><PictureFilled /></el-icon>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="170" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="$router.push('/instruments/' + row.id)">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-divider direction="vertical" />
            <el-popconfirm
              title="确定删除该记录？"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button type="danger" link size="small">
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      </div><!-- end table-scroll-wrapper -->

      <div class="table-footer">
        <div class="table-info">
          第 {{ pagination.page }} 页 / 共 {{ Math.ceil(pagination.total / pagination.pageSize) }} 页，显示第 {{ (pagination.page - 1) * pagination.pageSize + 1 }} - {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 条
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 30, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <!-- 按类别清空对话框 -->
    <el-dialog v-model="clearCategoryVisible" title="按类别清空数据" width="420px" :close-on-click-modal="false">
      <el-alert
        title="此操作将删除指定类别下的所有计量器具记录，不可撤销！"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom:16px"
      />
      <el-form label-width="80px">
        <el-form-item label="选择类别">
          <el-select v-model="clearCategory" placeholder="请选择要清空的类别" filterable style="width:100%">
            <el-option
              v-for="cat in categories"
              :key="cat"
              :label="cat + ' (' + categoryDataCount(cat) + '条)'"
              :value="cat"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clearCategoryVisible = false">取消</el-button>
        <el-button type="danger" :disabled="!clearCategory" :loading="clearCategoryLoading" @click="handleClearByCategory">
          确认清空
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Search, Plus, Upload, Download, Refresh, Edit, Delete, PictureFilled, DArrowRight, Camera, FolderOpened, ArrowDown, UploadFilled, FolderDelete, Warning, Filter, Select
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getInstruments, deleteInstrument, exportInstruments, exportManagementSummary, exportWarningApply, batchUploadCertificates, getCategories, clearAllInstruments, clearByCategory, uploadPhoto, ocrFromUrl, getInstrumentStats } from '../api/instruments'
import { STATUS_OPTIONS, STATUS_MAP, CATEGORIES, getCategoryColor } from '../utils/constants'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const authStore = useAuthStore()
function photoUrlWithToken(url) {
  // blob URL 不需要鉴权 token（浏览器本地资源）
  if (!url || !authStore.token || url.startsWith('blob:')) return url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + 'token=' + authStore.token
}
const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const categories = ref(CATEGORIES)
const denseMode = ref(false)
const selectedRows = ref([])
const selectAllMode = ref(false)
const tableRef = ref(null)

// === 批量上传证书 ===
const batchCertVisible = ref(false)
const batchFiles = ref([])
const batchUploading = ref(false)
const batchProgress = ref(0)
const batchResults = ref(null)
const batchSummary = ref({ matched: 0, unmatched: 0, error: 0 })

// === 拍照查找 ===
const photoSearchVisible = ref(false)
const photoSearchLoading = ref(false)
const photoSearchPreview = ref('')
const photoSearchResult = ref(null)
const cameraSearchRef = ref(null)
const fileSearchRef = ref(null)

let searchTimer = null

// 日期列筛选弹窗
const inspectionDateFilterVisible = ref(false)
const validDateFilterVisible = ref(false)
const inspectionDateFilterTemp = ref('')
const validDateFilterTemp = ref('')

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

function getValidTagType(validUntil) {
  if (!validUntil) return 'info'
  const diff = Math.ceil((new Date(validUntil) - new Date()) / 86400000)
  if (diff < 0) return 'danger'
  if (diff <= 30) return 'warning'
  return 'success'
}

function onSearchDebounce() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchList, 300)
}

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

async function fetchList() {
  loading.value = true
  // 数据重新加载时清除全选模式（筛选条件变化或翻页时自动退出）
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
    if (filters.validDate) {
      params.validFrom = filters.validDate
      params.validTo = filters.validDate
    }
    if (filters.inspectionDate) {
      params.inspectionFrom = filters.inspectionDate
      params.inspectionTo = filters.inspectionDate
    }

    // 同步筛选状态到URL参数
    const query = {}
    if (filters.keyword) query.keyword = filters.keyword
    if (filters.category) query.category = filters.category
    if (filters.status) query.status = filters.status
    if (filters.classification) query.classification = filters.classification
    if (filters.validDate) {
      query.validDate = filters.validDate
    }
    if (filters.inspectionDate) {
      query.inspectionDate = filters.inspectionDate
    }
    router.replace({ path: '/instruments', query })

    const res = await getInstruments(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch (err) {
    // handled
  } finally {
    loading.value = false
  }
}

function handleSortChange({ prop, order }) {
  if (prop) {
    pagination.sortBy = prop === 'valid_until' ? 'valid_until' : prop
  }
  pagination.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  fetchList()
}

function indexMethod(idx) {
  return (pagination.page - 1) * pagination.pageSize + idx + 1
}

async function handleDelete(id) {
  try {
    await deleteInstrument(id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (err) {
    // handled
  }
}

async function handleClearAll() {
  try {
    const res = await clearAllInstruments()
    ElMessage.success(res.message || '已清空全部数据')
    fetchList()
  } catch (err) {
    // handled
  }
}

// ========== 按类别清空 ==========
const clearCategoryVisible = ref(false)
const clearCategory = ref('')
const clearCategoryLoading = ref(false)

// 类别数据计数（从stats API获取全部数据计数，而非当前页）
const categoryCounts = ref({})

async function loadCategoryCounts() {
  try {
    const res = await getInstrumentStats()
    if (res.data && res.data.byCategory) {
      const counts = {}
      for (const item of res.data.byCategory) {
        counts[item.category] = item.count
      }
      categoryCounts.value = counts
    }
  } catch (e) {
    categoryCounts.value = {}
  }
}

function categoryDataCount(cat) {
  return categoryCounts.value[cat] || 0
}

async function handleClearByCategory() {
  if (!clearCategory.value) {
    ElMessage.warning('请选择要清空的类别')
    return
  }
  clearCategoryLoading.value = true
  try {
    const res = await clearByCategory(clearCategory.value)
    ElMessage.success(res.message || `已清空类别"${clearCategory.value}"的数据`)
    clearCategoryVisible.value = false
    clearCategory.value = ''
    fetchList()
  } catch (err) {
    // handled by interceptor
  } finally {
    clearCategoryLoading.value = false
  }
}

function handleClearCommand(cmd) {
  if (cmd === 'clear-category') {
    clearCategoryVisible.value = true
    loadCategoryCounts()
  } else if (cmd === 'clear-all') {
    ElMessageBox.confirm(
      '确定要清空所有计量器具数据吗？此操作不可撤销！',
      '清空全部数据',
      { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'error' }
    ).then(() => {
      handleClearAll()
    }).catch(() => {})
  }
}

async function handleExport() {
  try {
    const params = {}
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.category) params.category = filters.category
    if (filters.status) params.status = filters.status
    if (filters.validDate) {
      params.validFrom = filters.validDate
      params.validTo = filters.validDate
    }
    if (filters.inspectionDate) {
      params.inspectionFrom = filters.inspectionDate
      params.inspectionTo = filters.inspectionDate
    }
    params.sortBy = pagination.sortBy
    params.sortOrder = pagination.sortOrder

    const res = await exportInstruments(params)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = '计量器具台账_' + new Date().toISOString().slice(0, 10) + '.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    // handled
  }
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
  return {
    backgroundColor: c.bg,
    color: c.text,
    borderColor: c.text + '30'
  }
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
  // 当用户手动取消勾选时，退出全选模式
  if (selectAllMode.value && rows.length < tableData.value.length) {
    selectAllMode.value = false
  }
}

function handleSelectAllCommand(command) {
  if (command === 'select-page') {
    selectAllMode.value = false
    tableRef.value?.toggleAllSelection()
    ElMessage.success(`已全选当前页 ${tableData.value.length} 条记录`)
  } else if (command === 'select-all') {
    selectAllMode.value = true
    // 先清空当前页勾选，进入全选模式
    tableRef.value?.clearSelection()
    ElMessage.success(`已全选所有筛选结果 ${pagination.total} 条记录`)
  } else if (command === 'clear-selection') {
    selectAllMode.value = false
    tableRef.value?.clearSelection()
    ElMessage.info('已清除选中')
  }
}

async function handleExportCommand(command) {
  try {
    const params = {}
    let filename = ''

    if (command === 'export-all') {
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) {
        params.validFrom = filters.validDate
        params.validTo = filters.validDate
      }
      if (filters.inspectionDate) {
        params.inspectionFrom = filters.inspectionDate
        params.inspectionTo = filters.inspectionDate
      }
      params.sortBy = pagination.sortBy
      params.sortOrder = pagination.sortOrder
      const res = await exportInstruments(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = '计量器具台账_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
      return
    }

    // 管理一览表导出
    if (command === 'summary-selected') {
      // 全选模式：使用筛选参数，导出全部匹配结果
      if (selectAllMode.value) {
        if (filters.keyword) params.keyword = filters.keyword
        if (filters.category) params.category = filters.category
        if (filters.status) params.status = filters.status
        if (filters.validDate) {
          params.validFrom = filters.validDate
          params.validTo = filters.validDate
        }
        if (filters.inspectionDate) {
          params.inspectionFrom = filters.inspectionDate
          params.inspectionTo = filters.inspectionDate
        }
        filename = '计量器具管理一览表（全选' + pagination.total + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
        ElMessage.info(`正在导出全部 ${pagination.total} 条记录...`)
        const res = await exportManagementSummary(params)
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        window.URL.revokeObjectURL(url)
        ElMessage.success('管理一览表导出成功')
        return
      }
      if (selectedRows.value.length === 0) {
        ElMessage.warning('请先选择要导出的计量器具')
        return
      }
      const ids = selectedRows.value.map(r => r.id).join(',')
      params.ids = ids
      filename = '计量器具管理一览表（选中' + selectedRows.value.length + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      ElMessage.info(`正在导出 ${selectedRows.value.length} 条记录...`)
      const res = await exportManagementSummary(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('管理一览表导出成功')
      return
    }

    if (command === 'summary-all') {
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) {
        params.validFrom = filters.validDate
        params.validTo = filters.validDate
      }
      if (filters.inspectionDate) {
        params.inspectionFrom = filters.inspectionDate
        params.inspectionTo = filters.inspectionDate
      }
      filename = '计量器具管理一览表_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      const res = await exportManagementSummary(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('管理一览表导出成功')
      return
    }

    // 检定申请表导出
    if (command === 'apply-selected') {
      // 全选模式：使用筛选参数，导出全部匹配结果
      if (selectAllMode.value) {
        if (filters.keyword) params.keyword = filters.keyword
        if (filters.category) params.category = filters.category
        if (filters.status) params.status = filters.status
        if (filters.validDate) {
          params.validFrom = filters.validDate
          params.validTo = filters.validDate
        }
        if (filters.inspectionDate) {
          params.inspectionFrom = filters.inspectionDate
          params.inspectionTo = filters.inspectionDate
        }
        filename = '计量器具检定申请表（全选' + pagination.total + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
        ElMessage.info(`正在导出全部 ${pagination.total} 条记录...`)
        const res = await exportWarningApply(params)
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        window.URL.revokeObjectURL(url)
        ElMessage.success('检定申请表导出成功')
        return
      }
      if (selectedRows.value.length === 0) {
        ElMessage.warning('请先选择要导出的计量器具')
        return
      }
      const ids = selectedRows.value.map(r => r.id).join(',')
      params.ids = ids
      filename = '计量器具检定申请表（选中' + selectedRows.value.length + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      ElMessage.info(`正在导出 ${selectedRows.value.length} 条记录...`)
      const res = await exportWarningApply(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('检定申请表导出成功')
      return
    }

    if (command === 'apply-all') {
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) {
        params.validFrom = filters.validDate
        params.validTo = filters.validDate
      }
      if (filters.inspectionDate) {
        params.inspectionFrom = filters.inspectionDate
        params.inspectionTo = filters.inspectionDate
      }
      filename = '计量器具检定申请表_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      const res = await exportWarningApply(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('检定申请表导出成功')
      return
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

// === 批量上传证书 ===
function resetBatchUpload() {
  batchFiles.value = []
  batchResults.value = null
  batchSummary.value = { matched: 0, unmatched: 0, error: 0 }
  batchProgress.value = 0
}

async function handleBatchUpload() {
  if (batchFiles.value.length === 0) {
    ElMessage.warning('请先选择PDF文件')
    return
  }

  batchUploading.value = true
  batchProgress.value = 30

  try {
    const rawFiles = batchFiles.value.map(f => f.raw || f)
    const res = await batchUploadCertificates(rawFiles)

    batchProgress.value = 100
    batchResults.value = res.data.results
    batchSummary.value = {
      matched: res.data.matched,
      unmatched: res.data.unmatched,
      error: res.data.error
    }

    if (res.data.matched > 0) {
      ElMessage.success(`成功匹配 ${res.data.matched} 条记录，证书编号已自动填入`)
      fetchList() // 刷新列表显示证书编号
    } else if (res.data.unmatched > 0) {
      ElMessage.warning(`${res.data.unmatched} 个证书未找到对应器具，请检查出厂编号`)
    }
  } catch (err) {
    ElMessage.error('批量上传失败：' + (err.response?.data?.message || err.message))
    batchProgress.value = 0
  } finally {
    batchUploading.value = false
  }
}

// === 拍照查找 ===
async function handlePhotoSearchFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); return }

  if (photoSearchPreview.value) URL.revokeObjectURL(photoSearchPreview.value)
  photoSearchPreview.value = URL.createObjectURL(file)
  photoSearchLoading.value = true
  photoSearchResult.value = null

  try {
    // 上传照片 + OCR
    const ocrRes = await uploadPhoto(file)  // 先上传
    const result = await ocrFromUrl(ocrRes.data.photo_url)

    const extracted = result.data?.extracted
    const serialNumber = extracted?.serial_number

    if (!serialNumber) {
      photoSearchResult.value = { found: false }
      ElMessage.info('未能从照片中识别到出厂编号，请尝试更清晰的照片')
      return
    }

    // 用识别出的出厂编号查找
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

function goToPhotoSearchResult() {
  if (photoSearchResult.value?.instrument) {
    photoSearchVisible.value = false
    router.push('/instruments/' + photoSearchResult.value.instrument.id)
  }
}

onMounted(async () => {
  try {
    const catRes = await getCategories()
    if (catRes.data && catRes.data.length > 0) {
      categories.value = catRes.data
    }
  } catch (e) { /* use default */ }

  // 从URL参数恢复筛选条件
  const q = route.query
  if (q.keyword) filters.keyword = q.keyword
  if (q.category) filters.category = q.category
  if (q.status) filters.status = q.status
  if (q.classification) filters.classification = q.classification
  if (q.validDate) {
    filters.validDate = q.validDate
  }
  if (q.inspectionDate) {
    filters.inspectionDate = q.inspectionDate
  }

  fetchList()
})
</script>

<style scoped>
.instrument-list-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* ============ 筛选卡片 ============ */
.filter-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
  overflow: hidden;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.filter-header h4 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.filter-header-actions {
  display: flex;
  gap: 8px;
}

.filter-body {
  padding: 16px 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.filter-search-input {
  flex: 1 1 260px;
  min-width: 200px;
}

.filter-spacer {
  flex: 1 1 20px;
  min-width: 0;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
}

.filter-tags-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-right: 4px;
}

/* ============ 表格卡片 ============ */
.table-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.table-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scroll-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: default;
  user-select: none;
}

.select-all-badge {
  font-size: 13px;
  font-weight: 600;
  color: #059669;
  white-space: nowrap;
  padding: 2px 10px;
  background: #ecfdf5;
  border-radius: 12px;
  border: 1px solid #a7f3d0;
}

/* 表格样式 */
.modern-table :deep(.el-table__header th) {
  background: #f1f5f9 !important;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
}

.modern-table :deep(.el-table__body td) {
  font-size: 13px;
}

.serial-number {
  font-weight: 500;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  color: var(--primary);
}

.cert-number {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.no-photo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f1f5f9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.valid-tag {
  font-weight: 600;
}

.status-dot-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.status-active      { background: #f0fdf4; color: #16a34a; }
.status-scrapped     { background: #f1f5f9; color: #64748b; }
.status-borrowed     { background: #fffbeb; color: #d97706; }
.status-maintenance  { background: #fef2f2; color: #dc2626; }

/* ============ 类别标签 ============ */
.category-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  border: 1px solid;
  white-space: nowrap;
}

/* ============ 分类管理标识 ============ */
.classification-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.classification-a {
  background: #fee2e2;
  color: #dc2626;
}

.classification-b {
  background: #fef3c7;
  color: #b45309;
}

.classification-c {
  background: #dbeafe;
  color: #1d4ed8;
}

.classification-empty {
  color: #cbd5e1;
  font-size: 12px;
}

/* 表格底部 */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 12px;
}

.table-info {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.table-footer :deep(.el-pagination) {
  flex-shrink: 0;
}

/* ============ 表格滚动容器 ============ */
.table-scroll-wrapper {
  /* el-table 的 max-height 属性已经控制垂直滚动，此处仅做微调 */
}

/* 增强横向滚动条 — 始终可见 + 更高（适用于 el-table 内部滚动） */
.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal) {
  height: 10px !important;
  opacity: 1 !important;
}

.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb) {
  height: 8px !important;
  background: #cbd5e1 !important;
  border-radius: 4px !important;
  min-width: 60px !important;
  opacity: 0.85 !important;
}

.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb:hover) {
  background: #94a3b8 !important;
  height: 10px !important;
}

/* 兼容原生滚动条 */
.table-scroll-wrapper::-webkit-scrollbar {
  height: 10px;
  width: 8px;
}

.table-scroll-wrapper::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 5px;
}

.table-scroll-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 5px;
  min-width: 60px;
}

.table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* ============ 拍照查找 ============ */
.photo-search-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.photo-search-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.photo-search-preview {
  text-align: center;
  background: #f8fafc;
  border-radius: 12px;
  padding: 8px;
}

.photo-search-actions {
  display: flex;
  gap: 12px;
}

.photo-search-match {
  margin-top: 12px;
  padding: 12px;
  background: #f0fdf4;
  border-radius: 8px;
}

.match-row {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.8;
}

.match-row strong {
  color: var(--text-secondary);
  display: inline-block;
  width: 80px;
}

/* ============ 批量上传证书 ============ */
.batch-cert-body {
  display: flex;
  flex-direction: column;
}

.upload-drag-area {
  padding: 32px 20px;
  text-align: center;
}

.upload-drag-area p {
  font-size: 14px;
  color: #606266;
  margin: 8px 0 0;
}

.upload-drag-area em {
  color: #409EFF;
  font-style: normal;
}

.upload-hint {
  font-size: 12px !important;
  color: #c0c4cc !important;
}

.results-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ============ 日期列筛选 ============ */
.date-col-header {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: default;
}

.date-filter-icon {
  cursor: pointer;
  color: #c0c4cc;
  transition: color 0.2s;
  flex-shrink: 0;
}

.date-filter-icon:hover {
  color: #409EFF;
}

.date-filter-icon.filter-active {
  color: #409EFF;
}

.date-filter-popover {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ============ 响应式 ============ */
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  .filter-search-input {
    width: 100%;
  }
}
</style>
