<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" title="⚠ 确认以证书为准修正" width="500px" :close-on-click-modal="false">
    <div style="line-height:2.2">
      <p>即将将以下器具关联到证书：</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">
        <tr><td style="color:#909399;padding:4px 8px">证书出厂编号</td><td style="font-weight:bold;color:#409EFF;padding:4px 8px">{{ cert?.serialNumber }}</td></tr>
        <tr><td style="color:#909399;padding:4px 8px">证书编号</td><td style="padding:4px 8px;word-break:break-all">{{ cert?.certificateNumber }}</td></tr>
        <tr v-if="cert?.extractedInspectionDate" style="background:#f0f9eb">
          <td style="color:#909399;padding:4px 8px">证书检验日期</td><td style="font-weight:bold;color:#67c23a;padding:4px 8px">{{ cert.extractedInspectionDate }}</td></tr>
        <tr v-if="cert?.calculatedValidUntil" style="background:#f0f9eb">
          <td style="color:#909399;padding:4px 8px">计算有效日期</td><td style="font-weight:bold;color:#67c23a;padding:4px 8px">{{ cert.calculatedValidUntil }}</td></tr>
        <tr style="background:#fef0f0"><td style="color:#909399;padding:4px 8px">系统当前出厂编号</td><td style="font-weight:bold;color:#e6a23c;padding:4px 8px">{{ target?.serial_number }}</td></tr>
        <tr><td style="color:#909399;padding:4px 8px">器具类别</td><td style="padding:4px 8px">{{ target?.category }}</td></tr>
        <tr><td style="color:#909399;padding:4px 8px">安装位置</td><td style="padding:4px 8px">{{ target?.installation_location || '-' }}</td></tr>
        <tr><td style="color:#909399;padding:4px 8px">型号</td><td style="padding:4px 8px">{{ target?.model || '-' }}</td></tr>
      </table>
      <el-checkbox v-model="updateSerialProxy">同时将出厂编号修改为 <code>{{ cert?.serialNumber }}</code>（以证书为准）</el-checkbox>
      <el-alert type="warning" :closable="false" show-icon style="margin-top:12px">此操作将修改台账数据，修改记录会写入变更历史。</el-alert>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="$emit('confirm')">确认修正</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ visible: Boolean, cert: Object, target: Object, loading: Boolean, updateSerial: Boolean })
const emit = defineEmits(['update:visible', 'confirm', 'update:updateSerial'])
const updateSerialProxy = computed({
  get: () => props.updateSerial,
  set: (v) => emit('update:updateSerial', v)
})
</script>
