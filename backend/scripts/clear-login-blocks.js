/**
 * Dev-only. Not an API route.
 * Clears login lockouts and unblocks devices in whatever database DB_NAME points at.
 * Does not delete orders, menu items, users, or security-alert history.
 *
 * From the backend folder:
 *   node scripts/clear-login-blocks.js
 */
const db = require('../db')

async function main() {
  const [attempts] = await db.execute('DELETE FROM login_attempts')
  const [blocked] = await db.execute('DELETE FROM blocked_devices')
  console.log(`Cleared login lockouts: ${attempts.affectedRows}`)
  console.log(`Unblocked devices: ${blocked.affectedRows}`)
  await db.end()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
