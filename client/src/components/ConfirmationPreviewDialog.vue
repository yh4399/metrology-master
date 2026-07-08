<template>
  <el-dialog
    v-model="visible"
    title="📋 计量确认记录"
    width="95%"
    top="2vh"
    :close-on-click-modal="false"
    :before-close="handleClose"
    destroy-on-close
  >
    <div v-loading="loading">
      <!-- 批次信息表单 -->
      <div class="conf-form-header">
        <el-form :model="form" label-width="80px" inline>
          <el-form-item label="使用单位">
            <el-input v-model="form.usingUnit" placeholder="如：海一采油管理区中心一号平台" style="width:260px" size="small" />
          </el-form-item>
          <el-form-item label="确认日期">
            <el-date-picker v-model="form.confirmationDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width:160px" size="small" />
          </el-form-item>
          <el-form-item label="确认人">
            <el-input v-model="form.confirmationPerson" placeholder="确认人姓名" style="width:140px" size="small" />
          </el-form-item>
          <el-form-item label="批准人">
            <el-input v-model="form.approver" placeholder="批准人姓名" style="width:140px" size="small" />
          </el-form-item>
        </el-form>
      </div>

      <!-- 数据表格 -->
      <div class="conf-table-wrap">
        <el-table
          :data="tableData"
          size="small"
          border
          stripe
          max-height="60vh"
          style="width:100%"
          header-cell-class-name="conf-header-cell"
        >
          <el-table-column prop="seq" label="序号" width="52" fixed align="center" class-name="col-gray" />
          <el-table-column prop="category" label="器具名称" width="110" show-overflow-tooltip />
          <el-table-column prop="serial_number" label="器具编号" width="140" show-overflow-tooltip />
          <el-table-column prop="model" label="规格型号" width="100" show-overflow-tooltip />
          <el-table-column prop="accuracy_class" label="准确度等级" width="110" show-overflow-tooltip />
          <el-table-column prop="range" label="测量范围" width="110" show-overflow-tooltip />
          <el-table-column prop="inspection_date" label="检测日期" width="105" align="center" class-name="col-gray col-yahei" />
          <el-table-column prop="certificate_number" label="证书编号" width="200" show-overflow-tooltip class-name="col-gray col-yahei" />
          <el-table-column label="检测单位" width="160" class-name="col-gray col-yahei">
            <template #default="{ row }">
              <el-input v-model="row.inspection_unit" size="small" placeholder="检测单位" />
            </template>
          </el-table-column>
          <el-table-column label="检测结果" width="110" align="center">
            <template #default="{ row }">
              <el-input v-model="row.detectionResult" size="small" placeholder="如：0.05级" />
            </template>
          </el-table-column>
          <el-table-column prop="installation_location" label="计量点" width="140" show-overflow-tooltip class-name="col-gray col-yahei" />
          <el-table-column label="测量范围(现场)" width="120">
            <template #default="{ row }">
              <el-input v-model="row.fieldRange" size="small" :placeholder="row.range" />
            </template>
          </el-table-column>
          <el-table-column label="准确度(现场)" width="120">
            <template #default="{ row }">
              <el-input v-model="row.fieldAccuracy" size="small" :placeholder="row.accuracy_class" />
            </template>
          </el-table-column>
          <el-table-column label="封印/标签" width="100" align="center" class-name="col-gray col-yahei">
            <template #default="{ row }">
              <el-select v-model="row.sealLabelIntact" size="small" style="width:100%">
                <el-option label="完好" value="完好" />
                <el-option label="破损" value="破损" />
                <el-option label="缺失" value="缺失" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="确认结果" width="130" align="center">
            <template #default="{ row }">
              <el-select v-model="row.confirmationResult" size="small" style="width:100%">
                <el-option label="符合使用要求" value="符合使用要求" />
                <el-option label="准用" value="准用" />
                <el-option label="禁用" value="禁用" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="备注" width="130">
            <template #default="{ row }">
              <el-input v-model="row.remarks" size="small" placeholder="备注" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <span class="footer-hint" v-if="lastSaved">上次保存：{{ lastSaved }}</span>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">💾 保存</el-button>
        <el-button type="success" :loading="exporting" @click="handleExport">📥 导出Excel</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getConfirmationPreview, saveConfirmation, exportConfirmation } from '../api/instruments'

