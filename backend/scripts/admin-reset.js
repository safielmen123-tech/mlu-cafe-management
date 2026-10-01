/**
 * Emergency Admin password recovery — server console only.
 * Never exposed as an HTTP route. Run from the backend folder:
 *   npm run admin:reset
 *
 * Asks for the new password interactively (hidden). Does not accept argv passwords.
 * Does not print the password. Enforces the normal password policy.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const readline = require('readline')
const bcrypt = require('bcrypt')
const db = require('../db')
const { passwordPolicyError } = require('../src/utils/accountPolicy')
const { invalidateUserTokens, ensureSessionSecuritySchema } = require('../src/utils/sessionSecurity')
const { revokeAllUserSessions, ensureUserSessionsSchema } = require('../src/utils/userSessions')
const { writeAuditLog } = require('../src/utils/auditLog')
const { ensureLoginSecuritySchema } = require('../src/utils/loginSecurity')

const DEFAULT_ADMIN = {
  display_name: 'System Administrator',
  username: 'admin',
  permissions: [
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
  ],
}

function askLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(String(answer || '').trim())
    })
  })
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    stdout.write(question)
    stdin.resume()
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    let value = ''

    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        stdout.write('\n')
        resolve(value)
        return
      }
      if (char === '\u0003') {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        stdout.write('\n')
        reject(new Error('Cancelled'))
        return
      }
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1)
        return
      }
      value += char
    }

    stdin.on('data', onData)
  })
}

async function askPasswords() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    process.stdout.write('New Admin password: (reading from stdin)\n')
    process.stdout.write('Confirm password: (reading from stdin)\n')
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/)
    return { password: lines[0] || '', confirm: lines[1] || '' }
  }
  const password = await askHidden('New Admin password: ')
  const confirm = await askHidden('Confirm password: ')
  return { password, confirm }
}

async function clearAccountLockouts(username) {
  await ensureLoginSecuritySchema(db)
  await db.execute('DELETE FROM login_attempts WHERE username = ?', [username])
  // Device blocks tied to this account's security alerts
  try {
    await db.execute(
      `DELETE bd FROM blocked_devices bd
       INNER JOIN security_alerts sa ON sa.id = bd.alert_id
       WHERE sa.username = ?`,
      [username],
    )
  } catch {
    // Schema may differ slightly on older DBs; ignore if join fails after ensure.
  }
  try {
    const [fps] = await db.execute(
      `SELECT DISTINCT device_fingerprint AS fp
       FROM security_alerts
       WHERE username = ? AND device_fingerprint IS NOT NULL AND device_fingerprint <> ''`,
      [username],
    )
    for (const row of fps) {
      await db.execute('DELETE FROM blocked_devices WHERE device_fingerprint = ?', [row.fp])
    }
  } catch {
    /* optional cleanup */
  }
}

async function findAdmin() {
  const [rows] = await db.execute(
    `SELECT id, username, display_name, role, is_active
     FROM users WHERE LOWER(role) = 'admin'
     ORDER BY id ASC LIMIT 1`,
  )
  return rows[0] || null
}

async function recreateAdmin(password) {
  const hash = await bcrypt.hash(password, 10)
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null
  try {
    await db.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username')
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error
  }

  const [result] = await db.execute(
    `INSERT INTO users (display_name, username, email, password_hash, role, permissions, must_change_password, is_active)
     VALUES (?, ?, ?, ?, 'Admin', ?, 1, 1)`,
    [
      DEFAULT_ADMIN.display_name,
      DEFAULT_ADMIN.username,
      email,
      hash,
      JSON.stringify(DEFAULT_ADMIN.permissions),
    ],
  )
  return {
    id: result.insertId,
    username: DEFAULT_ADMIN.username,
    display_name: DEFAULT_ADMIN.display_name,
    created: true,
  }
}

async function resetAdminPassword(admin, password) {
  const hash = await bcrypt.hash(password, 10)
  await ensureSessionSecuritySchema(db)
  await db.execute(
    `UPDATE users
     SET password_hash = ?, must_change_password = 1, is_active = 1
     WHERE id = ?`,
    [hash, admin.id],
  )
  await invalidateUserTokens(db, admin.id)
  await ensureUserSessionsSchema(db)
  await revokeAllUserSessions(db, admin.id, admin.id)
  await clearAccountLockouts(admin.username)
  return { ...admin, created: false }
}

async function main() {
  console.log('Admin password recovery (server console only).')
  console.log('This is not available in the web app or API.\n')

  let admin = await findAdmin()
  if (!admin) {
    const answer = await askLine('No Admin account found. Recreate one now? [y/N] ')
    if (!/^y(es)?$/i.test(answer)) {
      console.log('Cancelled. No changes made.')
      await db.end()
      process.exit(0)
    }
  } else {
    console.log(`Found Admin: ${admin.username} (id ${admin.id}, ${admin.display_name}).`)
  }

  const { password, confirm } = await askPasswords()
  if (password !== confirm) {
    console.error('Passwords do not match. No changes made.')
    await db.end()
    process.exit(1)
  }
  const policyError = passwordPolicyError(password)
  if (policyError) {
    console.error(policyError)
    await db.end()
    process.exit(1)
  }

  if (!admin) {
    admin = await recreateAdmin(password)
    await clearAccountLockouts(admin.username)
    await invalidateUserTokens(db, admin.id)
  } else {
    admin = await resetAdminPassword(admin, password)
  }

  await writeAuditLog(db, {
    userId: admin.id,
    userRole: 'Admin',
    username: admin.username,
    action: 'admin_console_password_reset',
    module: 'Users',
    description: 'Admin password reset from server console',
  })

  console.log(
    admin.created
      ? `Admin account recreated (username: ${admin.username}). Password was not printed.`
      : `Admin password updated for ${admin.username}. Password was not printed.`,
  )
  console.log('Sessions revoked. Login lockouts and related device blocks cleared. must_change_password is set.')
  await db.end()
}

main().catch(async (error) => {
  console.error(error.message || error)
  try { await db.end() } catch { /* ignore */ }
  process.exit(1)
})
