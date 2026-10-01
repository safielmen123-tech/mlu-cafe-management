const express = require('express')
const db = require('../../db')
const { requireAdmin } = require('../middleware/auth')
const { auditFromRequest } = require('../utils/auditLog')
const { logError } = require('../utils/logger')
const {
  ensureSessionSecuritySchema,
  revokePresentedToken,
} = require('../utils/sessionSecurity')
const {
  listUserSessions,
  getSessionByJti,
} = require('../utils/userSessions')

function createSecuritySessionsRouter() {
  const router = express.Router()
  router.use(requireAdmin)

  router.get('/sessions', async (req, res) => {
    try {
      await ensureSessionSecuritySchema(db)
      const sessions = await listUserSessions(db, { includeRevoked: true })
      res.status(200).json({
        sessions,
        currentJti: req.tokenClaims?.jti || null,
      })
    } catch (error) {
      logError(error, { route: 'GET /api/security/sessions' })
      res.status(500).json({ message: 'Failed to load active sessions' })
    }
  })

  router.post('/sessions/:jti/terminate', async (req, res) => {
    const jti = String(req.params.jti || '').trim()
    if (!jti) {
      return res.status(400).json({ message: 'Session id is required' })
    }

    try {
      await ensureSessionSecuritySchema(db)
      const session = await getSessionByJti(db, jti)
      if (!session) {
        return res.status(404).json({ message: 'Session not found' })
      }
      if (session.revoked_at) {
        return res.status(200).json({ message: 'Session already terminated', jti })
      }

      await revokePresentedToken(
        db,
        { jti: session.jti, exp: null },
        session.user_id,
        req.user.id,
      )

      const [users] = await db.execute(
        'SELECT username, display_name FROM users WHERE id = ? LIMIT 1',
        [session.user_id],
      )
      const targetName = users[0]?.username || `user #${session.user_id}`

      await auditFromRequest(db, req, {
        action: 'session_terminate',
        module: 'Security',
        description: `Terminated session for ${targetName} (device: ${session.device_label || 'Unknown'}, jti: ${jti.slice(0, 8)}…)`,
      })

      res.status(200).json({
        message: 'Session terminated',
        jti,
        isCurrentSession: req.tokenClaims?.jti === jti,
      })
    } catch (error) {
      logError(error, { route: 'POST /api/security/sessions/:jti/terminate' })
      res.status(500).json({ message: 'Failed to terminate session' })
    }
  })

  router.post('/sessions/terminate-user', async (req, res) => {
    const userId = Number.parseInt(req.body?.userId, 10)
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'A valid userId is required' })
    }

    try {
      await ensureSessionSecuritySchema(db)
      const [users] = await db.execute(
        'SELECT id, username, display_name FROM users WHERE id = ? LIMIT 1',
        [userId],
      )
      if (!users.length) {
        return res.status(404).json({ message: 'User not found' })
      }

      const [open] = await db.execute(
        'SELECT jti FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL',
        [userId],
      )
      for (const row of open) {
        await revokePresentedToken(db, { jti: row.jti, exp: null }, userId, req.user.id)
      }
      const count = open.length

      await auditFromRequest(db, req, {
        action: 'session_terminate_all',
        module: 'Security',
        description: `Terminated ${count} session(s) for ${users[0].username}`,
      })

      res.status(200).json({
        message: `Terminated ${count} session(s)`,
        count,
        includesCurrentSession: req.user.id === userId,
      })
    } catch (error) {
      logError(error, { route: 'POST /api/security/sessions/terminate-user' })
      res.status(500).json({ message: 'Failed to terminate user sessions' })
    }
  })

  return router
}

module.exports = {
  createSecuritySessionsRouter,
}