const props = defineProps({
  modelValue: Boolean,
  batchId: [Number, String]
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const lastSaved = ref('')

const form = ref({
  usingUnit: '',
  confirmationDate: '',
  confirmationPerson: '',
  approver: ''
})

const tableData = ref([])

// 监听打开
watch(() => props.modelValue, async (val) => {
  if (val && props.batchId) {
    await loadData()
  }
})

async function loadData() {
  loading.value = true
  try {
    const res = await getConfirmationPreview(props.batchId)
    const { batch, items } = res.data

    // 填充表单
    const info = batch.confirmationInfo || {}
    form.value.usingUnit = info.usingUnit || ''
    form.value.confirmationDate = info.confirmationDate || ''
    form.value.confirmationPerson = info.confirmationPerson || ''
    form.value.approver = info.approver || ''

    // 填充表格数据
    tableData.value = items.map((item, idx) => ({
      _id: item.id,
      seq: idx + 1,
      category: item.instrument?.category || item.category || '',
      serial_number: item.instrument?.serial_number || item.serial_number || '',
      model: item.instrument?.model || item.model || '',
      accuracy_class: item.instrument?.accuracy_class || '',
      range: item.instrument?.range || '',
      inspection_date: (item.new_inspection_date || '').replace(/-/g, '.'),
      certificate_number: item.new_certificate_number || '',
      installation_location: item.instrument?.installation_location || item.installation_location || '',
      // 可编辑字段
      inspection_unit: item.confirmationData?.detectionUnit || item.instrument?.inspection_unit || '',
      detectionResult: item.confirmationData?.detectionResult || '',
      fieldRange: item.confirmationData?.fieldRange || '',
      fieldAccuracy: item.confirmationData?.fieldAccuracy || '',
      sealLabelIntact: item.confirmationData?.sealLabelIntact || '完好',
      confirmationResult: item.confirmationData?.confirmationResult || '符合使用要求',
      remarks: item.confirmationData?.remarks || ''
    }))
  } catch (err) {
    ElMessage.error('加载确认数据失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const items = tableData.value.map(row => ({
      id: row._id,
      confirmationData: {
        detectionUnit: row.inspection_unit,
        detectionResult: row.detectionResult,
        fieldRange: row.fieldRange,
        fieldAccuracy: row.fieldAccuracy,
        sealLabelIntact: row.sealLabelIntact,
        confirmationResult: row.confirmationResult,
        remarks: row.remarks
      }
    }))

    await saveConfirmation(props.batchId, {
      confirmationInfo: { ...form.value },
      items
    })
    lastSaved.value = new Date().toLocaleString('zh-CN')
    ElMessage.success('保存成功')
  } catch (err) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function handleExport() {
  exporting.value = true
  try {
    // 先保存再导出
    await handleSaveSilent()

    const response = await exportConfirmation(props.batchId)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    const unit = form.value.usingUnit || '未命名单位'
    const date = new Date().toISOString().slice(0, 10)
    link.download = `计量确认记录_${unit}_${date}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// 静默保存（导出前自动保存）
async function handleSaveSilent() {
  try {
    const items = tableData.value.map(row => ({
      id: row._id,
      confirmationData: {
        detectionUnit: row.inspection_unit,
        detectionResult: row.detectionResult,
        fieldRange: row.fieldRange,
        fieldAccuracy: row.fieldAccuracy,
        sealLabelIntact: row.sealLabelIntact,
        confirmationResult: row.confirmationResult,
        remarks: row.remarks
      }
    }))
    await saveConfirmation(props.batchId, {
      confirmationInfo: { ...form.value },
      items
    })
    lastSaved.value = new Date().toLocaleString('zh-CN')
  } catch (_) { /* 静默 */ }
}

function handleClose() {
  visible.value = false
}
</script>

<style scoped>
.conf-form-header {
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 16px;
}
.conf-table-wrap {
  border-radius: 8px;
  overflow: hidden;
}
.dialog-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}
.footer-hint {
  margin-right: auto;
  font-size: 12px;
  color: #909399;
}

/* 表格灰底列 */
:deep(.col-gray) {
  background-color: #f0f0f0 !important;
}
:deep(.col-yahei) {
  font-family: '微软雅黑', sans-serif;
}
:deep(.conf-header-cell) {
  background: #fafafa !important;
  font-weight: 600;
  font-size: 12px;
}
:deep(.el-table .el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
}
:deep(.el-table .el-input__wrapper:hover),
:deep(.el-table .el-input__wrapper:focus) {
  box-shadow: 0 0 0 1px #409EFF inset !important;
}
:deep(.el-table .el-select .el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
}
</style>
