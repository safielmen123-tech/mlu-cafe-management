/**
 * Wipes all users and inserts one fresh Admin account.
 * Run: node scripts/seed-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const bcrypt = require('bcrypt')
const db = require('../db')

const ADMIN = {
  display_name: 'System Administrator',
  username: 'admin',
  email: process.env.ADMIN_EMAIL || 'antagonistslayer9000@gmail.com',
  password: 'RomduolAdmin2026!',
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

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN.password, 10)
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
    'SELECT id, username, email, display_name, role, permissions FROM users WHERE username = ?',
    [ADMIN.username],
  )

  console.log('Users table reset successfully.')
  console.log('Fresh admin account created:')
  console.log(JSON.stringify(rows[0], null, 2))
  console.log('')
  console.log('Login credentials:')
  console.log(`  Username: ${ADMIN.username}`)
  console.log(`  Email:    ${ADMIN.email}`)
  console.log(`  Password: ${ADMIN.password}`)
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message)
    process.exit(1)
  })
