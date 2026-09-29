const crypto = require('crypto')

function resolveRequestFingerprint(req) {
  const header = String(req.get?.('x-device-id') || req.headers?.['x-device-id'] || '')
    .trim()
    .toLowerCase()

  if (/^[a-f0-9]{64}$/.test(header)) return header

  const userAgent = String(req.get?.('user-agent') || req.headers?.['user-agent'] || '')
  const language = String(req.get?.('accept-language') || req.headers?.['accept-language'] || '')
  return crypto.createHash('sha256').update(`${userAgent}|${language}|${header}`).digest('hex')
}

function parseUserAgent(userAgent) {
  const raw = String(userAgent || '').slice(0, 512)
  let browser = 'Unknown'
  if (/Edg\//.test(raw)) browser = 'Edge'
  else if (/OPR\//.test(raw) || /Opera/.test(raw)) browser = 'Opera'
  else if (/Chrome\//.test(raw)) browser = 'Chrome'
  else if (/Firefox\//.test(raw)) browser = 'Firefox'
  else if (/Safari\//.test(raw)) browser = 'Safari'

  let osName = 'Unknown'
  if (/Windows/.test(raw)) osName = 'Windows'
  else if (/Android/.test(raw)) osName = 'Android'
  else if (/iPhone|iPad|iPod/.test(raw)) osName = 'iOS'
  else if (/Mac OS X/.test(raw)) osName = 'macOS'
  else if (/Linux/.test(raw)) osName = 'Linux'

  let deviceType = 'Desktop'
  if (/iPad|Tablet/i.test(raw)) deviceType = 'Tablet'
  else if (/Mobi|Android|iPhone/i.test(raw)) deviceType = 'Mobile'

  return { browser, osName, deviceType, userAgent: raw }
}

module.exports = {
  resolveRequestFingerprint,
  parseUserAgent,
}
