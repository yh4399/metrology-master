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
