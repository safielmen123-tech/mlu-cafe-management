const jwt = require('jsonwebtoken')
const db = require('../../db')
const { env } = require('../config/env')
const { normalizePermissions, isAdminRole, userHasPermission } = require('../constants/permissions')

const JWT_SECRET = env.jwtSecret

async function loadUserById(userId) {
  const [rows] = await db.execute(
    'SELECT id, display_name, username, role, permissions FROM users WHERE id = ? LIMIT 1',
    [userId],
  )

  if (!rows.length) return null

  const row = rows[0]
  return {
    id: row.id,
    display_name: row.display_name,
    username: row.username,
    role: row.role,
    permissions: normalizePermissions(row.permissions),
  }
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

async function authenticateToken(req, res, next) {
  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    // Pinning the algorithm blocks "alg" confusion attacks against a tampered token.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    const user = await loadUserById(decoded.id)
    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists' })
    }

    req.user = user
    req.auth = { id: user.id, username: user.username, role: user.role }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session token' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({ message: 'Administrator access required' })
  }
  return next()
}

function requirePermission(permissionId) {
  return (req, res, next) => {
    if (!userHasPermission(req.user, permissionId)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' })
    }
    return next()
  }
}

function requireAnyPermission(...permissionIds) {
  return (req, res, next) => {
    const allowed = permissionIds.some((permissionId) => userHasPermission(req.user, permissionId))
    if (!allowed) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' })
    }
    return next()
  }
}

module.exports = {
  JWT_SECRET,
  loadUserById,
  authenticateToken,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
}
