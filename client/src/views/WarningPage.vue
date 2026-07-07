<template>
  <div class="warning-page">
    <!-- 统计概览 -->
    <div class="warning-stats">
      <div class="wstat-card danger">
        <div class="wstat-icon"><el-icon :size="22"><CircleCloseFilled /></el-icon></div>
        <div class="wstat-body">
          <div class="wstat-value">{{ stats.expired }}</div>
          <div class="wstat-label">已过期</div>
        </div>
      </div>
      <div class="wstat-card urgent">
        <div class="wstat-icon"><el-icon :size="22"><WarningFilled /></el-icon></div>
        <div class="wstat-body">
          <div class="wstat-value">{{ stats.expiring7 }}</div>
          <div class="wstat-label">7天内到期</div>
        </div>
      </div>
      <div class="wstat-card warn">
        <div class="wstat-icon"><el-icon :size="22"><Clock /></el-icon></div>
        <div class="wstat-body">
          <div class="wstat-value">{{ stats.expiring30 }}</div>
          <div class="wstat-label">30天内到期</div>
        </div>
      </div>
      <div class="wstat-card safe">
        <div class="wstat-icon"><el-icon :size="22"><CircleCheckFilled /></el-icon></div>
        <div class="wstat-body">
          <div class="wstat-value">{{ stats.valid }}</div>
          <div class="wstat-label">有效期内</div>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="warning-table-card">
      <div class="table-topbar">
        <div class="table-title-row">
          <h4>⚠️ 到期预警清单</h4>
          <el-radio-group v-model="filterMode" size="small" @change="fetchData">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="expired">已过期</el-radio-button>
            <el-radio-button value="7days">7天内到期</el-radio-button>
            <el-radio-button value="30days">30天内到期</el-radio-button>
          </el-radio-group>
        </div>
        <div style="display:flex;gap:8px">
          <el-button type="primary" plain @click="goToWorkspace">
            <el-icon><Setting /></el-icon> 送检工作台{{ selectedWarningIds.size > 0 ? '（' + selectedWarningIds.size + '）' : '' }}
          </el-button>
          <el-button @click="handleExportWarning">
            <el-icon><Download /></el-icon> 导出预警清单
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width:100%"
        max-height="calc(100vh - 370px)"
        class="warning-table"
        @row-click="row => $router.push('/instruments/' + row.id)"
        @selection-change="handleWarningSelectionChange"
        ref="warningTableRef"
      >
        <el-table-column type="selection" width="45" fixed="left" />
        <el-table-column type="index" label="序号" width="55" align="center" fixed="left" :index="indexMethod" />

        <el-table-column prop="category" label="器具类别" width="110" fixed="left" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" effect="light" type="info">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="installation_location" label="安装位置" width="150" fixed="left" show-overflow-tooltip />

        <el-table-column prop="serial_number" label="出厂编号" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="field-serial">{{ row.serial_number || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="certificate_number" label="证书编号" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="field-cert">{{ row.certificate_number || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="inspection_date" label="检验日期" width="105" align="center">
          <template #default="{ row }">{{ formatDate(row.inspection_date) }}</template>
        </el-table-column>

        <el-table-column prop="valid_until" label="有效日期" width="105" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="getValidTagType(row.valid_until)" size="small" effect="dark">
              {{ formatDate(row.valid_until) || '-' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="剩余天数" width="85" align="center" sortable="custom">
          <template #default="{ row }">
            <span :class="'remain-cell ' + getRemainClass(row.valid_until)">
              {{ getRemainDays(row.valid_until) }}天
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="model" label="型号规格" width="120" show-overflow-tooltip />

        <el-table-column prop="manufacturer" label="生产厂家" width="140" show-overflow-tooltip />

        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="$router.push('/instruments/' + row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <div class="table-info">
          第 {{ pagination.page }} 页 / 共 {{ Math.ceil(pagination.total / pagination.pageSize) }} 页 · 共 <strong>{{ pagination.total }}</strong> 条预警记录
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 30, 50, 100, 200, 400]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCloseFilled, WarningFilled, Clock, CircleCheckFilled, Download, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getInstruments, getInstrumentStats } from '../api/instruments'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const filterMode = ref('all')
const selectedWarningIds = reactive(new Set())
const warningTableRef = ref(null)

function handleWarningSelectionChange(rows) {
  selectedWarningIds.clear()
  rows.forEach(r => selectedWarningIds.add(r.id))
}

function goToWorkspace() {
  if (selectedWarningIds.size > 0) {
    router.push({ path: '/inspection-workspace', query: { ids: [...selectedWarningIds].join(',') } })
  } else {
    router.push({ path: '/inspection-workspace' })
  }
}

const stats = reactive({
  expired: 0,
  expiring7: 0,
  expiring30: 0,
  valid: 0
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

function formatDate(date) {
  if (!date) return '-'
  return String(date).slice(0, 10)
}

function indexMethod(idx) {
  return (pagination.page - 1) * pagination.pageSize + idx + 1
}

function getRemainDays(validUntil) {
  if (!validUntil) return '-'
  return Math.ceil((new Date(validUntil) - new Date()) / 86400000)
}

function getValidTagType(validUntil) {
  if (!validUntil) return 'info'
  const diff = getRemainDays(validUntil)
  if (diff < 0) return 'danger'
  if (diff <= 7) return 'danger'
  if (diff <= 30) return 'warning'
  return 'success'
}

function getRemainClass(validUntil) {
  if (!validUntil) return ''
  const diff = getRemainDays(validUntil)
  if (diff < 0) return 'expired'
  if (diff <= 7) return 'urgent'
  if (diff <= 30) return 'warn'
  return 'safe'
}

async function fetchData() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: 'valid_until',
      sortOrder: 'asc'
    }

    const now = new Date().toISOString().slice(0, 10)
    const d7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    if (filterMode.value === 'expired') {
      params.validTo = now
    } else if (filterMode.value === '7days') {
      params.validFrom = now
      params.validTo = d7
    } else if (filterMode.value === '30days') {
      params.validFrom = now
      params.validTo = d30
    }

    const [statsRes, listRes] = await Promise.all([
      getInstrumentStats(),
      getInstruments(params)
    ])

    const s = statsRes.data
    stats.expired = s.expired || 0
    stats.expiring30 = s.expiringSoon || 0

    // 单独获取7天内到期数
    const d7Res = await getInstruments({
      validFrom: now, validTo: d7, pageSize: 1
    })
    stats.expiring7 = d7Res.data.total || 0
    stats.valid = (s.totalCount || 0) - stats.expired

    tableData.value = listRes.data.list
    pagination.total = listRes.data.total
  } catch (err) {
    // handled
  } finally {
    loading.value = false
  }
}

async function handleExportWarning() {
  try {
    const params = {
      sortBy: 'valid_until',
      sortOrder: 'asc'
    }
    // 根据筛选模式决定日期范围
    const now = new Date().toISOString().slice(0, 10)
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    if (filterMode.value === 'expired') {
      params.validTo = now
    } else if (filterMode.value === '7days') {
      const d7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      params.validFrom = now
      params.validTo = d7
    } else if (filterMode.value === '30days') {
      params.validFrom = now
      params.validTo = d30
    } else {
      // "all" mode — export all upcoming (now + 30 days) and expired
      params.validTo = d30
    }

    const authStore = useAuthStore()
    const response = await axios.get('/api/instruments/export/warning-apply', {
      params,
      responseType: 'blob',
      headers: { Authorization: 'Bearer ' + authStore.token }
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    const dateLabel = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = '计量器具检定申请_' + dateLabel + '.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    // handled
  }
}

onMounted(fetchData)
</script>

<style scoped>
.warning-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* ============ 统计卡片 ============ */
.warning-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.wstat-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--border-color);
  border-left: 4px solid;
  transition: all var(--transition);
}

.wstat-card.danger  { border-left-color: #ef4444; }
.wstat-card.urgent  { border-left-color: #f97316; }
.wstat-card.warn    { border-left-color: #f59e0b; }
.wstat-card.safe    { border-left-color: #22c55e; }

.wstat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.wstat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wstat-card.danger .wstat-icon { background: #fef2f2; color: #ef4444; }
.wstat-card.urgent .wstat-icon { background: #fff7ed; color: #f97316; }
.wstat-card.warn   .wstat-icon { background: #fffbeb; color: #f59e0b; }
.wstat-card.safe   .wstat-icon { background: #f0fdf4; color: #22c55e; }

.wstat-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.wstat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* ============ 表格卡片 ============ */
.warning-table-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.table-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.table-title-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.table-title-row h4 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

/* 表格样式 */
.warning-table {
  cursor: pointer;
}

.field-serial {
  font-weight: 600;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  color: var(--primary);
}

.field-cert {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.remain-cell {
  font-weight: 700;
  font-size: 13px;
  padding: 3px 10px;
  border-radius: 12px;
}

.remain-cell.expired { background: #fef2f2; color: #ef4444; }
.remain-cell.urgent  { background: #ffedd5; color: #f97316; }
.remain-cell.warn    { background: #fffbeb; color: #d97706; }
.remain-cell.safe    { background: #f0fdf4; color: #16a34a; }

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
}

.table-info {
  font-size: 13px;
  color: var(--text-muted);
}

.table-info strong {
  color: var(--text-primary);
}

.warning-table :deep(.el-table__header th) {
  background: #f1f5f9 !important;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
}

.warning-table :deep(.el-table__body td) {
  font-size: 13px;
}

/* 增强横向滚动条 — 始终可见 */
.warning-table :deep(.el-scrollbar__bar.is-horizontal) {
  height: 10px !important;
  opacity: 1 !important;
}

.warning-table :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb) {
  height: 8px !important;
  background: #cbd5e1 !important;
  border-radius: 4px !important;
  min-width: 60px !important;
  opacity: 0.85 !important;
}

.warning-table :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb:hover) {
  background: #94a3b8 !important;
  height: 10px !important;
}
</style>
