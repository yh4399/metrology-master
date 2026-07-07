<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" :title="title" width="95%" top="2vh" :close-on-click-modal="false" @open="$emit('load')" :destroy-on-close="true">
    <div v-loading="loading">
      <div v-if="sheets.length > 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
          <el-radio-group v-model="activeIdx" size="small" @change="$emit('cancelEdit')">
            <el-radio-button v-for="(s, i) in sheets" :key="i" :value="i">{{ s.name }}</el-radio-button>
          </el-radio-group>
          <div style="display:flex;gap:6px;align-items:center">
            <el-dropdown v-if="history.length > 1" @command="(v) => $emit('switchVersion', v)">
              <el-button size="small">📅 历史版本 ▾</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="h in history" :key="h.fileName" :command="h.fileName" :class="{ 'is-active': h.fileName === currentFile }">
                    {{ fmtLabel(h) }}
                    <el-button v-if="h.fileName !== currentFile" link size="small" type="danger" style="margin-left:8px" @click.stop="$emit('deleteVersion', h)">🗑️</el-button>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" @click="$emit('download')"><el-icon><Download /></el-icon> 下载</el-button>
            <el-button size="small" type="primary" @click="$emit('addRow')" :disabled="!!editingRow || readOnly"><el-icon><Plus /></el-icon> 添加行</el-button>
          </div>
        </div>
        <div class="ledger-table-wrap">
          <table class="ledger-table" v-if="currentSheet">
            <tr v-for="(row, ri) in currentSheet.rows" :key="ri"
              :class="{ 'header-row': ri === currentSheet._headerIdx, 'data-row': ri !== currentSheet._headerIdx, 'zebra-even': ri !== currentSheet._headerIdx && ri % 2 === 0 }">
              <template v-if="editingRow === ri">
                <td v-for="(cell, ci) in editRow" :key="ci" :class="{ 'col-frozen': ci === 0 }"><input v-model="editRow[ci]" class="ledger-edit-input" /></td>
                <td class="ledger-actions"><el-button link type="success" size="small" @click="$emit('saveRow', ri)">确认</el-button><el-button link type="info" size="small" @click="$emit('cancelEdit')">取消</el-button></td>
              </template>
              <template v-else-if="adding && ri === currentSheet.rows.length - 1">
                <td v-for="(cell, ci) in newRow" :key="ci" :class="{ 'col-frozen': ci === 0 }"><input v-model="newRow[ci]" class="ledger-edit-input" /></td>
                <td class="ledger-actions"><el-button link type="success" size="small" @click="$emit('saveNewRow')">确认</el-button><el-button link type="info" size="small" @click="$emit('cancelEdit')">取消</el-button></td>
              </template>
              <template v-else>
                <td v-for="(cell, ci) in row" :key="ci"
                  :class="{ 'col-frozen': ci === 0, 'cell-editing': editCell && editCell.row === ri && editCell.col === ci }"
                  @dblclick="ri !== currentSheet._headerIdx && !readOnly ? $emit('startCellEdit', ri, ci, cell) : null"
                  :title="ri !== currentSheet._headerIdx && !readOnly ? '双击编辑' : ''">
                  <input v-if="editCell && editCell.row === ri && editCell.col === ci"
                    :value="editValue"
                    @input="$emit('update:editValue', $event.target.value)"
                    class="ledger-cell-input"
                    @keydown.enter.stop="$emit('saveCellEdit')"
                    @blur="$emit('saveCellEdit')"
                    @keydown.escape.stop="$emit('cancelEdit')"
                    @vue:mounted="(el) => { el.focus(); el.select(); }" />
                  <span v-else>{{ cell }}</span>
                </td>
                <td class="ledger-actions" v-if="ri !== currentSheet._headerIdx && !readOnly">
                  <el-button link type="danger" size="small" @click="$emit('deleteRow', ri)"><el-icon><Delete /></el-icon></el-button>
                </td>
              </template>
            </tr>
          </table>
        </div>
      </div>
      <div v-else-if="!loading" style="text-align:center;padding:40px;color:#909399">无法解析台账总表内容</div>
    </div>
    <template #footer><el-button @click="$emit('update:visible', false)">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Download, Plus, Edit, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean, loading: Boolean, sheets: Array, history: Array, currentFile: String,
  editingRow: [Number, null], adding: Boolean, editRow: Array, newRow: Array, readOnly: Boolean,
  editCell: Object, editValue: String,
  fmtLabel: Function, title: String
})
defineEmits(['update:visible', 'update:editValue', 'load', 'switchVersion', 'deleteVersion', 'download', 'addRow',
  'editRow', 'saveRow', 'deleteRow', 'saveNewRow', 'cancelEdit', 'startCellEdit', 'saveCellEdit'])

const activeIdx = ref(0)
const currentSheet = computed(() => props.sheets[activeIdx.value] || null)
</script>
