const SESSION_KEY = 'romduol.session'

const VALID_PAGES = new Set([
  'dashboard',
  'users',
  'order',
  'table',
  'payment',
  'menu',
  'sales_history',
  'inventory',
  'reports_analysis',
  'reports_prediction',
  'settings',
  'backup_recovery',
])

const LEGACY_PAGE_ALIASES = {
  reports: 'reports_analysis',
}

function resolveActivePage(page) {
  const resolved = LEGACY_PAGE_ALIASES[page] ?? page
  return VALID_PAGES.has(resolved) ? resolved : 'dashboard'
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.user) return null
    return {
      token: parsed.token,
      user: parsed.user,
      activePage: resolveActivePage(parsed.activePage),
    }
  } catch {
    return null
  }
}

export function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function createSession(user, activePage = 'dashboard') {
  return {
    token: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    user,
    activePage: resolveActivePage(activePage),
  }
}

export function formatDisplayName(username) {
  if (!username?.trim()) return 'Staff User'
  const cleaned = username.trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
