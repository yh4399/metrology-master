import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getValidityRules, createValidityRule, updateValidityRule,
  deleteValidityRule, resetValidityRules
} from '../api/instruments'

export function useValidityRules() {
  const rulesConfigVisible = ref(false)
  const rulesLoading = ref(false)
  const rulesList = ref([])
  const ruleFormVisible = ref(false)
  const editingRule = ref(null)
  const ruleForm = reactive({
    category: '', classification: null, period_value: 1, period_unit: 'year', priority: 0
  })

  async function loadRules() {
    rulesLoading.value = true
    try {
      const res = await getValidityRules()
      rulesList.value = res.data.rules
    } catch (err) {
      ElMessage.error('加载规则失败')
    } finally {
      rulesLoading.value = false
    }
  }

  function openRuleForm(rule) {
    if (rule) {
      editingRule.value = rule
      ruleForm.category = rule.category
      ruleForm.classification = rule.classification
      ruleForm.period_value = rule.period_value
      ruleForm.period_unit = rule.period_unit
      ruleForm.priority = rule.priority
    } else {
      editingRule.value = null
      ruleForm.category = ''
      ruleForm.classification = null
      ruleForm.period_value = 1
      ruleForm.period_unit = 'year'
      ruleForm.priority = 0
    }
    ruleFormVisible.value = true
  }

  async function saveRule() {
    if (!ruleForm.category) { ElMessage.warning('请选择或输入类别'); return }
    try {
      if (editingRule.value) {
        await updateValidityRule(editingRule.value.id, { ...ruleForm })
        ElMessage.success('规则更新成功')
      } else {
        await createValidityRule({ ...ruleForm })
        ElMessage.success('规则添加成功')
      }
      ruleFormVisible.value = false
      await loadRules()
    } catch (err) {
      ElMessage.error('保存失败：' + (err.response?.data?.message || err.message))
    }
  }

  async function handleDeleteRule(rule) {
    if (rule.category === '*' && rule.classification === null) {
      ElMessage.warning('默认兜底规则不可删除')
      return
    }
    try {
      const { ElMessageBox } = await import('element-plus')
      await ElMessageBox.confirm(`确定删除规则「${rule.category === '*' ? '默认' : rule.category}」吗？`, '确认删除', {
        confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
      })
    } catch { return }
    try {
      await deleteValidityRule(rule.id)
      ElMessage.success('删除成功')
      await loadRules()
    } catch (err) {
      ElMessage.error('删除失败')
    }
  }

  async function handleResetRules() {
    try {
      const { ElMessageBox } = await import('element-plus')
      await ElMessageBox.confirm('确定重置为默认规则吗？所有自定义规则将被清除。', '确认重置', {
        confirmButtonText: '确认重置', cancelButtonText: '取消', type: 'warning'
      })
    } catch { return }
    try {
      const res = await resetValidityRules()
      rulesList.value = res.data.rules
      ElMessage.success('已重置为默认规则')
    } catch (err) {
      ElMessage.error('重置失败')
    }
  }

  return {
    rulesConfigVisible, rulesLoading, rulesList,
    ruleFormVisible, editingRule, ruleForm,
    loadRules, openRuleForm, saveRule, handleDeleteRule, handleResetRules
  }
}
