<template>
  <el-dialog v-model="visible" title="📷 拍照查找计量器具" width="500px" :close-on-click-modal="false">
    <div class="photo-search-body">
      <p class="photo-search-hint">拍照或上传铭牌照片，系统自动识别出厂编号并查找对应器具</p>
      <div v-if="photoSearchPreview" class="photo-search-preview">
        <el-image :src="photoUrlWithToken(photoSearchPreview)" fit="contain" style="width:100%;max-height:280px;border-radius:12px" />
      </div>
      <div class="photo-search-actions">
        <input ref="cameraRef" type="file" accept="image/*" capture="environment" style="display:none" @change="onFile" />
        <el-button type="primary" size="large" @click="cameraRef?.click()" :loading="loading" style="flex:1">
          <el-icon><Camera /></el-icon> 拍照
        </el-button>
        <input ref="fileRef" type="file" accept="image/*" style="display:none" @change="onFile" />
        <el-button size="large" @click="fileRef?.click()" :loading="loading" style="flex:1">
          <el-icon><FolderOpened /></el-icon> 上传图片
        </el-button>
      </div>
      <div v-if="result" class="photo-search-result">
        <el-alert :title="result.found ? '已找到匹配器具！' : '未找到匹配器具'" :type="result.found ? 'success' : 'warning'" :closable="false" show-icon />
        <div v-if="result.found && result.instrument" class="photo-search-match">
          <div class="match-row"><strong>出厂编号：</strong>{{ result.instrument.serial_number }}</div>
          <div class="match-row"><strong>器具类别：</strong>{{ result.instrument.category }}</div>
          <div class="match-row"><strong>型号：</strong>{{ result.instrument.model || '-' }}</div>
          <div class="match-row"><strong>安装位置：</strong>{{ result.instrument.installation_location || '-' }}</div>
          <el-button type="primary" style="margin-top:12px;width:100%" @click="$emit('goDetail', result.instrument.id)">查看详情</el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Camera, FolderOpened } from '@element-plus/icons-vue'

defineProps({
  visible: Boolean,
  loading: Boolean,
  photoSearchPreview: String,
  result: Object,
  photoUrlWithToken: Function
})

const emit = defineEmits(['update:visible', 'fileSelect'])
const cameraRef = ref(null)
const fileRef = ref(null)

function onFile(event) {
  emit('fileSelect', event)
}
</script>
