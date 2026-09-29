const jwt = require('jsonwebtoken')
const db = require('../../db')
const { env } = require('../config/env')
const { normalizePermissions, isAdminRole, userHasPermission } = require('../constants/permissions')
const {
  ensureSessionSecuritySchema,
  isJtiRevoked,
  tokenIssuedBeforeCutoff,
} = require('../utils/sessionSecurity')

const JWT_SECRET = env.jwtSecret

async function loadUserById(userId) {
  await ensureSessionSecuritySchema(db)
  const [rows] = await db.execute(
    `SELECT id, display_name, username, role, permissions,
            must_change_password, is_active, tokens_valid_after
     FROM users WHERE id = ? LIMIT 1`,
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
    must_change_password: Number(row.must_change_password) === 1,
    is_active: row.is_active == null ? true : Number(row.is_active) === 1,
    tokens_valid_after: row.tokens_valid_after,
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
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid or expired session token' })
    }

    if (!decoded.jti || (await isJtiRevoked(db, decoded.jti))) {
      return res.status(401).json({ message: 'Invalid or expired session token' })
    }

    if (tokenIssuedBeforeCutoff(decoded.iat, user.tokens_valid_after)) {
      return res.status(401).json({ message: 'Invalid or expired session token' })
    }

    req.user = {
      id: user.id,
      display_name: user.display_name,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      must_change_password: user.must_change_password,
    }
    req.tokenClaims = { jti: decoded.jti, exp: decoded.exp, iat: decoded.iat }
    req.auth = { id: user.id, username: user.username, role: user.role }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session token' })
  }
}

function rejectUntilPasswordChanged(req, res, next) {
  if (!req.user?.must_change_password) return next()
  const path = req.path || ''
  if (path === '/auth/change-password' || path === '/auth/logout' || path === '/auth/me') {
    return next()
  }
  return res.status(403).json({
    message: 'You must change your password before continuing.',
    code: 'PASSWORD_CHANGE_REQUIRED',
  })
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
  rejectUntilPasswordChanged,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
}
