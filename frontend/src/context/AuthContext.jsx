import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {
  clearSession,
  consumeConnectionLost,
  markConnectionLost,
  readSession,
  writeSession,
} from '../services/sessionStorage'
import { writeActiveView, resetActiveViewForLogin } from '../utils/activeViewStorage'
import { apiFetch, CONNECTION_LOST_EVENT } from '../services/apiClient'
import {
  canAccessView,
  isAdminRole,
  normalizePermissions,
} from '../utils/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession())

  const endLocalSession = useCallback((reason) => {
    if (reason === 'connection-lost' && readSession()?.token) {
      markConnectionLost()
    }
    clearSession()
    setSession(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const currentSession = readSession()
    if (!currentSession?.token) return null

    try {
      const res = await apiFetch('/auth/me', { token: currentSession.token })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          endLocalSession()
        }
        return null
      }

      const nextUser = {
        ...data.user,
        permissions: normalizePermissions(data.user?.permissions),
      }

      const nextSession = {
        ...currentSession,
        user: nextUser,
      }
      writeSession(nextSession)
      setSession(nextSession)
      return nextUser
    } catch {
      endLocalSession('connection-lost')
      return null
    }
  }, [endLocalSession])

  const login = useCallback(async ({ username, password }) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: username?.trim(),
        password,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const retryHeader = Number.parseInt(res.headers.get('Retry-After') || '', 10)
      const retryAfterSeconds = Number(data.retryAfterSeconds)
        || (Number.isFinite(retryHeader) ? retryHeader : 0)
      const error = new Error(
        res.status === 429
          ? 'Too many attempts. Please try again later.'
          : 'Username or password is incorrect.',
      )
      error.status = res.status
      error.retryAfterSeconds = res.status === 429 ? retryAfterSeconds : 0
      throw error
    }

    consumeConnectionLost()

    const nextUser = {
      ...data.user,
      permissions: normalizePermissions(data.user?.permissions),
    }

    const activePage = 'dashboard'
    resetActiveViewForLogin()

    const nextSession = {
      token: data.token,
      user: nextUser,
      activePage,
    }

    writeSession(nextSession)
    setSession(nextSession)
  }, [])

  const logout = useCallback(() => {
    const token = readSession()?.token
    if (token) {
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
    }
    endLocalSession()
  }, [endLocalSession])

  const setActivePage = useCallback((page) => {
    writeActiveView(page)
    setSession((prev) => {
      if (!prev) return prev
      const next = { ...prev, activePage: page }
      writeSession(next)
      return next
    })
  }, [])

  const adoptSession = useCallback((token, user) => {
    const current = readSession()
    const nextUser = {
      ...user,
      permissions: normalizePermissions(user?.permissions),
      must_change_password: Boolean(user?.must_change_password),
    }
    const nextSession = {
      token,
      user: nextUser,
      activePage: current?.activePage || 'dashboard',
    }
    writeSession(nextSession)
    setSession(nextSession)
  }, [])

  const completePasswordChange = useCallback(async ({ password, confirmPassword }) => {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ password, confirmPassword }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.message || 'Could not update the password.')
    }
    adoptSession(data.token, data.user)
  }, [adoptSession])

  useEffect(() => {
    if (!session?.token) return undefined

    refreshUser()

    const interval = setInterval(() => {
      if (!readSession()?.token) return
      refreshUser()
    }, 30000)
    const handleFocus = () => {
      if (!readSession()?.token) return
      refreshUser()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [session?.token, refreshUser])

  useEffect(() => {
    const requireLogin = () => {
      if (!readSession()?.token) {
        setSession((prev) => (prev ? null : prev))
        return
      }
      endLocalSession('connection-lost')
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false && readSession()?.token) {
      requireLogin()
    }

    const handlePageShow = (event) => {
      if (!event.persisted) return
      if (navigator.onLine === false || !readSession()?.token) {
        requireLogin()
      }
    }

    window.addEventListener('offline', requireLogin)
    window.addEventListener(CONNECTION_LOST_EVENT, requireLogin)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('offline', requireLogin)
      window.removeEventListener(CONNECTION_LOST_EVENT, requireLogin)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [endLocalSession])

  const user = session?.user ?? null

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      token: session?.token ?? null,
      user,
      isAdmin: isAdminRole(user?.role),
      activePage: session?.activePage ?? 'dashboard',
      login,
      logout,
      setActivePage,
      refreshUser,
      adoptSession,
      completePasswordChange,
      canAccess: (viewId) => canAccessView(user, viewId),
    }),
    [session, user, login, logout, setActivePage, refreshUser, adoptSession, completePasswordChange],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
