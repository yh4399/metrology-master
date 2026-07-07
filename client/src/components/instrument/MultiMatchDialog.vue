<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" title="⚠ 多条匹配 — 请选择目标器具" width="700px" :close-on-click-modal="false">
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom:16px">
      证书出厂编号 <code>{{ cert?.serialNumber }}</code> 匹配到 <strong>{{ cert?.matchedInstruments?.length || 0 }}</strong> 条器具，请选择要关联的目标（可多选）。
    </el-alert>
    <div class="multi-match-list">
      <div v-for="inst in (cert?.matchedInstruments || [])" :key="inst.id"
        :class="['multi-match-item', { selected: selected.has(inst.id), mismatch: inst.categoryMatch === false }]"
        @click="$emit('toggle', inst.id)">
        <el-checkbox :model-value="selected.has(inst.id)" @click.stop @change="$emit('toggle', inst.id)" />
        <div class="mm-info">
          <div class="mm-line1">
            <el-tag size="small" :type="inst.categoryMatch === false ? 'danger' : ''">#{{ inst.id }}</el-tag>
            <span class="mm-category">{{ inst.category }}</span>
            <code class="mm-serial">{{ inst.serial_number }}</code>
            <el-tag v-if="inst.categoryMatch === false" size="small" type="danger">类别不一致</el-tag>
          </div>
          <div class="mm-line2">
            <span>位置: {{ inst.installation_location || '-' }}</span>
            <span>型号: {{ inst.model || '-' }}</span>
            <span>厂家: {{ inst.manufacturer || '-' }}</span>
          </div>
          <div class="mm-line3">
            <span>证书: {{ (inst.certificate_number || '').slice(-24) || '(空)' }}</span>
            <span>检验日期: {{ inst.inspection_date || '(空)' }}</span>
            <span :style="{ color: dateColor(inst.valid_until) }">有效至: {{ inst.valid_until || '(空)' }}</span>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top:8px">
      <el-button link size="small" @click="cert?.matchedInstruments?.forEach(i => selected.add(i.id))">全选</el-button>
      <el-button link size="small" @click="selected.clear()">清空</el-button>
      <span style="font-size:12px;color:#909399;margin-left:8px">已选 {{ selected.size }} 条</span>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">全部跳过</el-button>
      <el-button type="primary" :disabled="selected.size === 0" :loading="loading" @click="$emit('confirm', [...selected])">确认所选（{{ selected.size }} 条）</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({ visible: Boolean, cert: Object, selected: Object, loading: Boolean, dateColor: Function })
defineEmits(['update:visible', 'toggle', 'confirm'])
</script>
