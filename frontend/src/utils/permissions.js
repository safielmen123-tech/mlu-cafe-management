export const PERMISSION_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'order', label: 'Order' },
  { id: 'table', label: 'Table' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'payment', label: 'Payment' },
  { id: 'menu', label: 'Menu Management' },
  { id: 'settings', label: 'Settings' },
  { id: 'backup_recovery', label: 'Backup & Recovery' },
  { id: 'sales_history', label: 'Sales History' },
  { id: 'inventory_stock', label: 'Inventory & Stock' },
  { id: 'reports', label: 'Reports' },
]

export const VALID_PERMISSIONS = PERMISSION_OPTIONS.map((option) => option.id)

const PERMISSION_ALIASES = {
  inventory: 'inventory_stock',
}

export const VIEW_PERMISSION_MAP = {
  dashboard: 'dashboard',
  order: 'order',
  table: 'table',
  reservations: ['reservations', 'table'],
  payment: 'payment',
  menu: 'menu',
  sales_history: 'sales_history',
  inventory: 'inventory_stock',
  reports_analysis: ['reports', 'reports_analysis'],
  settings: 'settings',
  backup_recovery: 'backup_recovery',
}

export function isAdminRole(role) {
  return String(role || '').toLowerCase() === 'admin'
}

export function parsePermissions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function normalizePermissions(rawPermissions) {
  const allowed = new Set(VALID_PERMISSIONS)
  const normalized = new Set()

  for (const permission of parsePermissions(rawPermissions)) {
    const key = String(permission).toLowerCase()
    const resolved = PERMISSION_ALIASES[key] || key
    if (allowed.has(resolved)) {
      normalized.add(resolved)
    }
  }

  return [...normalized]
}

export function userHasPermission(user, permissionId) {
  if (!user) return false
  if (isAdminRole(user.role)) return true
  const permissions = normalizePermissions(user.permissions)
  return permissions.includes(permissionId)
}

function viewRequiresAnyPermission(user, requiredPermissions) {
  const keys = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
  return keys.some((permissionId) => userHasPermission(user, permissionId))
}

export function canAccessView(user, viewId) {
  if (!user) return false
  if (viewId === 'users' || viewId === 'security_alerts') return isAdminRole(user.role)

  const requiredPermission = VIEW_PERMISSION_MAP[viewId]
  if (!requiredPermission) return false
  return viewRequiresAnyPermission(user, requiredPermission)
}

export function canSeeNavItem(user, item) {
  if (!user || !item) return false
  const allowed = new Set((item.roles || []).map((role) => String(role).toLowerCase()))
  const role = String(user.role || '').trim().toLowerCase()
  const roleAllowed =
    allowed.has(role) ||
    (!isAdminRole(role) && allowed.has('staff'))
  if (!roleAllowed) return false
  if (item.adminOnly) return isAdminRole(user.role)
  return canAccessView(user, item.id)
}

export function getAccessibleViews(user) {
  return Object.keys(VIEW_PERMISSION_MAP).filter((viewId) => canAccessView(user, viewId))
}

export function getDefaultViewForUser(user) {
  if (canAccessView(user, 'dashboard')) return 'dashboard'
  const accessible = getAccessibleViews(user)
  return accessible[0] || 'dashboard'
}

export function getPermissionLabel(permissionId) {
  return PERMISSION_OPTIONS.find((option) => option.id === permissionId)?.label || permissionId
}
