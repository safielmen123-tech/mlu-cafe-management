import { readSession, writeSession } from './sessionStorage'

const DEFAULT_API_BASE = 'http://localhost:5500/api'

export const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '')

export function getAuthToken() {
  return readSession()?.token ?? null
}

export async function apiFetch(path, options = {}) {
  const token = getAuthToken()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers,
  })
}

function parseFilenameFromDisposition(headerValue) {
  if (!headerValue) return null
  const match = headerValue.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? null
}

export async function apiDownload(path, fallbackFilename = 'download', query = {}) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const downloadPath = queryString ? `${normalizedPath}?${queryString}` : normalizedPath
  const response = await apiFetch(downloadPath)

  if (!response.ok) {
    let message = 'Download failed'
    try {
      const payload = await response.json()
      message = payload.message || message
    } catch {
      // Response body is not JSON
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const filename =
    parseFilenameFromDisposition(response.headers.get('Content-Disposition')) || fallbackFilename

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)

  return filename
}

export async function apiUpload(path, fieldName, file) {
  const token = getAuthToken()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const formData = new FormData()
  formData.append(fieldName, file)

  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.message || payload.detail || 'Upload failed')
  }

  return payload
}

export function updateSessionUser(user) {
  const session = readSession()
  if (!session) return
  writeSession({ ...session, user })
}
