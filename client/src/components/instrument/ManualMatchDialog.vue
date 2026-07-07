<template>
  <el-dialog v-model="visible" title="📋 手动选择目标器具" width="820px" :close-on-click-modal="false">
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom:16px">
      证书出厂编号：<code>{{ cert?.serialNumber }}</code>，请选择要关联的器具
    </el-alert>
    <el-input v-model="keyword" placeholder="搜索出厂编号/型号/位置…" clearable @input="$emit('search', keyword)" style="margin-bottom:12px">
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>
    <el-table :data="candidates" highlight-current-row max-height="400" size="small" v-loading="searching" @row-click="(r) => $emit('select', r)">
      <el-table-column label="选择" width="60" align="center">
        <template #default="{ row }"><el-radio :model-value="selected?.id" :value="row.id" @change="$emit('select', row)" /></template>
      </el-table-column>
      <el-table-column prop="category" label="类别" width="130" />
      <el-table-column prop="serial_number" label="出厂编号" width="170" />
      <el-table-column prop="installation_location" label="安装位置" min-width="150" />
      <el-table-column prop="model" label="型号" width="120" />
      <el-table-column prop="manufacturer" label="厂家" width="120" />
    </el-table>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected" @click="$emit('confirm')">确认选择并关联证书</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
defineProps({ visible: Boolean, cert: Object, candidates: Array, searching: Boolean, selected: Object })
defineEmits(['update:visible', 'search', 'select', 'confirm'])
const keyword = ref('')
</script>
