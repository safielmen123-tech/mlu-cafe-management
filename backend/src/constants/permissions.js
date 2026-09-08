const PERMISSION_ALIASES = {
  inventory: 'inventory_stock',
}

const VALID_PERMISSIONS = [
  'dashboard',
  'order',
  'table',
  'reservations',
  'payment',
  'menu',
  'settings',
  'backup_recovery',
  'sales_history',
  'inventory_stock',
  'reports',
  'reports_analysis',
]

function parsePermissionsRaw(raw) {
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

function normalizePermissions(rawPermissions) {
  const allowed = new Set(VALID_PERMISSIONS)
  const normalized = new Set()

  for (const permission of parsePermissionsRaw(rawPermissions)) {
    const key = String(permission).toLowerCase()
    const resolved = PERMISSION_ALIASES[key] || key
    if (allowed.has(resolved)) {
      normalized.add(resolved)
    }
  }

  return [...normalized]
}

function isAdminRole(role) {
  return String(role || '').toLowerCase() === 'admin'
}

function userHasPermission(user, permissionId) {
  if (!user) return false
  if (isAdminRole(user.role)) return true
  const permissions = normalizePermissions(user.permissions)
  return permissions.includes(permissionId)
}

module.exports = {
  VALID_PERMISSIONS,
  PERMISSION_ALIASES,
  parsePermissionsRaw,
  normalizePermissions,
  isAdminRole,
  userHasPermission,
}
