<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" :title="editing ? '编辑规则' : '新增规则'" width="420px" :close-on-click-modal="false">
    <el-form :model="form" label-width="80px" size="default">
      <el-form-item label="器具类别">
        <el-select v-model="form.category" filterable allow-create placeholder="选择或输入类别" style="width:100%">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          <el-option label="* (匹配所有，兜底)" value="*" />
        </el-select>
      </el-form-item>
      <el-form-item label="分类管理">
        <el-select v-model="form.classification" placeholder="全部（匹配所有分类）" clearable style="width:100%">
          <el-option label="A 类" value="A" /><el-option label="B 类" value="B" /><el-option label="C 类" value="C" />
        </el-select>
      </el-form-item>
      <el-form-item label="有效期">
        <el-input-number v-model="form.period_value" :min="1" :max="99" style="width:120px" />
        <el-select v-model="form.period_unit" style="width:90px;margin-left:8px">
          <el-option label="月" value="month" /><el-option label="年" value="year" />
        </el-select>
        <span style="margin-left:8px;font-size:12px;color:#909399">（−1天）</span>
      </el-form-item>
      <el-form-item label="优先级">
        <el-input-number v-model="form.priority" :min="0" :max="99" style="width:120px" />
        <span style="margin-left:8px;font-size:12px;color:#909399">越大越优先</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="$emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({ visible: Boolean, editing: Boolean, form: Object, categories: Array })
defineEmits(['update:visible', 'save'])
</script>
