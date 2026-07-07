<template>
  <el-dialog v-model="visible" title="⚙ 有效日期计算规则" width="750px" :close-on-click-modal="false" @open="$emit('load')">
    <div v-loading="loading">
      <div style="margin-bottom:12px;display:flex;gap:8px">
        <el-button size="small" type="danger" plain @click="$emit('reset')">重置为默认规则</el-button>
        <el-button size="small" type="primary" @click="$emit('addRule')">+ 新增规则</el-button>
      </div>
      <el-table :data="rules" max-height="400" size="small" stripe>
        <el-table-column prop="priority" label="优先级" width="70" align="center" />
        <el-table-column prop="category" label="类别" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.category === '*'" size="small" type="info">* (默认)</el-tag>
            <span v-else>{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.classification" size="small">{{ row.classification }}类</el-tag>
            <span v-else style="color:#909399">全部</span>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="100" align="center">
          <template #default="{ row }">{{ row.period_value }} {{ row.period_unit === 'year' ? '年' : '月' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$emit('editRule', row)">编辑</el-button>
            <el-button link type="danger" size="small" :disabled="row.category === '*' && row.classification === null" @click="$emit('deleteRule', row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:8px;font-size:12px;color:#909399">匹配规则：优先级从高到低，首个匹配类别+分类的规则生效。* = 匹配所有类别，分类为空 = 匹配所有分类。</div>
    </div>
    <template #footer><el-button @click="$emit('update:visible', false)">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
defineProps({ visible: Boolean, loading: Boolean, rules: Array })
defineEmits(['update:visible', 'load', 'reset', 'addRule', 'editRule', 'deleteRule'])
</script>
