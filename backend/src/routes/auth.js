const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../../db')
const { env } = require('../config/env')
const { normalizePermissions } = require('../constants/permissions')
const { loginLimiter } = require('../middleware/rateLimit')
const { JWT_SECRET, authenticateToken } = require('../middleware/auth')
const {
  normalizeLoginInput,
  resolveStoredPasswordHash,
  verifyPassword,
  equalizeFailedLoginTiming,
  buildTokenPayload,
  assertJwtSecret,
} = require('../utils/loginAuth')
const {
  isDatabaseConnectionError,
  getDatabaseErrorMessage,
} = require('../utils/dbErrors')
const { writeAuditLog } = require('../utils/auditLog')
const { logError, logSecurity } = require('../utils/logger')
const { sendAdminPasswordResetEmail } = require('../utils/mailer')
const {
  isAdminAccount,
  generateTemporaryPassword,
  hashPassword,
  findUserForRecovery,
  listAdminUsers,
  updateUserPasswordHash,
} = require('../utils/userAccounts')
const { createAdminNotification } = require('../utils/adminNotifications')

const GENERIC_RESET_MESSAGE =
  'If an account exists for that username, a reset request has been sent. An administrator will follow up shortly.'

const publicAuthRouter = express.Router()
const privateAuthRouter = express.Router()

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

  const INVALID_CREDENTIALS = 'Invalid username or password'

  if (!normalizedUsername || !plainPassword) {
    return res.status(400).json({ message: 'Please provide both username and password' })
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, display_name, username, role, permissions, password_hash
       FROM users WHERE BINARY username = ? LIMIT 1`,
      [normalizedUsername],
    )

    const user = rows[0] ?? null
    const storedHash = user ? resolveStoredPasswordHash(user) : null

    let isPasswordMatch = false
    try {
      if (storedHash) {
        isPasswordMatch = await verifyPassword(plainPassword, storedHash)
      } else {
        await equalizeFailedLoginTiming(plainPassword)
      }
    } catch (compareError) {
      logError(compareError, { route: 'POST /api/auth/login', stage: 'password-compare' })
      return res.status(401).json({ message: INVALID_CREDENTIALS })
    }

    if (!user || !storedHash || !isPasswordMatch) {
      logSecurity('login_failed', {
        ip: req.ip,
        username: normalizedUsername.slice(0, 64),
        reason: !user ? 'unknown_user' : !storedHash ? 'no_password_hash' : 'bad_password',
      })
      return res.status(401).json({ message: INVALID_CREDENTIALS })
    }

    const userPermissions = normalizePermissions(user.permissions)
    const tokenPayload = buildTokenPayload(user)
    const jwtSecret = assertJwtSecret(JWT_SECRET)

    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: env.jwtExpiresIn,
      algorithm: 'HS256',
    })

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

    console.error('Login Server Error:', error)
    res.status(500).json({ message: 'Internal server error occurred during login' })
  }
}

async function handleForgotPassword(req, res) {
  const identifier = String(req.body?.username || req.body?.email || '').trim()

  if (!identifier) {
    return res.status(400).json({ message: 'Please enter your username.' })
  }

  try {
    const user = await findUserForRecovery(db, identifier)

    if (!user) {
      await equalizeFailedLoginTiming(identifier)
      logSecurity('password_reset_unknown_user', {
        ip: req.ip,
        username: identifier.slice(0, 64),
      })
      return res.status(200).json({ message: GENERIC_RESET_MESSAGE })
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)

    if (isAdminAccount(user)) {
      await sendAdminPasswordResetEmail({
        username: user.username,
        temporaryPassword,
      })
      await updateUserPasswordHash(db, user.id, passwordHash)

      await writeAuditLog(db, {
        userId: user.id,
        userRole: user.role,
        username: user.username,
        action: 'admin_password_reset',
        module: 'Auth',
        description: `Administrator password reset emailed to ${env.adminEmail}`,
      })

      logSecurity('admin_password_reset', {
        ip: req.ip,
        username: user.username,
        userId: user.id,
      })
    } else {
      const admins = await listAdminUsers(db)
      const displayName = user.display_name || user.username
      const title = 'Staff password reset requested'
      const message = [
        `${displayName} (${user.username}) requested a password reset.`,
        user.role ? `Role: ${user.role}.` : '',
        user.email ? `Email: ${user.email}.` : '',
        'A temporary password is attached for retrieval.',
      ]
        .filter(Boolean)
        .join(' ')

      if (!admins.length) {
        logSecurity('staff_password_reset_no_admin', {
          ip: req.ip,
          username: user.username,
        })
      }

      await Promise.all(
        admins.map((admin) =>
          createAdminNotification(db, {
            recipientUserId: admin.id,
            type: 'password_reset',
            title,
            message,
            meta: {
              username: user.username,
              displayName,
              role: user.role || 'Staff',
              email: user.email || null,
              requesterUserId: user.id,
              temporaryPassword,
            },
          }),
        ),
      )
      await updateUserPasswordHash(db, user.id, passwordHash)

      await writeAuditLog(db, {
        userId: user.id,
        userRole: user.role,
        username: user.username,
        action: 'staff_password_reset',
        module: 'Auth',
        description: `Staff ${user.username} requested a password reset`,
      })

      logSecurity('staff_password_reset', {
        ip: req.ip,
        username: user.username,
        userId: user.id,
      })
    }

    return res.status(200).json({ message: GENERIC_RESET_MESSAGE })
  } catch (error) {
    logError(error, { route: 'POST /api/auth/forgot-password' })

    if (isDatabaseConnectionError(error)) {
      return res.status(503).json({ message: getDatabaseErrorMessage(error) })
    }

    console.error('Forgot password error:', error)
    return res.status(500).json({
      message: 'Unable to process the reset request right now. Please try again shortly.',
    })
  }
}

publicAuthRouter.post('/login', loginLimiter, handleLogin)
publicAuthRouter.post('/forgot-password', loginLimiter, handleForgotPassword)
publicAuthRouter.post('/register', rejectPublicSignup)
publicAuthRouter.post('/signup', rejectPublicSignup)
publicAuthRouter.get('/register', rejectPublicSignup)
publicAuthRouter.get('/signup', rejectPublicSignup)

privateAuthRouter.get('/me', authenticateToken, async (req, res) => {
  res.status(200).json({ user: req.user })
})

privateAuthRouter.post('/logout', authenticateToken, async (req, res) => {
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
