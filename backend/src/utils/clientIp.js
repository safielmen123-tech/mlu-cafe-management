const { env } = require('../config/env')

function normalizeIp(value) {
  const ip = String(value || '').trim()
  if (!ip) return ''
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}

/**
 * Client address for lockout and blocking.
 * X-Forwarded-For is ignored unless TRUST_PROXY is enabled, because a client
 * can otherwise pick any address and skip an IP lock.
 */
function getClientIp(req, options = {}) {
  const trustProxy = options.trustProxy ?? env.security.trustProxy
  const socketIp = normalizeIp(req.socket?.remoteAddress || req.connection?.remoteAddress)

  if (!trustProxy) {
    return socketIp || 'unknown'
  }

  return normalizeIp(req.ip) || socketIp || 'unknown'
}

module.exports = {
  normalizeIp,
  getClientIp,
}
