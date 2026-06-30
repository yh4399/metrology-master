<template>
  <div class="dashboard">
    <!-- 统计卡片行 -->
    <div class="stats-row">
      <div class="stat-card" @click="$router.push('/instruments')">
        <div class="stat-icon-wrap total">
          <el-icon :size="24"><Monitor /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.totalCount }}</div>
          <div class="stat-label">总台件数</div>
        </div>
        <div class="stat-trend up">
          <el-icon><Top /></el-icon>
        </div>
      </div>

      <div class="stat-card" @click="$router.push('/warning')">
        <div class="stat-icon-wrap danger">
          <el-icon :size="24"><WarningFilled /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value danger-text">{{ stats.expired }}</div>
          <div class="stat-label">已过期</div>
        </div>
        <div class="stat-trend down">
          <span>需处理</span>
        </div>
      </div>

      <div class="stat-card" @click="$router.push('/warning')">
        <div class="stat-icon-wrap warning">
          <el-icon :size="24"><Clock /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value warning-text">{{ stats.expiringSoon }}</div>
          <div class="stat-label">30天内到期</div>
        </div>
        <div class="stat-trend info">
          <span>即将到期</span>
        </div>
      </div>

      <div class="stat-card" @click="$router.push('/instruments/add')">
        <div class="stat-icon-wrap primary">
          <el-icon :size="24"><CirclePlusFilled /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value primary-text">+</div>
          <div class="stat-label">新增器具</div>
        </div>
        <div class="stat-trend primary">
          <span>录入</span>
        </div>
      </div>
    </div>

    <!-- 分类统计 + 到期列表 -->
    <div class="content-row">
      <!-- 分类统计 -->
      <div class="card category-card">
        <div class="card-header">
          <h4>📊 按类别统计</h4>
          <el-button link type="primary" size="small" @click="$router.push('/instruments')">
            查看全部 →
          </el-button>
        </div>
        <div class="card-body">
          <div v-if="stats.byCategory && stats.byCategory.length > 0" class="category-list">
            <div
              v-for="(item, idx) in stats.byCategory.slice(0, 10)"
              :key="item.category"
              class="category-item"
              @click="$router.push({ path: '/instruments', query: { category: item.category } })"
            >
              <div class="cat-rank">{{ idx + 1 }}</div>
              <div class="cat-name">{{ item.category }}</div>
              <div class="cat-bar-wrap">
                <div
                  class="cat-bar"
                  :style="{ width: getBarPercent(item.count) + '%', background: getBarColor(idx) }"
                ></div>
              </div>
              <div class="cat-count">{{ item.count }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无数据" :image-size="80" />
        </div>
      </div>

      <!-- 即将到期 -->
      <div class="card expiring-card">
        <div class="card-header">
          <h4>⏰ 即将到期提醒</h4>
          <el-button link type="danger" size="small" @click="$router.push('/warning')">
            全部预警 →
          </el-button>
        </div>
        <div class="card-body">
          <el-table
            v-if="expiringList.length > 0"
            :data="expiringList"
            stripe
            size="small"
            max-height="400"
            empty-text="暂无即将到期的器具"
            @row-click="row => $router.push('/instruments/' + row.id)"
            style="cursor: pointer;"
          >
            <el-table-column type="index" label="序号" width="45" align="center" />
            <el-table-column prop="category" label="器具类别" width="100" show-overflow-tooltip />
            <el-table-column prop="installation_location" label="安装位置" width="120" show-overflow-tooltip />
            <el-table-column prop="serial_number" label="出厂编号" width="140" show-overflow-tooltip />
            <el-table-column prop="certificate_number" label="证书编号" width="140" show-overflow-tooltip />
            <el-table-column prop="inspection_date" label="检验日期" width="95" align="center">
              <template #default="{ row }">{{ formatDate(row.inspection_date) }}</template>
            </el-table-column>
            <el-table-column prop="valid_until" label="有效日期" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getValidTagType(row.valid_until)" size="small" effect="dark">
                  {{ formatDate(row.valid_until) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="剩余" width="65" align="center">
              <template #default="{ row }">
                <span :class="'remain-badge ' + getRemainClass(row.valid_until)">
                  {{ getRemainDays(row.valid_until) }}天
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click.stop="$router.push('/instruments/' + row.id)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="所有器具均在有效期内 🎉" :image-size="80" />
        </div>
      </div>
    </div>

    <!-- 状态分布 -->
    <div class="card status-card">
      <div class="card-header">
        <h4>📋 状态分布</h4>
      </div>
      <div class="card-body">
        <div class="status-bar-row">
          <div
            v-for="s in statusList"
            :key="s.value"
            class="status-segment"
            :style="{ flex: s.count || 0.1 }"
          >
            <div class="status-bar-fill" :style="{ background: s.color }"></div>
            <div class="status-bar-label">
              <span class="status-dot" :style="{ background: s.color }"></span>
              {{ s.label }}
              <strong>{{ s.count || 0 }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Monitor, WarningFilled, Clock, CirclePlusFilled, Top } from '@element-plus/icons-vue'
import { getInstrumentStats, getInstruments } from '../api/instruments'

const stats = ref({
  totalCount: 0,
  expired: 0,
  expiringSoon: 0,
  byCategory: [],
  byStatus: []
})
const expiringList = ref([])

const statusList = computed(() => {
  const map = [
    { value: 'active',      label: '在用', color: '#22c55e' },
    { value: 'scrapped',    label: '报废', color: '#94a3b8' },
    { value: 'borrowed',    label: '借出', color: '#f59e0b' },
    { value: 'maintenance', label: '维修', color: '#ef4444' },
  ]
  const byStatus = stats.value.byStatus || []
  return map.map(m => {
    const found = byStatus.find(s => s.status === m.value)
    return { ...m, count: found ? found.count : 0 }
  })
})

function getBarPercent(count) {
  const max = Math.max(...(stats.value.byCategory || []).map(c => c.count), 1)
  return Math.round((count / max) * 100)
}

function getBarColor(idx) {
  const colors = [
    'linear-gradient(90deg, #4f6ef7, #7b93fa)',
    'linear-gradient(90deg, #6366f1, #8b5cf6)',
    'linear-gradient(90deg, #06b6d4, #22d3ee)',
    'linear-gradient(90deg, #22c55e, #4ade80)',
    'linear-gradient(90deg, #f59e0b, #fbbf24)',
  ]
  return colors[idx % colors.length]
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

function getRemainDays(validUntil) {
  if (!validUntil) return '-'
  return Math.ceil((new Date(validUntil) - new Date()) / 86400000)
}

function getRemainClass(validUntil) {
  if (!validUntil) return ''
  const diff = Math.ceil((new Date(validUntil) - new Date()) / 86400000)
  if (diff < 0) return 'expired'
  if (diff <= 7) return 'urgent'
  if (diff <= 30) return 'warn'
  return ''
}

onMounted(async () => {
  try {
    const [statsRes, listRes] = await Promise.all([
      getInstrumentStats(),
      getInstruments({
        validTo: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        sortBy: 'valid_until',
        sortOrder: 'asc',
        pageSize: 20
      })
    ])
    stats.value = statsRes.data
    expiringList.value = listRes.data.list
  } catch (err) {
    // handled
  }
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

/* ============ 统计卡片 ============ */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all var(--transition);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 4px;
  height: 100%;
  transition: width var(--transition);
}

.stat-card:nth-child(1)::before { background: var(--primary); }
.stat-card:nth-child(2)::before { background: var(--danger); }
.stat-card:nth-child(3)::before { background: var(--warning); }
.stat-card:nth-child(4)::before { background: var(--primary); }

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.stat-card:hover::before {
  width: 6px;
}

.stat-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-wrap.total    { background: #eff6ff; color: #4f6ef7; }
.stat-icon-wrap.danger   { background: #fef2f2; color: #ef4444; }
.stat-icon-wrap.warning  { background: #fffbeb; color: #f59e0b; }
.stat-icon-wrap.primary  { background: #eef2ff; color: #6366f1; }

.stat-body {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 30px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -1px;
}

.danger-text { color: #ef4444; }
.warning-text { color: #f59e0b; }
.primary-text { color: #6366f1; }

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.stat-trend {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 500;
  white-space: nowrap;
  align-self: flex-start;
}

.stat-trend.up    { background: #eff6ff; color: #4f6ef7; }
.stat-trend.down  { background: #fef2f2; color: #ef4444; }
.stat-trend.info  { background: #fffbeb; color: #f59e0b; }
.stat-trend.primary { background: #eef2ff; color: #6366f1; }

/* ============ 内容行 ============ */
.content-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 20px;
  margin-bottom: 24px;
}

/* ============ 卡片 ============ */
.card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
}

.card-header h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-body {
  padding: 16px 20px;
}

/* ============ 分类列表 ============ */
.category-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background var(--transition);
}

.category-item:hover {
  background: #f1f5f9;
}

.cat-rank {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #f1f5f9;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 600;
}

.cat-name {
  width: 80px;
  font-size: 13px;
  color: var(--text-primary);
  flex-shrink: 0;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 4px;
}

.cat-count {
  width: 36px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
  flex-shrink: 0;
}

/* ============ 到期列表 ============ */
.remain-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}

.remain-badge.expired {
  background: #fef2f2;
  color: #ef4444;
}

.remain-badge.urgent {
  background: #fff1f0;
  color: #ff4d4f;
}

.remain-badge.warn {
  background: #fffbeb;
  color: #f59e0b;
}

/* ============ 状态分布 ============ */
.status-card {
  margin-bottom: 24px;
}

.status-bar-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.status-segment {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-bar-fill {
  height: 32px;
  border-radius: 8px;
  min-width: 60px;
  transition: all 0.5s ease;
}

.status-bar-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-bar-label strong {
  color: var(--text-primary);
  margin-left: 2px;
}

/* ============ 响应式 ============ */
@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .content-row {
    grid-template-columns: 1fr;
  }
}
</style>
