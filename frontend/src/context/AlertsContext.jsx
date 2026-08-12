import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../services/apiClient'
import { filterAlertsBySettings, countAlerts } from '../utils/alertSettings'
import { useSettings } from './SettingsContext'

const AlertsContext = createContext(null)
const POLL_INTERVAL_MS = 30_000

export function AlertsProvider({ children }) {
  const { lowStockAlertsEnabled, aiForecastUpdatesEnabled } = useSettings()
  const [alerts, setAlerts] = useState([])
  const [rawCounts, setRawCounts] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    ai_suggestion: 0,
  })
  const [generatedAt, setGeneratedAt] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAlerts = useCallback(async ({ refresh = false } = {}) => {
    try {
      const path = refresh ? '/alerts?refresh=1' : '/alerts'
      const response = await apiFetch(path)
      if (!response.ok) {
        setError(response.status === 401 ? null : 'Alerts temporarily unavailable')
        setAlerts([])
        setRawCounts({ total: 0, critical: 0, warning: 0, ai_suggestion: 0 })
        return null
      }
      const data = await response.json()
      setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
      setRawCounts(data.counts || { total: 0, critical: 0, warning: 0, ai_suggestion: 0 })
      setGeneratedAt(data.generatedAt || null)
      setError(null)
      return data
    } catch (err) {
      setError(err.message || 'Failed to load alerts')
      setAlerts([])
      setRawCounts({ total: 0, critical: 0, warning: 0, ai_suggestion: 0 })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchAlerts({ refresh: true }), [fetchAlerts])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(() => fetchAlerts(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const settingsSnapshot = useMemo(
    () => ({ lowStockAlertsEnabled, aiForecastUpdatesEnabled }),
    [lowStockAlertsEnabled, aiForecastUpdatesEnabled],
  )

  const visibleAlerts = useMemo(
    () => filterAlertsBySettings(alerts, settingsSnapshot),
    [alerts, settingsSnapshot],
  )

  const counts = useMemo(() => countAlerts(visibleAlerts), [visibleAlerts])

  const value = useMemo(
    () => ({
      alerts: visibleAlerts,
      allAlerts: alerts,
      counts,
      rawCounts,
      badgeCount: counts.total ?? visibleAlerts.length,
      generatedAt,
      isLoading,
      error,
      refresh,
      refetch: fetchAlerts,
      lowStockAlertsEnabled,
      aiForecastUpdatesEnabled,
    }),
    [
      visibleAlerts,
      alerts,
      counts,
      rawCounts,
      generatedAt,
      isLoading,
      error,
      refresh,
      fetchAlerts,
      lowStockAlertsEnabled,
      aiForecastUpdatesEnabled,
    ],
  )

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider')
  }
  return context
}

export default AlertsProvider
