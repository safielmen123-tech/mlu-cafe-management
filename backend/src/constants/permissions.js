const PERMISSION_ALIASES = {
  inventory: 'inventory_stock',
  reports_analysis: 'reports',
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
]

const CASHIER_DEFAULT_PERMISSIONS = [
  'order',
  'table',
  'payment',
  'reservations',
  'sales_history',
]

const STAFF_DEFAULT_PERMISSIONS = [
  'order',
  'table',
  'reservations',
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

function resolvePermissionKey(permission) {
  const key = String(permission || '').trim().toLowerCase()
  if (!key) return null
  return PERMISSION_ALIASES[key] || key
}

/** Read path: map aliases and keep only allowlisted keys (unknowns dropped). */
function normalizePermissions(rawPermissions) {
  const allowed = new Set(VALID_PERMISSIONS)
  const normalized = new Set()

  for (const permission of parsePermissionsRaw(rawPermissions)) {
    const resolved = resolvePermissionKey(permission)
    if (resolved && allowed.has(resolved)) {
      normalized.add(resolved)
    }
  }

  return [...normalized]
}

/**
 * Write path: reject unknown keys with 400-style error.
 * Returns { ok, list, json, message }.
 */
function assertPermissionsForSave(rawPermissions) {
  const allowed = new Set(VALID_PERMISSIONS)
  const normalized = new Set()
  const unknown = []

  for (const permission of parsePermissionsRaw(rawPermissions)) {
    const raw = String(permission || '').trim()
    if (!raw) continue
    const resolved = resolvePermissionKey(raw)
    if (!resolved || !allowed.has(resolved)) {
      unknown.push(raw)
      continue
    }
    normalized.add(resolved)
  }

  if (unknown.length) {
    return {
      ok: false,
      message: `Unknown permission key(s): ${unknown.join(', ')}.`,
      list: [],
      json: '[]',
    }
  }

  const list = [...normalized]
  return { ok: true, list, json: JSON.stringify(list) }
}

function isAdminRole(role) {
  return String(role || '').toLowerCase() === 'admin'
}

function isCashierRole(role) {
  const value = String(role || '').toLowerCase()
  return value === 'cashier' || value === 'supervisor'
}

function isStaffRole(role) {
  return String(role || '').toLowerCase() === 'staff'
}

function defaultPermissionsForRole(role) {
  if (isAdminRole(role)) return [...VALID_PERMISSIONS]
  if (isCashierRole(role)) return [...CASHIER_DEFAULT_PERMISSIONS]
  if (isStaffRole(role)) return [...STAFF_DEFAULT_PERMISSIONS]
  return []
}

function userHasPermission(user, permissionId) {
  if (!user) return false
  if (isAdminRole(user.role)) return true
  const resolved = resolvePermissionKey(permissionId)
  if (!resolved) return false
  return normalizePermissions(user.permissions).includes(resolved)
}

/** @deprecated Use normalizePermissions — kept as alias for call-site migration. */
function permissionsWithinCeiling(role, rawPermissions) {
  if (isAdminRole(role)) return [...VALID_PERMISSIONS]
  return normalizePermissions(rawPermissions)
}

module.exports = {
  VALID_PERMISSIONS,
  PERMISSION_ALIASES,
  CASHIER_DEFAULT_PERMISSIONS,
  STAFF_DEFAULT_PERMISSIONS,
  parsePermissionsRaw,
  normalizePermissions,
  assertPermissionsForSave,
  defaultPermissionsForRole,
  isAdminRole,
  isCashierRole,
  isStaffRole,
  userHasPermission,
  permissionsWithinCeiling,
}
