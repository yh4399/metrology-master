<template>
  <el-dialog v-model="visible" title="📋 选择导出列" width="480px" :close-on-click-modal="false">
    <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
      勾选需要导出的字段，未勾选的字段将不会出现在导出文件中。
    </el-alert>
    <div class="export-columns-grid">
      <el-checkbox v-for="opt in fieldOptions" :key="opt.value"
        :model-value="selected.includes(opt.value)"
        @change="(val) => $emit('toggle', opt.value, val)">
        {{ opt.label }}
      </el-checkbox>
    </div>
    <div style="margin-top:12px">
      <el-button link size="small" @click="$emit('update:selected', fieldOptions.map(o => o.value))">全选</el-button>
      <el-button link size="small" @click="$emit('update:selected', [])">清空</el-button>
      <span style="margin-left:8px;font-size:12px;color:#909399">已选 {{ selected.length }} / {{ fieldOptions.length }} 列</span>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="$emit('confirm')">确认导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({
  visible: Boolean,
  fieldOptions: Array,
  selected: Array
})
defineEmits(['update:visible', 'update:selected', 'toggle', 'confirm'])
</script>
