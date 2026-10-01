/**
 * Wipes all users and inserts one Admin account.
 * DESTRUCTIVE — prefer `npm run admin:reset` to recover the existing Admin password
 * without deleting Cashier/Staff accounts.
 *
 * Password comes from SEED_ADMIN_PASSWORD. If that is unset, a random password
 * is written to backend/logs/initial-admin-password.txt and is never printed.
 *
 * Run: node scripts/seed-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const db = require('../db')
const { passwordPolicyError } = require('../src/utils/accountPolicy')

const ADMIN = {
  display_name: 'System Administrator',
  username: 'admin',
  email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null,
  role: 'Admin',
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

function resolveSeedPassword() {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD
  if (fromEnv) {
    const policyError = passwordPolicyError(fromEnv)
    if (policyError) {
      console.error(`SEED_ADMIN_PASSWORD is not acceptable. ${policyError}`)
      process.exit(1)
    }
    return { password: fromEnv, generated: false }
  }

  const password = `${crypto.randomBytes(18).toString('base64url')}A7`
  const file = path.join(__dirname, '..', 'logs', 'initial-admin-password.txt')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${password}\n`, { mode: 0o600 })
  console.log(
    'SEED_ADMIN_PASSWORD was not set. A random admin password was written to backend/logs/initial-admin-password.txt. Delete that file after you store the password. It was not printed here.',
  )
  return { password, generated: true }
}

async function seedAdmin() {
  const { password } = resolveSeedPassword()
  const passwordHash = await bcrypt.hash(password, 10)
  const permissionsJson = JSON.stringify(ADMIN.permissions)

  try {
    await db.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username')
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error
  }

  await db.execute('DELETE FROM users')

  await db.execute(
    `INSERT INTO users (display_name, username, email, password_hash, role, permissions)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ADMIN.display_name, ADMIN.username, ADMIN.email, passwordHash, ADMIN.role, permissionsJson],
  )

  const [rows] = await db.execute(
    'SELECT id, username, display_name, role FROM users WHERE username = ?',
    [ADMIN.username],
  )

  console.log('Users table reset successfully.')
  console.log('Fresh admin account created:')
  console.log(JSON.stringify(rows[0], null, 2))
  console.log(`Username: ${ADMIN.username}`)
  console.log('Password was not printed.')
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message)
    process.exit(1)
  })
