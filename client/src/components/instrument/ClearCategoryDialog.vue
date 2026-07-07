<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" title="按类别清空数据" width="420px" :close-on-click-modal="false">
    <el-alert title="此操作将删除指定类别下的所有计量器具记录，不可撤销！" type="warning" :closable="false" show-icon style="margin-bottom:16px" />
    <el-form label-width="80px">
      <el-form-item label="选择类别">
        <el-select v-model="category" placeholder="请选择要清空的类别" filterable style="width:100%">
          <el-option v-for="cat in categories" :key="cat" :label="cat + ' (' + (counts[cat] || 0) + '条)'" :value="cat" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="danger" :disabled="!category" :loading="loading" @click="$emit('confirm', category)">确认清空</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ visible: Boolean, categories: Array, counts: Object, loading: Boolean })
const emit = defineEmits(['update:visible', 'confirm'])
const category = ref('')
</script>
