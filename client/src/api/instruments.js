import axios from 'axios'
import request from './request'
import { useAuthStore } from '../stores/auth'

export function login(data) {
  return request.post('/auth/login', data)
}

export function getUserInfo() {
  return request.get('/auth/me')
}

export function getInstruments(params) {
  return request.get('/instruments', { params })
}

export function getInstrument(id) {
  return request.get('/instruments/' + id)
}

export function createInstrument(data) {
  return request.post('/instruments', data)
}

export function updateInstrument(id, data) {
  return request.put('/instruments/' + id, data)
}

export function deleteInstrument(id) {
  return request.delete('/instruments/' + id)
}

export function getInstrumentHistory(id) {
  return request.get(`/instruments/${id}/history`)
}

export function restoreInstrumentVersion(id, versionId) {
  return request.post(`/instruments/${id}/history/${versionId}/restore`)
}

export function getRecycleBin(params) {
  return request.get('/instruments/recycle-bin/list', { params })
}

export function restoreDeletedInstrument(id) {
  return request.post(`/instruments/recycle-bin/${id}/restore`)
}

export function purgeDeletedInstrument(id) {
  return request.delete(`/instruments/recycle-bin/${id}/purge`)
}

// 导出使用原始 axios（blob 响应，不进拦截器 JSON 检查）
export async function exportInstruments(params) {
  const authStore = useAuthStore()
  const response = await axios.get('/api/instruments/export', {
    params,
    responseType: 'blob',
    headers: { Authorization: 'Bearer ' + authStore.token }
  })
  return response
}

// 导出管理一览表（匹配参考模板格式）
export async function exportManagementSummary(params) {
  const authStore = useAuthStore()
  const response = await axios.get('/api/instruments/export/management-summary', {
    params,
    responseType: 'blob',
    headers: { Authorization: 'Bearer ' + authStore.token }
  })
  return response
}

// 导出检定申请表（匹配参考模板格式）
export async function exportWarningApply(params) {
  const authStore = useAuthStore()
  const response = await axios.get('/api/instruments/export/warning-apply', {
    params,
    responseType: 'blob',
    headers: { Authorization: 'Bearer ' + authStore.token }
  })
  return response
}

// 批量上传证书
export async function batchUploadCertificates(files) {
  const authStore = useAuthStore()
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  const response = await axios.post('/api/certificate/batch-upload', formData, {
    headers: {
      Authorization: 'Bearer ' + authStore.token
    }
  })
  return response.data
}

export function getInstrumentStats() {
  return request.get('/instruments/stats')
}

export function getCategories() {
  return request.get('/instruments/categories/list')
}

export function uploadExcel(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/instruments/import/upload', formData)
}

export function confirmImport(data) {
  return request.post('/instruments/import/confirm', data)
}

// 一键清空所有数据
export function clearAllInstruments() {
  return request.delete('/instruments/clear-all')
}

// 按类别清空数据
export function clearByCategory(category) {
  return request.delete('/instruments/clear-by-category', { params: { category } })
}

// 上传仪器照片
export function uploadPhoto(file) {
  const formData = new FormData()
  formData.append('photo', file)
  return request.post('/instruments/upload-photo', formData)
}

// OCR识别照片中的仪器信息（上传新图片）
export function ocrPhoto(file) {
  const formData = new FormData()
  formData.append('photo', file)
  return request.post('/instruments/ocr', formData)
}

// OCR识别已有照片（通过 photo_url）
export function ocrFromUrl(photoUrl) {
  return request.post('/instruments/ocr', { photo_url: photoUrl })
}

// 证书日期校验
export function checkCertDates(params) {
  return request.get('/certificate/check-dates', { params })
}

// 批量更新证书日期
export function batchUpdateCertDates(data) {
  return request.post('/certificate/batch-update-dates', data)
}

// ===== 有效日期规则管理 =====
export function getValidityRules() {
  return request.get('/certificate/validity-rules')
}
export function createValidityRule(data) {
  return request.post('/certificate/validity-rules', data)
}
export function updateValidityRule(id, data) {
  return request.put('/certificate/validity-rules/' + id, data)
}
export function deleteValidityRule(id) {
  return request.delete('/certificate/validity-rules/' + id)
}
export function resetValidityRules() {
  return request.post('/certificate/validity-rules/reset')
}

// 为单个器具上传证书 PDF
export async function uploadCertificateForInstrument(id, file) {
  const authStore = useAuthStore()
  const formData = new FormData()
  formData.append('file', file)
  const response = await axios.post('/api/instruments/' + id + '/certificate', formData, {
    headers: { Authorization: 'Bearer ' + authStore.token }
  })
  return response.data
}

// ===== 证书未匹配处理 =====

// 搜索未匹配证书的可能匹配目标
export function searchUnmatchedCert(params) {
  return request.post('/certificate/unmatched-search', params)
}

// 强制匹配：以证书为准修正器具
export function forceMatchCert(data) {
  return request.post('/certificate/force-match', data)
}

// 用证书信息创建新器具
export function createInstrumentFromCert(data) {
  return request.post('/certificate/create-from-cert', data)
}

// 多条匹配时确认选择
export function confirmCertMatch(data) {
  return request.post('/certificate/confirm-match', data)
}

// ===== 导入冲突处理 =====

// 解决导入冲突
export function resolveImportConflicts(data) {
  return request.post('/instruments/import/resolve-conflicts', data)
}

// ===== 台账总表管理 =====
export async function getLedgerInfo() {
  return request.get('/instruments/ledger/info')
}
export async function uploadLedger(file) {
  const authStore = useAuthStore()
  const formData = new FormData()
  formData.append('file', file)
  const response = await axios.post('/api/instruments/ledger/upload', formData, {
    headers: { Authorization: 'Bearer ' + authStore.token }
  })
  return response.data
}

// ===== 送检批次管理 =====
export function getInspectionBatches() {
  return request.get('/inspection-batches')
}
export function createInspectionBatch(data) {
  return request.post('/inspection-batches', data)
}
export function getInspectionBatch(id) {
  return request.get('/inspection-batches/' + id)
}
export function updateInspectionBatch(id, data) {
  return request.put('/inspection-batches/' + id, data)
}
export function deleteInspectionBatch(id) {
  return request.delete('/inspection-batches/' + id)
}
export function addBatchItems(batchId, instrumentIds) {
  return request.post('/inspection-batches/' + batchId + '/items', { instrumentIds })
}
export function updateBatchItem(batchId, itemId, data) {
  return request.put('/inspection-batches/' + batchId + '/items/' + itemId, data)
}
