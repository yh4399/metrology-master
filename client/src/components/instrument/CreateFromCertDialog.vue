<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" title="📝 用证书信息新建器具" width="520px" :close-on-click-modal="false">
    <el-form :model="form" label-width="90px" size="default">
      <el-form-item label="器具类别">
        <el-select v-model="form.category" filterable allow-create style="width:100%">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </el-form-item>
      <el-form-item label="出厂编号"><el-input :model-value="form.serialNumber" disabled /></el-form-item>
      <el-form-item label="证书编号"><el-input :model-value="form.certificateNumber" disabled /></el-form-item>
      <el-form-item label="检验日期"><el-input :model-value="form.inspectionDate" disabled /></el-form-item>
      <el-form-item label="有效日期"><el-input :model-value="form.validUntil" disabled /></el-form-item>
      <el-form-item label="分类管理">
        <el-select v-model="form.classification" clearable style="width:100%">
          <el-option label="A 类" value="A类" /><el-option label="B 类" value="B类" /><el-option label="C 类" value="C类" />
        </el-select>
      </el-form-item>
      <el-form-item label="安装位置"><el-input v-model="form.location" placeholder="选填" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="$emit('confirm', form)">创建器具并关联证书</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({ visible: Boolean, form: Object, categories: Array, loading: Boolean })
defineEmits(['update:visible', 'confirm'])
</script>
