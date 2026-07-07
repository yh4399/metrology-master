<template>
  <el-dialog v-model="visible" title="📄 批量上传证书" width="700px" :close-on-click-modal="false" @close="$emit('reset')">
    <div class="batch-cert-body">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        <template #title>
          支持批量上传PDF证书文件，系统将自动从文件名提取出厂编号并匹配对应器具<br/>
          <small>文件名格式：<code>YB-H1-ZX1-2026040306-2313072607.pdf</code>（最后一段为出厂编号）</small>
        </template>
      </el-alert>

      <el-upload ref="uploadRef" v-model:file-list="files" :auto-upload="false" :accept="'.pdf'" multiple drag :limit="200">
        <template #default>
          <div class="upload-drag-area">
            <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
            <p>将PDF证书拖拽到此处，或<em>点击选择文件</em></p>
            <p class="upload-hint">支持同时选择多个PDF文件，最多200个</p>
          </div>
        </template>
      </el-upload>

      <div v-if="uploading" style="margin-top:16px; text-align:center">
        <el-progress :percentage="progress" :status="progress === 100 ? 'success' : ''" />
        <p style="color:#909399;margin-top:8px">正在处理中...</p>
      </div>

      <div v-if="results && results.length > 0" class="batch-results" style="margin-top:16px">
        <el-divider />
        <div class="results-summary" style="margin-bottom:12px">
          <el-tag type="success">匹配成功: {{ summary.matched }}</el-tag>
          <el-tag type="warning" style="margin-left:8px">未匹配: {{ summary.unmatched }}</el-tag>
          <el-tag type="danger" style="margin-left:8px">出错: {{ summary.error }}</el-tag>
        </div>
        <el-table :data="results" max-height="300" size="small" stripe>
          <el-table-column prop="fileName" label="文件名" min-width="280" show-overflow-tooltip />
          <el-table-column prop="serialNumber" label="出厂编号" width="140" show-overflow-tooltip />
          <el-table-column prop="category" label="类别前缀" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="检验日期" width="110" align="center">
            <template #default="{ row }">
              <span v-if="row.extractedInspectionDate">{{ row.extractedInspectionDate }}</span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>
          <el-table-column label="有效日期" width="110" align="center">
            <template #default="{ row }">
              <span v-if="row.calculatedValidUntil">{{ row.calculatedValidUntil }}</span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>
          <el-table-column label="匹配结果" width="160">
            <template #default="{ row: r }">
              <template v-if="r.status === 'matched'">
                <el-tag size="small" type="success">✅ {{ r.matchedInstrument?.serial_number }}</el-tag>
              </template>
              <template v-else-if="r.status === 'multi_match'">
                <div style="display:flex;align-items:center;gap:4px">
                  <el-tag size="small" type="warning">⚠ 多条匹配（{{ r.matchedInstruments?.length }}）</el-tag>
                  <el-button link size="small" type="primary" @click="$emit('multiMatch', r)">处理</el-button>
                </div>
              </template>
              <template v-else-if="r.status === 'unmatched'">
                <div style="display:flex;align-items:center;gap:4px">
                  <el-tag size="small" type="warning">⚠ 未匹配</el-tag>
                  <el-dropdown trigger="click" @command="(cmd) => $emit('unmatchedAction', cmd, r)">
                    <el-button link size="small" type="primary">处理 <el-icon><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="search"><el-icon><Search /></el-icon> 模糊搜索匹配</el-dropdown-item>
                        <el-dropdown-item command="manual"><el-icon><List /></el-icon> 手动选择器具</el-dropdown-item>
                        <el-dropdown-item command="create" divided><el-icon><Plus /></el-icon> 用证书信息新建器具</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
              <template v-else>
                <el-tag size="small" type="danger">❌ {{ r.error || '解析失败' }}</el-tag>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">关闭</el-button>
      <el-button v-if="results" type="danger" plain :disabled="uploading" @click="$emit('clearResults')">
        <el-icon><Delete /></el-icon> 清除结果，继续上传
      </el-button>
      <el-button type="primary" :disabled="files.length === 0" :loading="uploading" @click="$emit('upload')">
        <el-icon><UploadFilled /></el-icon> 上传并匹配（{{ files.length }} 个文件）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { Search, Plus, UploadFilled, Delete, ArrowDown, List } from '@element-plus/icons-vue'
defineProps({
  visible: Boolean, files: Array, uploading: Boolean, progress: Number,
  results: Array, summary: Object
})
defineEmits(['update:visible', 'reset', 'upload', 'clearResults', 'multiMatch', 'unmatchedAction'])
</script>
