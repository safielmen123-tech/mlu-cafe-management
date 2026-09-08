/** Pure helpers for shaping the alert feed against the user's notification settings. */

export function filterAlertsBySettings(alerts, settings) {
  const list = Array.isArray(alerts) ? alerts : []
  const lowStock = settings?.lowStockAlertsEnabled !== false

  return list.filter((alert) => {
    if (alert.category === 'password_reset' || alert.category === 'reservation') return true
    if (!lowStock && alert.category === 'stock') return false
    return true
  })
}

export function countAlerts(alerts) {
  const counts = {
    total: alerts.length,
    critical: 0,
    warning: 0,
    info: 0,
    stock: 0,
    reservation: 0,
  }
  for (const alert of alerts) {
    if (alert.severity === 'critical') counts.critical += 1
    else if (alert.severity === 'warning') counts.warning += 1
    else if (alert.severity === 'info') counts.info += 1
    if (alert.category === 'stock') counts.stock += 1
    if (alert.category === 'reservation') counts.reservation += 1
  }
  return counts
}
