<template>
  <el-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="560px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="history-content">
      <el-empty v-if="!loading && history.length === 0" description="暂无修改历史" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="version in history"
          :key="version.id"
          :timestamp="formatDateTime(version.created_at)"
          placement="top"
          type="success"
        >
          <el-card shadow="never" class="history-card">
            <div class="history-heading">
              <div>
                <strong>{{ actionLabel(version.action) }}</strong>
                <el-tag size="small" type="info" effect="plain">{{ sourceLabel(version.source) }}</el-tag>
              </div>
              <el-button
                v-if="canRestore(version)"
                type="primary"
                link
                :loading="restoringId === version.id"
                @click="restoreVersion(version)"
              >{{ restoreButtonLabel(version) }}</el-button>
            </div>
            <div v-if="showsFieldDiff(version) && diffOf(version).length" class="change-list">
              <div v-for="(change, index) in diffOf(version)" :key="change.field || index" class="change-row">
                <span class="change-label">{{ change.label || change.field }}</span>
                <span class="change-before">{{ formatHistoryValue(change.before) }}</span>
                <span class="change-arrow">→</span>
                <span class="change-after">{{ formatHistoryValue(change.after) }}</span>
              </div>
            </div>
            <div v-else class="no-diff">{{ version.summary || '未记录字段差异' }}</div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getInstrumentHistory, restoreInstrumentVersion } from '../api/instruments'
import { formatHistoryValue, parseHistoryDiff, sourceLabel } from '../utils/instrumentHistory'

const props = defineProps({ modelValue: Boolean, instrument: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue', 'restored'])
const loading = ref(false)
const restoringId = ref(null)
const history = ref([])
let loadSequence = 0
const drawerTitle = computed(() => `修改历史 · ${props.instrument?.serial_number || props.instrument?.category || ''}`)

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
function diffOf(version) { return parseHistoryDiff(version.diff_data ?? version.diff) }
function showsFieldDiff(version) { return ['update', 'restore_version'].includes(version.action) }
function actionLabel(action) {
  return ({ create: '新增器具', update: '修改器具', delete: '删除器具', restore_version: '恢复版本', restore_deleted: '恢复删除' })[action] || action || '修改器具'
}
function canRestore(version) { return !['delete'].includes(version.action) && (version.after_data || version.after_snapshot || version.snapshot) }
function restoresBeforeChange(version) { return ['update', 'restore_version'].includes(version.action) }
function restoreButtonLabel(version) { return restoresBeforeChange(version) ? '恢复到修改前' : '恢复到此版本' }

async function loadHistory() {
  if (!props.instrument?.id) return
  const instrumentId = props.instrument.id
  const sequence = ++loadSequence
  loading.value = true
  try {
    const res = await getInstrumentHistory(instrumentId)
    if (sequence !== loadSequence || props.instrument?.id !== instrumentId) return
    history.value = Array.isArray(res.data) ? res.data : (res.data?.list || [])
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

watch(() => [props.modelValue, props.instrument?.id], ([visible]) => {
  if (visible) loadHistory()
})

async function restoreVersion(version) {
  try {
    const target = restoresBeforeChange(version) ? '该次修改前的状态' : '这个历史版本'
    await ElMessageBox.confirm(`确定将器具恢复到${target}吗？当前状态也会作为一条新历史保留。`, '恢复历史版本', { type: 'warning' })
    restoringId.value = version.id
    await restoreInstrumentVersion(props.instrument.id, version.id)
    ElMessage.success('已恢复到所选版本')
    await loadHistory()
    emit('restored')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error
  } finally { restoringId.value = null }
}
</script>

<style scoped>
.history-content { min-height: 180px; padding-right: 8px; }
.history-card { border-color: #e2e8f0; }
.history-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.history-heading > div { display: flex; align-items: center; gap: 8px; }
.change-list { margin-top: 12px; display: grid; gap: 8px; }
.change-row { display: grid; grid-template-columns: 90px minmax(0, 1fr) 20px minmax(0, 1fr); align-items: start; gap: 6px; font-size: 13px; }
.change-label { color: #64748b; }
.change-before { color: #b45309; word-break: break-all; }
.change-arrow { color: #94a3b8; text-align: center; }
.change-after { color: #15803d; word-break: break-all; }
.no-diff { margin-top: 10px; color: #94a3b8; font-size: 13px; }
</style>
