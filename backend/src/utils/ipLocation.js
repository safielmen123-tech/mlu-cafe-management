const NON_PUBLIC_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|0\.0\.0\.0$|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|localhost$)/i

function isNonPublicIp(ip) {
  return NON_PUBLIC_IP.test(String(ip || '').trim())
}

/**
 * City and country for an alert. Lookup failure, timeout, or a private address
 * is stored as "Unknown" so the lockout response is never blocked on geo data.
 */
async function lookupIpLocation(ip) {
  const value = String(ip || '').trim()
  if (!value || value === 'unknown' || isNonPublicIp(value)) return 'Unknown'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(value)}?fields=status,country,city`,
      { signal: controller.signal },
    )
    if (!response.ok) return 'Unknown'
    const data = await response.json()
    if (data?.status !== 'success') return 'Unknown'
    const label = [data.city, data.country].filter(Boolean).join(', ')
    return label || 'Unknown'
  } catch {
    return 'Unknown'
  } finally {
    clearTimeout(timer)
  }
}

module.exports = {
  lookupIpLocation,
  isNonPublicIp,
}
