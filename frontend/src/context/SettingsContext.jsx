import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mlu_kitchen_cafe-app-settings'

const DEFAULT_SETTINGS = {
  isLiquidGlass: false,
  lowStockAlertsEnabled: true,
}

function applyLiquidGlassToDocument(enabled) {
  if (typeof document === 'undefined') return
  if (enabled) {
    document.documentElement.setAttribute('data-liquid-glass', 'on')
  } else {
    document.documentElement.removeAttribute('data-liquid-glass')
  }
}

function readStoredSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    // Prefer isLiquidGlass; migrate legacy isDarkCanvas if present
    const isLiquidGlass = Boolean(
      parsed.isLiquidGlass ?? parsed.isDarkCanvas,
    )
    return {
      isLiquidGlass,
      lowStockAlertsEnabled: parsed.lowStockAlertsEnabled !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function persistSettings(settings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

const initialSettings = readStoredSettings()
applyLiquidGlassToDocument(initialSettings.isLiquidGlass)

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(initialSettings)

  const { isLiquidGlass, lowStockAlertsEnabled } = settings

  useEffect(() => {
    persistSettings(settings)
    applyLiquidGlassToDocument(settings.isLiquidGlass)
  }, [settings])

  const setIsLiquidGlass = useCallback((value) => {
    setSettings((prev) => ({ ...prev, isLiquidGlass: Boolean(value) }))
  }, [])

  const setLowStockAlertsEnabled = useCallback((value) => {
    setSettings((prev) => ({ ...prev, lowStockAlertsEnabled: Boolean(value) }))
  }, [])

  const value = useMemo(
    () => ({
      isLiquidGlass,
      lowStockAlertsEnabled,
      setIsLiquidGlass,
      setLowStockAlertsEnabled,
    }),
    [isLiquidGlass, lowStockAlertsEnabled, setIsLiquidGlass, setLowStockAlertsEnabled],
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
