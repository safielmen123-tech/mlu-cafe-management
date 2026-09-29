const express = require('express')
const db = require('../../db')
const { normalizePermissions } = require('../constants/permissions')
const { createPasswordResetLimiter } = require('../middleware/rateLimit')
const { JWT_SECRET, authenticateToken } = require('../middleware/auth')
const { getClientIp } = require('../utils/clientIp')
const { resolveRequestFingerprint } = require('../utils/deviceFingerprint')
const {
  normalizeLoginInput,
  resolveStoredPasswordHash,
  verifyPassword,
  equalizeFailedLoginTiming,
  assertJwtSecret,
} = require('../utils/loginAuth')
const {
  processLoginAttempt,
  applyLoginResult,
  createMysqlSecurityStore,
} = require('../utils/loginSecurity')
const {
  isDatabaseConnectionError,
  getDatabaseErrorMessage,
} = require('../utils/dbErrors')
const { writeAuditLog } = require('../utils/auditLog')
const { logError, logSecurity } = require('../utils/logger')
const { sendSecurityAlertEmail } = require('../utils/mailer')
const { hashPassword, updateUserPasswordHash } = require('../utils/userAccounts')
const { passwordPolicyError } = require('../utils/accountPolicy')
const {
  ensureSessionSecuritySchema,
  signSessionToken,
  revokePresentedToken,
  invalidateUserTokens,
} = require('../utils/sessionSecurity')

const publicAuthRouter = express.Router()
const privateAuthRouter = express.Router()
const loginSecurityStore = createMysqlSecurityStore(db)

async function findLoginUser(username) {
  const [rows] = await db.execute(
    `SELECT id, display_name, username, role, permissions, password_hash,
            must_change_password, is_active
     FROM users WHERE BINARY username = ? LIMIT 1`,
    [username],
  )
  return rows[0] ?? null
}

function rejectPublicSignup(req, res) {
  logSecurity('public_signup_blocked', {
    ip: req.ip,
    path: req.originalUrl,
  })
  return res.status(403).json({
    message: 'Public registration is disabled. Ask an administrator to create your account in User Management.',
  })
}

async function handleLogin(req, res) {
  const { normalizedUsername, plainPassword } = normalizeLoginInput(
    req.body?.username,
    req.body?.password,
  )

  if (!normalizedUsername || !plainPassword) {
    return res.status(400).json({ message: 'Please provide both username and password' })
  }

  try {
    await ensureSessionSecuritySchema(db)
    const outcome = await processLoginAttempt({
      username: normalizedUsername,
      password: plainPassword,
      ip: req.clientIp || getClientIp(req),
      fingerprint: req.deviceFingerprint || resolveRequestFingerprint(req),
      userAgent: req.get('user-agent') || '',
      acceptLanguage: req.get('accept-language') || '',
      store: loginSecurityStore,
      findUser: findLoginUser,
      verifyPassword: async (plain, storedHash) => {
        const hash = resolveStoredPasswordHash({ password_hash: storedHash })
        if (!hash) return false
        return verifyPassword(plain, hash)
      },
      equalizeFailedLoginTiming,
      onSecurityAlert: (alert) => sendSecurityAlertEmail(alert),
    })

    if (!outcome.ok) {
      return applyLoginResult(res, outcome)
    }

    const user = outcome.user
    if (Number(user.is_active) === 0) {
      return res.status(401).json({ message: 'Username or password is incorrect.' })
    }

    const userPermissions = normalizePermissions(user.permissions)
    assertJwtSecret(JWT_SECRET)
    const token = signSessionToken(user)

    await writeAuditLog(db, {
      userId: user.id,
      userRole: user.role,
      username: user.username,
      action: 'login',
      module: 'Auth',
      description: `User ${user.username} signed in`,
    })

    logSecurity('login_success', { ip: req.ip, username: user.username, userId: user.id })

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        display_name: user.display_name,
        username: user.username,
        role: user.role,
        permissions: userPermissions,
        must_change_password: Number(user.must_change_password) === 1,
      },
    })
  } catch (error) {
    logError(error, { route: 'POST /api/auth/login' })

    if (isDatabaseConnectionError(error)) {
      return res.status(503).json({ message: getDatabaseErrorMessage(error) })
    }

    if (error.message === 'JWT_SECRET is not configured') {
      return res.status(500).json({ message: 'Server authentication is misconfigured' })
    }

    res.status(500).json({ message: 'Internal server error occurred during login' })
  }
}

async function handleForgotPassword(req, res) {
  logSecurity('password_reset_public_blocked', {
    ip: req.ip,
    path: req.originalUrl,
  })
  return res.status(403).json({
    message: 'Password reset is only available to an administrator in User Management.',
  })
}

async function handleChangePassword(req, res) {
  const password = String(req.body?.password ?? '')
  const confirmPassword = String(req.body?.confirmPassword ?? '')
  const policyError = passwordPolicyError(password)

  if (policyError) {
    return res.status(400).json({ message: policyError })
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' })
  }

  try {
    const passwordHash = await hashPassword(password)
    await updateUserPasswordHash(db, req.user.id, passwordHash)
    await db.execute('UPDATE users SET must_change_password = 0 WHERE id = ?', [req.user.id])
    await invalidateUserTokens(db, req.user.id)

    const token = signSessionToken(req.user)

    await writeAuditLog(db, {
      userId: req.user.id,
      userRole: req.user.role,
      username: req.user.username,
      action: 'password_changed',
      module: 'Auth',
      description: `User ${req.user.username} changed their password`,
    })

    return res.status(200).json({
      message: 'Password updated',
      token,
      user: {
        id: req.user.id,
        display_name: req.user.display_name,
        username: req.user.username,
        role: req.user.role,
        permissions: req.user.permissions,
        must_change_password: false,
      },
    })
  } catch (error) {
    logError(error, { route: 'POST /api/auth/change-password' })
    if (isDatabaseConnectionError(error)) {
      return res.status(503).json({ message: getDatabaseErrorMessage(error) })
    }
    return res.status(500).json({ message: 'Something went wrong' })
  }
}

publicAuthRouter.post('/login', handleLogin)
publicAuthRouter.post('/forgot-password', createPasswordResetLimiter(), handleForgotPassword)
publicAuthRouter.post('/register', rejectPublicSignup)
publicAuthRouter.post('/signup', rejectPublicSignup)
publicAuthRouter.get('/register', rejectPublicSignup)
publicAuthRouter.get('/signup', rejectPublicSignup)

privateAuthRouter.get('/me', authenticateToken, async (req, res) => {
  res.status(200).json({ user: req.user })
})

privateAuthRouter.post('/change-password', createPasswordResetLimiter(), authenticateToken, handleChangePassword)

privateAuthRouter.post('/logout', authenticateToken, async (req, res) => {
  try {
    await revokePresentedToken(db, req.tokenClaims, req.user?.id)
  } catch (error) {
    logError(error, { route: 'POST /api/auth/logout' })
  }

  await writeAuditLog(db, {
    userId: req.user?.id ?? null,
    userRole: req.user?.role ?? null,
    username: req.user?.username || req.user?.id,
    action: 'logout',
    module: 'Auth',
    description: `User ${req.user?.username || req.user?.id} signed out`,
  })
  res.status(200).json({ message: 'Logged out' })
})

module.exports = {
  publicAuthRouter,
  privateAuthRouter,
  rejectPublicSignup,
}
