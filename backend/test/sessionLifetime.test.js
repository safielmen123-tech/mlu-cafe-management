const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const {
  SESSION_DAYS,
  RENEW_AFTER_MS,
  shouldRenewToken,
  renewSessionToken,
  signSessionToken,
  ensureSessionSecuritySchema,
  revokePresentedToken,
} = require('../src/utils/sessionSecurity')
const {
  ensureUserSessionsSchema,
  createUserSession,
  getSessionByJti,
  listUserSessions,
} = require('../src/utils/userSessions')
const { env } = require('../src/config/env')

test('SESSION_DAYS is 30 and renew window is 24 hours', () => {
  assert.equal(SESSION_DAYS, 30)
  assert.equal(RENEW_AFTER_MS, 24 * 60 * 60 * 1000)
})

test('shouldRenewToken is false for fresh iat and true after 24h', () => {
  const now = Date.now()
  const freshIat = Math.floor(now / 1000)
  const oldIat = Math.floor((now - RENEW_AFTER_MS - 1000) / 1000)
  assert.equal(shouldRenewToken(freshIat, now), false)
  assert.equal(shouldRenewToken(oldIat, now), true)
})

test('renewSessionToken keeps the same jti', () => {
  const jti = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const token = renewSessionToken({ id: 1, username: 'admin', role: 'Admin' }, jti)
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
  assert.equal(decoded.jti, jti)
  assert.equal(decoded.id, 1)
})

test('user session create, list, and terminate flow', async () => {
  const db = require('../db')
  await ensureSessionSecuritySchema(db)
  await ensureUserSessionsSchema(db)

  const [admins] = await db.execute(
    `SELECT id, username, role, display_name FROM users WHERE LOWER(role)='admin' ORDER BY id ASC LIMIT 1`,
  )
  assert.ok(admins.length, 'admin required')
  const admin = admins[0]

  const issued = await signSessionToken(db, admin)
  await createUserSession(db, {
    jti: issued.jti,
    userId: admin.id,
    req: { headers: { 'user-agent': 'Mozilla/5.0 Chrome/120 Windows' }, get: () => 'Mozilla/5.0 Chrome/120 Windows', ip: '127.0.0.1' },
  })

  const row = await getSessionByJti(db, issued.jti)
  assert.ok(row)
  assert.equal(row.revoked_at, null)

  const listed = await listUserSessions(db, { includeRevoked: true })
  assert.ok(listed.some((item) => item.jti === issued.jti && item.status === 'active'))

  await revokePresentedToken(db, { jti: issued.jti, exp: null }, admin.id, admin.id)
  const after = await getSessionByJti(db, issued.jti)
  assert.ok(after.revoked_at)
  await db.end()
})
