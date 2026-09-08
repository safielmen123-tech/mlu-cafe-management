const fs = require('fs')
const path = require('path')
const { env } = require('../config/env')

const LOG_DIR = path.join(__dirname, '..', '..', 'logs')
const ERROR_LOG = path.join(LOG_DIR, 'error.log')
const SECURITY_LOG = path.join(LOG_DIR, 'security.log')

let logDirReady = false

function ensureLogDir() {
  if (logDirReady) return true
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    logDirReady = true
  } catch (error) {
    console.error('Could not create log directory:', error.message)
  }
  return logDirReady
}

/**
 * Strips values that should never reach a log file, even internally.
 * Keeps the shape so an operator can still see which fields were present.
 */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'temporarypassword',
  'temppassword',
  'token',
  'authorization',
  'jwt',
  'secret',
  'password_hash',
  'smtp_pass',
  'smtppass',
])

function redact(value, depth = 0) {
  if (value == null || depth > 4) return value
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  if (typeof value !== 'object') return value

  const out = {}
  for (const [key, val] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1)
  }
  return out
}

function append(file, entry) {
  const line = `${JSON.stringify(entry)}\n`
  if (!ensureLogDir()) return
  fs.appendFile(file, line, (error) => {
    if (error) console.error('Log write failed:', error.message)
  })
}

/**
 * Records the full error server-side. Callers send the client a generic message;
 * the returned id lets an operator tie that response back to this entry.
 */
function logError(error, context = {}) {
  const errorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const entry = {
    errorId,
    level: 'error',
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    name: error?.name,
    // MySQL driver details are useful internally but must never leave the server.
    code: error?.code,
    sqlState: error?.sqlState,
    sqlMessage: error?.sqlMessage,
    stack: error?.stack,
    ...redact(context),
  }

  append(ERROR_LOG, entry)

  if (env.nodeEnv !== 'production') {
    console.error(`[${errorId}]`, error?.message || error)
  } else {
    console.error(`[${errorId}] ${context.route || 'request'} failed`)
  }

  return errorId
}

function logSecurity(event, details = {}) {
  const entry = {
    level: 'security',
    event,
    timestamp: new Date().toISOString(),
    ...redact(details),
  }
  append(SECURITY_LOG, entry)
  console.warn(`[security] ${event}`, details.username ? `user=${details.username}` : '')
}

module.exports = {
  logError,
  logSecurity,
  LOG_DIR,
  ERROR_LOG,
  SECURITY_LOG,
}
