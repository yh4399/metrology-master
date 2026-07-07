<template>
  <el-dialog v-model="visible" title="📥 上传台账总表" width="460px" :close-on-click-modal="false">
    <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">上传后将覆盖已有台账总表。上传后可在"查看台账总表"中随时打开。</el-alert>
    <el-upload ref="uploadRef" :auto-upload="false" :limit="1" accept=".xlsx,.xls" :on-change="(f) => $emit('fileChange', f)" :on-remove="$emit('fileRemove')" drag>
      <div class="upload-drag-area">
        <el-icon :size="36" color="#409EFF"><UploadFilled /></el-icon>
        <p>拖拽Excel到此处，或<em>点击选择文件</em></p>
      </div>
    </el-upload>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!hasFile" :loading="uploading" @click="$emit('upload')">确认上传</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { UploadFilled } from '@element-plus/icons-vue'
defineProps({ visible: Boolean, hasFile: Boolean, uploading: Boolean })
defineEmits(['update:visible', 'fileChange', 'fileRemove', 'upload'])
</script>
