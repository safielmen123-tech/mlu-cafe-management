import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'romduol-app-settings'

const DEFAULT_SETTINGS = {
  isDarkCanvas: false,
  lowStockAlertsEnabled: true,
  aiForecastUpdatesEnabled: true,
}

function readStoredSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      isDarkCanvas: Boolean(parsed.isDarkCanvas),
      lowStockAlertsEnabled: parsed.lowStockAlertsEnabled !== false,
      aiForecastUpdatesEnabled: parsed.aiForecastUpdatesEnabled !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function persistSettings(settings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStoredSettings)

  const { isDarkCanvas, lowStockAlertsEnabled, aiForecastUpdatesEnabled } = settings

  useEffect(() => {
    persistSettings(settings)
  }, [settings])

  const setIsDarkCanvas = useCallback((value) => {
    setSettings((prev) => ({ ...prev, isDarkCanvas: Boolean(value) }))
  }, [])

  const setLowStockAlertsEnabled = useCallback((value) => {
    setSettings((prev) => ({ ...prev, lowStockAlertsEnabled: Boolean(value) }))
  }, [])

  const setAiForecastUpdatesEnabled = useCallback((value) => {
    setSettings((prev) => ({ ...prev, aiForecastUpdatesEnabled: Boolean(value) }))
  }, [])

  const value = useMemo(
    () => ({
      isDarkCanvas,
      lowStockAlertsEnabled,
      aiForecastUpdatesEnabled,
      setIsDarkCanvas,
      setLowStockAlertsEnabled,
      setAiForecastUpdatesEnabled,
    }),
    [
      isDarkCanvas,
      lowStockAlertsEnabled,
      aiForecastUpdatesEnabled,
      setIsDarkCanvas,
      setLowStockAlertsEnabled,
      setAiForecastUpdatesEnabled,
    ],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export default SettingsProvider
