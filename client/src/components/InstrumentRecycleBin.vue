<template>
  <el-dialog :model-value="modelValue" title="回收站" width="820px" destroy-on-close @update:model-value="$emit('update:modelValue', $event)" @open="loadList">
    <el-alert title="删除的器具可在这里恢复；彻底删除后无法找回。" type="info" :closable="false" show-icon class="recycle-hint" />
    <el-table v-loading="loading" :data="rows" stripe max-height="480">
      <el-table-column prop="category" label="器具类别" width="130" />
      <el-table-column prop="serial_number" label="出厂编号" min-width="150" />
      <el-table-column prop="installation_location" label="安装位置" min-width="150" show-overflow-tooltip />
      <el-table-column label="删除时间" width="170"><template #default="{ row }">{{ formatDateTime(row.deleted_at) }}</template></el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link :loading="busyId === row.id" @click="restore(row)">恢复</el-button>
          <el-button type="danger" link :loading="busyId === row.id" @click="purge(row)">彻底删除</el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty description="回收站为空" /></template>
    </el-table>
    <div class="recycle-pagination">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @change="loadList" />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRecycleBin, purgeDeletedInstrument, restoreDeletedInstrument } from '../api/instruments'

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'restored'])
const loading = ref(false), busyId = ref(null), rows = ref([]), page = ref(1), pageSize = ref(20), total = ref(0)
function formatDateTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-' }
async function loadList() {
  loading.value = true
  try {
    const res = await getRecycleBin({ page: page.value, pageSize: pageSize.value })
    const data = res.data || {}
    rows.value = Array.isArray(data) ? data : (data.list || [])
    total.value = Array.isArray(data) ? data.length : (data.total || 0)
    if (rows.value.length === 0 && page.value > 1 && total.value > 0) {
      page.value--
      return loadList()
    }
  } finally { loading.value = false }
}
async function restore(row) {
  try {
    await ElMessageBox.confirm(`确定恢复“${row.serial_number || row.category}”吗？`, '恢复器具', { type: 'info' })
    busyId.value = row.id
    await restoreDeletedInstrument(row.id)
    ElMessage.success('器具已恢复')
    await loadList(); emit('restored')
  } catch (error) { if (error !== 'cancel' && error !== 'close') throw error } finally { busyId.value = null }
}
async function purge(row) {
  try {
    await ElMessageBox.confirm(`彻底删除“${row.serial_number || row.category}”？其全部修改历史也会删除，且不可恢复。`, '不可恢复的操作', { type: 'error', confirmButtonText: '彻底删除' })
    busyId.value = row.id
    await purgeDeletedInstrument(row.id)
    ElMessage.success('已彻底删除')
    await loadList()
  } catch (error) { if (error !== 'cancel' && error !== 'close') throw error } finally { busyId.value = null }
}
</script>

<style scoped>
.recycle-hint { margin-bottom: 16px; }
.recycle-pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
