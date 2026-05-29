import apiClient from './client'
import type {
  SopCategory,
  SopTag,
  SopDocument,
  SopDocumentUpdate,
  SopListResponse,
  SopVersion,
} from '../types'

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<SopCategory[]> {
  const res = await apiClient.get<SopCategory[]>('/sop/categories')
  return res.data
}

export async function createCategory(payload: {
  name: string
  description?: string
}): Promise<SopCategory> {
  const res = await apiClient.post<SopCategory>('/sop/categories', payload)
  return res.data
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/sop/categories/${id}`)
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function getTags(): Promise<SopTag[]> {
  const res = await apiClient.get<SopTag[]>('/sop/tags')
  return res.data
}

export async function createTag(name: string): Promise<SopTag> {
  const res = await apiClient.post<SopTag>('/sop/tags', { name })
  return res.data
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface GetDocumentsParams {
  page?: number
  size?: number
  category_id?: string
  tag?: string
  search?: string
}

export async function getDocuments(params: GetDocumentsParams = {}): Promise<SopListResponse> {
  const res = await apiClient.get<SopListResponse>('/sop/documents', { params })
  return res.data
}

export async function getDocument(id: string): Promise<SopDocument> {
  const res = await apiClient.get<SopDocument>(`/sop/documents/${id}`)
  return res.data
}

export async function createDocument(
  data: {
    title: string
    description?: string
    content?: string
    category_id?: string
    tags?: string[]
  },
  file?: File,
): Promise<SopDocument> {
  const form = new FormData()
  form.append('title', data.title)
  if (data.description) form.append('description', data.description)
  if (data.content) form.append('content', data.content)
  if (data.category_id) form.append('category_id', data.category_id)
  if (data.tags && data.tags.length > 0) form.append('tags', data.tags.join(','))
  if (file) form.append('file', file)

  const res = await apiClient.post<SopDocument>('/sop/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function updateDocument(
  id: string,
  payload: SopDocumentUpdate,
): Promise<SopDocument> {
  const res = await apiClient.put<SopDocument>(`/sop/documents/${id}`, payload)
  return res.data
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/sop/documents/${id}`)
}

export async function uploadFile(id: string, file: File): Promise<SopDocument> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<SopDocument>(`/sop/documents/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function getVersions(documentId: string): Promise<SopVersion[]> {
  const res = await apiClient.get<SopVersion[]>(`/sop/documents/${documentId}/versions`)
  return res.data
}

export async function createVersion(
  documentId: string,
  data: { change_notes?: string; version?: string },
  file?: File,
): Promise<SopVersion> {
  const form = new FormData()
  if (data.change_notes) form.append('change_notes', data.change_notes)
  if (data.version) form.append('version', data.version)
  if (file) form.append('file', file)

  const res = await apiClient.post<SopVersion>(
    `/sop/documents/${documentId}/versions`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data
}

// ---------------------------------------------------------------------------
// File download
// ---------------------------------------------------------------------------

export async function downloadFile(documentId: string, fileName: string): Promise<void> {
  const res = await apiClient.get(`/sop/files/${documentId}`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
