<template>
  <el-dialog v-model="visible" title="🔍 查找匹配器具" width="750px" :close-on-click-modal="false">
    <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
      证书出厂编号：<code>{{ cert?.serialNumber }}</code>，类别：<el-tag size="small">{{ cert?.category || '未知' }}</el-tag>
    </el-alert>
    <el-input v-model="keyword" placeholder="输入安装位置、型号等辅助搜索…" clearable @input="onDebounce" style="margin-bottom:12px">
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>
    <el-table :data="candidates" @row-dblclick="(c) => $emit('confirm', c)" highlight-current-row max-height="380" size="small" v-loading="searching">
      <el-table-column label="操作" width="75" align="center">
        <template #default="{ row }"><el-button size="small" type="primary" @click="$emit('confirm', row)">匹配</el-button></template>
      </el-table-column>
      <el-table-column prop="category" label="类别" width="130" />
      <el-table-column prop="serial_number" label="出厂编号" width="170">
        <template #default="{ row }"><span :style="{ color: row.similarity < 1 ? '#e6a23c' : '' }">{{ row.serial_number }}</span></template>
      </el-table-column>
      <el-table-column prop="installation_location" label="安装位置" min-width="150" />
      <el-table-column prop="model" label="型号" width="120" />
      <el-table-column label="相似度" width="90" align="center">
        <template #default="{ row }">
          <el-progress :percentage="Math.round(row.similarity * 100)" :status="row.similarity >= 0.9 ? 'success' : ''" :stroke-width="8" :show-text="false" />
          <small>{{ Math.round(row.similarity * 100) }}%</small>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="candidates.length === 0 && searched" style="text-align:center;padding:32px;color:#909399">
      未找到匹配的器具，建议
      <el-button link type="primary" @click="$emit('createNew')">用证书信息新建器具</el-button>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="success" @click="$emit('createNew')">用证书信息新建器具</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
const props = defineProps({ visible: Boolean, cert: Object, candidates: Array, searching: Boolean, searched: Boolean })
const emit = defineEmits(['update:visible', 'confirm', 'createNew', 'search'])
const keyword = ref('')
let timer = null
function onDebounce() { clearTimeout(timer); timer = setTimeout(() => emit('search', keyword.value), 400) }
</script>
