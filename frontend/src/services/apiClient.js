import { readSession, writeSession } from './sessionStorage'
import { deviceHeaders } from '../utils/deviceFingerprint'

const DEFAULT_API_BASE = 'http://localhost:5500/api'

export const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '')

export const CONNECTION_LOST_EVENT = 'mlu:connection-lost'

const PUBLIC_API_PATHS = new Set(['/auth/login', '/auth/forgot-password'])
const SILENT_NETWORK_PATHS = new Set(['/auth/login', '/auth/forgot-password', '/auth/logout'])

function normalizeApiPath(path) {
  const withSlash = path.startsWith('/') ? path : `/${path}`
  return withSlash.split('?')[0]
}

function isPublicApiPath(path) {
  return PUBLIC_API_PATHS.has(normalizeApiPath(path))
}

export function getAuthToken() {
  const token = readSession()?.token
  if (!token) return null
  const trimmed = String(token).trim()
  return trimmed || null
}

function unauthenticatedResponse() {
  return new Response(JSON.stringify({ message: 'Authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function apiFetch(path, options = {}) {
  const token = options.token ?? getAuthToken()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const fetchOptions = { ...options }
  delete fetchOptions.token
  const headers = {
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(await deviceHeaders()),
    ...(fetchOptions.headers || {}),
  }

  if (!isPublicApiPath(normalizedPath) && !token) {
    return unauthenticatedResponse()
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    return await fetch(`${API_BASE}${normalizedPath}`, {
      ...fetchOptions,
      headers,
    })
  } catch (error) {
    if (!SILENT_NETWORK_PATHS.has(normalizeApiPath(normalizedPath))) {
      window.dispatchEvent(new CustomEvent(CONNECTION_LOST_EVENT))
    }
    throw error
  }
}

function parseFilenameFromDisposition(headerValue) {
  if (!headerValue) return null
  const match = headerValue.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? null
}

export async function apiDownload(path, fallbackFilename = 'download', query = {}) {
  if (!getAuthToken()) {
    throw new Error('Authentication required')
  }

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
  if (!token) {
    throw new Error('Authentication required')
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const formData = new FormData()
  formData.append(fieldName, file)

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(await deviceHeaders()) },
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
