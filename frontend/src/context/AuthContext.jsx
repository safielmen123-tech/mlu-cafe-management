import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {

  clearSession,

  readSession,

  writeSession,

} from '../services/sessionStorage'

import { writeActiveView, resetActiveViewForLogin } from '../utils/activeViewStorage'

import { apiFetch } from '../services/apiClient'

import {

  canAccessView,

  isAdminRole,

  normalizePermissions,

} from '../utils/permissions'



const AuthContext = createContext(null)



export function AuthProvider({ children }) {

  const [session, setSession] = useState(() => readSession())



  const refreshUser = useCallback(async () => {

    const currentSession = readSession()

    if (!currentSession?.token) return null



    try {

      const res = await apiFetch('/auth/me')

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {

        if (res.status === 401) {

          clearSession()

          setSession(null)

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

      return null

    }

  }, [])



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

      throw new Error(data.message || 'Invalid username or password')

    }



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
    clearSession()
    setSession(null)
  }, [])



  const setActivePage = useCallback((page) => {

    writeActiveView(page)

    setSession((prev) => {

      if (!prev) return prev

      const next = { ...prev, activePage: page }

      writeSession(next)

      return next

    })

  }, [])



  useEffect(() => {

    if (!session?.token) return undefined



    refreshUser()



    const interval = setInterval(refreshUser, 30000)

    const handleFocus = () => refreshUser()

    window.addEventListener('focus', handleFocus)



    return () => {

      clearInterval(interval)

      window.removeEventListener('focus', handleFocus)

    }

  }, [session?.token, refreshUser])



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

      canAccess: (viewId) => canAccessView(user, viewId),

    }),

    [session, user, login, logout, setActivePage, refreshUser],

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





