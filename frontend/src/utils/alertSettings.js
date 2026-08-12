/** Pure helpers for shaping the alert feed against the user's notification settings. */

export function filterAlertsBySettings(alerts, settings) {
  const list = Array.isArray(alerts) ? alerts : []
  const lowStock = settings?.lowStockAlertsEnabled !== false
  const aiForecast = settings?.aiForecastUpdatesEnabled !== false

  return list.filter((alert) => {
    if (!lowStock && alert.category === 'stock') return false
    if (!aiForecast && (alert.category === 'ai_suggestion' || alert.category === 'margin')) {
      return false
    }
    return true
  })
}

export function countAlerts(alerts) {
  const counts = {
    total: alerts.length,
    critical: 0,
    warning: 0,
    ai_suggestion: 0,
    stock: 0,
    margin: 0,
  }
  for (const alert of alerts) {
    if (alert.severity === 'critical') counts.critical += 1
    else if (alert.severity === 'warning') counts.warning += 1
    else if (alert.severity === 'ai_suggestion') counts.ai_suggestion += 1
    if (alert.category === 'stock') counts.stock += 1
    if (alert.category === 'margin') counts.margin += 1
  }
  return counts
}
