import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { readSession } from '../services/sessionStorage'

const ThemeContext = createContext(null)
const THEME_KEY_PREFIX = 'mlu_kitchen_cafe-theme'
const LEGACY_THEME_KEY = 'mlu_kitchen_cafe-theme'

function themeStorageKey(userId) {
  return userId ? `${THEME_KEY_PREFIX}:u${userId}` : LEGACY_THEME_KEY
}

function readThemeForUser(userId) {
  if (typeof window === 'undefined') return 'light'
  const keyed = localStorage.getItem(themeStorageKey(userId))
  if (keyed === 'light' || keyed === 'dark') return keyed
  if (userId) {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    if (legacy === 'light' || legacy === 'dark') return legacy
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(theme)
}

function currentUserId() {
  return readSession()?.user?.id ?? null
}

const initialTheme = readThemeForUser(currentUserId())
applyThemeToDocument(initialTheme)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)
  const [boundUserId, setBoundUserId] = useState(() => currentUserId())

  useEffect(() => {
    const syncUser = () => {
      const nextId = currentUserId()
      setBoundUserId((prev) => {
        if (prev === nextId) return prev
        const nextTheme = readThemeForUser(nextId)
        setTheme(nextTheme)
        applyThemeToDocument(nextTheme)
        return nextId
      })
    }
    window.addEventListener('storage', syncUser)
    window.addEventListener('mlu:session-changed', syncUser)
    const interval = window.setInterval(syncUser, 1500)
    return () => {
      window.removeEventListener('storage', syncUser)
      window.removeEventListener('mlu:session-changed', syncUser)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    applyThemeToDocument(theme)
    localStorage.setItem(themeStorageKey(boundUserId), theme)
    // Keep the unscoped key as the login-screen fallback (last signed-in look).
    localStorage.setItem(LEGACY_THEME_KEY, theme)
    localStorage.setItem('theme', theme)
  }, [theme, boundUserId])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
