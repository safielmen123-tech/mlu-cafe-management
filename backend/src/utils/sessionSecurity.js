const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { env } = require('../config/env')
const { buildTokenPayload, assertJwtSecret } = require('./loginAuth')

const MAX_TOKEN_EXPIRES_IN = '2h'
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

let schemaReady = null

async function columnExists(db, column) {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
    [column],
  )
  return columns.length > 0
}

async function ensureSessionSecuritySchema(db) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS revoked_tokens (
          jti VARCHAR(64) NOT NULL PRIMARY KEY,
          user_id INT NOT NULL,
          expires_at DATETIME NOT NULL,
          revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_revoked_tokens_expires (expires_at),
          KEY idx_revoked_tokens_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)

      if (!(await columnExists(db, 'must_change_password'))) {
        await db.execute(
          'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0',
        )
      }
      if (!(await columnExists(db, 'is_active'))) {
        await db.execute(
          'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
        )
      }
      if (!(await columnExists(db, 'tokens_valid_after'))) {
        await db.execute('ALTER TABLE users ADD COLUMN tokens_valid_after INT UNSIGNED NULL')
      } else {
        const [types] = await db.execute(
          `SELECT DATA_TYPE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tokens_valid_after'`,
        )
        if (String(types[0]?.DATA_TYPE || '').toLowerCase() !== 'int') {
          await db.execute('UPDATE users SET tokens_valid_after = NULL')
          await db.execute('ALTER TABLE users MODIFY COLUMN tokens_valid_after INT UNSIGNED NULL')
        }
      }

      await db.execute(`
        UPDATE admin_notifications
        SET meta = JSON_REMOVE(meta, '$.temporaryPassword', '$.password', '$.temporary_password')
        WHERE JSON_VALID(meta)
          AND (
            JSON_EXTRACT(meta, '$.temporaryPassword') IS NOT NULL
            OR JSON_EXTRACT(meta, '$.password') IS NOT NULL
            OR JSON_EXTRACT(meta, '$.temporary_password') IS NOT NULL
          )
      `).catch(() => {
        // The notifications table is created on startup as well. A missing table
        // is filled in by that schema step; the strip runs again on the next boot.
      })
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

function signSessionToken(user) {
  const secret = assertJwtSecret(env.jwtSecret)
  return jwt.sign(
    { ...buildTokenPayload(user), jti: crypto.randomUUID() },
    secret,
    { expiresIn: MAX_TOKEN_EXPIRES_IN, algorithm: 'HS256' },
  )
}

function tokenIssuedBeforeCutoff(iat, validAfter) {
  const cutoff = Number(validAfter)
  if (!Number.isFinite(cutoff) || cutoff <= 0 || iat == null) return false
  return Number(iat) < cutoff
}

async function isJtiRevoked(db, jti) {
  if (!jti) return true
  const [rows] = await db.execute(
    'SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1',
    [String(jti).slice(0, 64)],
  )
  return rows.length > 0
}

async function revokePresentedToken(db, claims, userId) {
  if (!claims?.jti || !userId) return
  const expiresAt = claims.exp
    ? new Date(Number(claims.exp) * 1000)
    : new Date(Date.now() + 2 * 60 * 60 * 1000)
  await db.execute(
    `INSERT INTO revoked_tokens (jti, user_id, expires_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
    [String(claims.jti).slice(0, 64), userId, expiresAt],
  )
}

async function invalidateUserTokens(db, userId) {
  await ensureSessionSecuritySchema(db)
  await db.execute('UPDATE users SET tokens_valid_after = UNIX_TIMESTAMP() WHERE id = ?', [userId])
}

function startRevokedTokenCleanup(db) {
  const run = async () => {
    try {
      await db.execute('DELETE FROM revoked_tokens WHERE expires_at < NOW()')
    } catch (error) {
      console.error('Revoked token cleanup failed:', error.message)
    }
  }

  run()
  const timer = setInterval(run, CLEANUP_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
  return timer
}

module.exports = {
  MAX_TOKEN_EXPIRES_IN,
  ensureSessionSecuritySchema,
  signSessionToken,
  tokenIssuedBeforeCutoff,
  isJtiRevoked,
  revokePresentedToken,
  invalidateUserTokens,
  startRevokedTokenCleanup,
}
