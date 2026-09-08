import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, getAuthToken } from '../services/apiClient'
import { filterAlertsBySettings, countAlerts } from '../utils/alertSettings'
import { useSettings } from './SettingsContext'

const AlertsContext = createContext(null)
const POLL_INTERVAL_MS = 30_000

export function AlertsProvider({ children }) {
  const { lowStockAlertsEnabled } = useSettings()
  const [alerts, setAlerts] = useState([])
  const [rawCounts, setRawCounts] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
  })
  const [generatedAt, setGeneratedAt] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAlerts = useCallback(async ({ refresh = false } = {}) => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return null
    }

    try {
      const path = refresh ? '/alerts?refresh=1' : '/alerts'
      const response = await apiFetch(path, { token })
      if (response.status === 401) {
        setError(null)
        setAlerts([])
        setRawCounts({ total: 0, critical: 0, warning: 0, info: 0 })
        return null
      }
      if (!response.ok) {
        setError('Alerts temporarily unavailable')
        setAlerts([])
        setRawCounts({ total: 0, critical: 0, warning: 0, info: 0 })
        return null
      }
      const data = await response.json()
      setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
      setRawCounts(data.counts || { total: 0, critical: 0, warning: 0, info: 0 })
      setGeneratedAt(data.generatedAt || null)
      setError(null)
      return data
    } catch (err) {
      setError(err.message || 'Failed to load alerts')
      setAlerts([])
      setRawCounts({ total: 0, critical: 0, warning: 0, info: 0 })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const markNotificationRead = useCallback(async (alert) => {
    const notificationId = alert?.notificationId
    if (!notificationId) return false
    try {
      const response = await apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' })
      if (!response.ok) return false
      await fetchAlerts({ refresh: true })
      return true
    } catch {
      return false
    }
  }, [fetchAlerts])

  useEffect(() => {
    if (!getAuthToken()) {
      setIsLoading(false)
      return undefined
    }

    fetchAlerts()
    const interval = setInterval(() => {
      if (!getAuthToken()) return
      fetchAlerts()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const settingsSnapshot = useMemo(
    () => ({ lowStockAlertsEnabled }),
    [lowStockAlertsEnabled],
  )

  const visibleAlerts = useMemo(
    () => filterAlertsBySettings(alerts, settingsSnapshot),
    [alerts, settingsSnapshot],
  )

  const counts = useMemo(() => countAlerts(visibleAlerts), [visibleAlerts])

  const refresh = useCallback(() => fetchAlerts({ refresh: true }), [fetchAlerts])

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
      markNotificationRead,
      lowStockAlertsEnabled,
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
      markNotificationRead,
      lowStockAlertsEnabled,
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
