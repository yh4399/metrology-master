<template>
  <el-dialog v-model="visible" title="📋 证书日期校验" width="1100px" :close-on-click-modal="false" @open="$emit('load')">
    <div v-loading="loading">
      <div v-if="data" style="margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap">
        <span style="font-size:13px;color:var(--text-secondary);line-height:24px">证书→检验：</span>
        <el-tag size="small" type="success">匹配 {{ data.certMatch }}</el-tag>
        <el-tag size="small" type="danger">不匹配 {{ data.certMismatch }}</el-tag>
        <el-tag size="small" type="danger">缺失 {{ data.certMissing }}</el-tag>
        <el-tag size="small" type="info">无法提取 {{ data.certNoExtract }}</el-tag>
      </div>
      <div v-if="data" style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap">
        <span style="font-size:13px;color:var(--text-secondary);line-height:24px">检验→有效：</span>
        <el-tag size="small" type="success">匹配 {{ data.validMatch }}</el-tag>
        <el-tag size="small" type="danger">不匹配 {{ data.validMismatch }}</el-tag>
        <el-tag size="small" type="danger">缺失 {{ data.validMissing }}</el-tag>
      </div>
      <div v-if="data" style="margin-bottom:12px;display:flex;gap:8px">
        <el-checkbox v-model="onlyMismatch" @change="$emit('load')">仅看不匹配/缺失</el-checkbox>
        <el-button type="primary" size="small" :disabled="selected.length === 0" @click="$emit('batchUpdate')">批量更新选中项（{{ selected.length }}）</el-button>
      </div>
      <el-table v-if="data" :data="data.results" max-height="400" size="small" stripe @selection-change="(rows) => $emit('update:selected', rows)">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="category" label="类别" width="90" show-overflow-tooltip />
        <el-table-column prop="serial_number" label="出厂编号" width="120" show-overflow-tooltip />
        <el-table-column prop="certificate_number" label="证书编号" min-width="200" show-overflow-tooltip />
        <el-table-column label="证书→检验" width="150" align="center">
          <template #default="{ row }">
            <template v-if="row.cert_status === 'cert_mismatch'">
              <span style="text-decoration:line-through;color:#dc2626;font-size:12px">{{ fmt(row.inspection_date) }}</span>
              <span style="color:#16a34a;font-weight:600;margin-left:2px">→ {{ row.extracted_date }}</span>
            </template>
            <template v-else-if="row.cert_status === 'cert_missing'">
              <span style="color:#c0c4cc">-</span><span style="color:#16a34a;font-weight:600;margin-left:2px">→ {{ row.extracted_date }}</span>
            </template>
            <span v-else-if="row.cert_status === 'cert_match'" style="color:#16a34a;font-size:12px">{{ fmt(row.inspection_date) }} ✓</span>
            <span v-else style="color:#c0c4cc;font-size:12px">-</span>
          </template>
        </el-table-column>
        <el-table-column label="检验→有效" width="160" align="center">
          <template #default="{ row }">
            <template v-if="row.valid_status === 'valid_mismatch'">
              <span style="text-decoration:line-through;color:#dc2626;font-size:12px">{{ fmt(row.valid_until) }}</span>
              <span style="color:#409EFF;font-weight:600;margin-left:2px">→ {{ row.expected_valid_until }}</span>
            </template>
            <template v-else-if="row.valid_status === 'valid_missing'">
              <span style="color:#c0c4cc">-</span><span style="color:#409EFF;font-weight:600;margin-left:2px">→ {{ row.expected_valid_until }}</span>
            </template>
            <span v-else-if="row.valid_status === 'valid_match'" style="color:#16a34a;font-size:12px">{{ fmt(row.valid_until) }} ✓</span>
            <span v-else style="color:#c0c4cc;font-size:12px">-</span>
          </template>
        </el-table-column>
        <el-table-column label="综合" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'match'" size="small" type="success">正常</el-tag>
            <el-tag v-else-if="row.status === 'mismatch'" size="small" type="danger">异常</el-tag>
            <el-tag v-else-if="row.status === 'missing'" size="small" type="warning">缺失</el-tag>
            <el-tag v-else size="small" type="info">跳过</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="data && data.results.length === 0" description="没有需要关注的记录" />
    </div>
    <template #footer><el-button @click="$emit('update:visible', false)">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
const props = defineProps({ visible: Boolean, loading: Boolean, data: Object, onlyMismatch: Boolean, selected: Array })
defineEmits(['update:visible', 'load', 'update:selected', 'batchUpdate'])
function fmt(d) { return d ? String(d).slice(0, 10) : '' }
</script>
