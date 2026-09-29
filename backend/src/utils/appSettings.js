const MAX_SESSION_HOURS = 2
const ALLOWED_SESSION_HOURS = [MAX_SESSION_HOURS]
const SESSION_HOURS_KEY = 'session_hours'
const DEFAULT_SESSION_HOURS = MAX_SESSION_HOURS

let schemaReadyPromise = null

function normalizeSessionHours(value) {
  const hours = Number.parseInt(value, 10)
  return ALLOWED_SESSION_HOURS.includes(hours) ? hours : DEFAULT_SESSION_HOURS
}

async function ensureAppSettingsSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_settings (
          setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
          setting_value VARCHAR(255) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }
  return schemaReadyPromise
}

async function getSessionHours(db) {
  await ensureAppSettingsSchema(db)
  const [rows] = await db.execute(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [SESSION_HOURS_KEY],
  )
  if (!rows.length) return DEFAULT_SESSION_HOURS
  return normalizeSessionHours(rows[0].setting_value)
}

async function setSessionHours(db, value) {
  await ensureAppSettingsSchema(db)
  const hours = normalizeSessionHours(value)
  await db.execute(
    `
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `,
    [SESSION_HOURS_KEY, String(hours)],
  )
  return hours
}

function sessionExpiresIn() {
  return `${MAX_SESSION_HOURS}h`
}

module.exports = {
  MAX_SESSION_HOURS,
  ALLOWED_SESSION_HOURS,
  DEFAULT_SESSION_HOURS,
  ensureAppSettingsSchema,
  getSessionHours,
  setSessionHours,
  sessionExpiresIn,
  normalizeSessionHours,
}
