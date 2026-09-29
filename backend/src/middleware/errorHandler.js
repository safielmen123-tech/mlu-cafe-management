const { logError } = require('../utils/logger')
const { isDatabaseConnectionError, getDatabaseErrorMessage } = require('../utils/dbErrors')

const GENERIC_MESSAGE = 'An unexpected error occurred'

/**
 * Marks an error as safe to show the client (validation, not-found, conflicts).
 * Anything thrown without this is treated as internal and never echoed back.
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.expose = true
  }
}

/** Wraps an async route so a rejected promise reaches the error handler instead of hanging. */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Not found' })
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  const errorId = logError(err, {
    route: `${req.method} ${req.originalUrl}`,
    userId: req.user?.id ?? null,
    ip: req.ip,
  })

  // A dead database is an operational state the UI explains to the user, not a leak.
  if (isDatabaseConnectionError(err)) {
    return res.status(503).json({ message: getDatabaseErrorMessage(err) })
  }

  const isJsonParseError =
    err?.type === 'entity.parse.failed' ||
    (err instanceof SyntaxError && Number(err.status) === 400 && Object.prototype.hasOwnProperty.call(err, 'body'))

  if (isJsonParseError) {
    return res.status(400).json({ message: 'Invalid request', errorId })
  }

  const status = Number.isInteger(err?.status) ? err.status : 500

  // Only deliberately-marked client errors keep their message. Everything else,
  // especially raw MySQL errors, collapses to a generic response.
  const safeToExpose = err?.expose === true && status >= 400 && status < 500
  const message = safeToExpose ? err.message : GENERIC_MESSAGE

  res.status(status).json({ message, errorId })
}

module.exports = {
  ApiError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  GENERIC_MESSAGE,
}
