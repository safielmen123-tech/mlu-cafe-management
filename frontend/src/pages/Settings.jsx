import { Bell, Clock, Droplets, Palette, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '../components/ui/ThemeToggle'
import SettingToggle from '../components/ui/SettingToggle'
import AuditLogPanel from '../components/security/AuditLogPanel'
import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { isAdminRole } from '../utils/permissions'
import { getSeasonForDate } from '../config/siteData'
import { apiFetch } from '../services/apiClient'

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-600 ring-1 ring-forest-100 dark:bg-forest-950/40 dark:text-forest-300 dark:ring-forest-800">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-heading font-semibold">{label}</p>
          {description ? <p className="text-muted mt-1 text-sm">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const { user } = useAuth()
  const {
    isLiquidGlass,
    lowStockAlertsEnabled,
    setIsLiquidGlass,
    setLowStockAlertsEnabled,
  } = useSettings()

  const isAdmin = isAdminRole(user?.role)
  const currentSeason = getSeasonForDate(new Date())
  const [sessionHours, setSessionHours] = useState(2)
  const [savingSession, setSavingSession] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/settings')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        const hours = Number.parseInt(data.sessionHours, 10)
        if (!cancelled && hours === 2) {
          setSessionHours(hours)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handleSessionHoursChange = async (hours) => {
    if (!isAdmin || hours === sessionHours || savingSession) return
    setSavingSession(true)
    try {
      const res = await apiFetch('/settings/session-hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message)
      const next = Number.parseInt(data.sessionHours, 10)
      setSessionHours(next === 2 ? 2 : sessionHours)
    } catch (error) {
      console.error('Failed to update session hours:', error)
    } finally {
      setSavingSession(false)
    }
  }

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h3 className="page-title">{t('nav.settings')}</h3>
      </div>

      <div className="space-y-4">
        <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
          {t('settings.storeHours')}
        </h4>
        <SettingRow
          icon={Clock}
          label={t('settings.operatingHours')}
          description={t('settings.operatingHoursDescription', {
            season:
              currentSeason.id === 'high' ? t('settings.highSeason') : t('settings.lowSeason'),
            hours: currentSeason.hoursLabel,
            offDay: t('settings.monday'),
          })}
        >
          <span className="text-muted max-w-xs text-right text-sm font-medium">
            {currentSeason.id === 'high' ? t('settings.highSeason') : t('settings.lowSeason')}
          </span>
        </SettingRow>
      </div>

      <div className="space-y-4">
        <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
          {t('settings.appearance', { defaultValue: 'Appearance' })}
        </h4>

        <SettingRow
          icon={Palette}
          label={t('settings.colorTheme', { defaultValue: 'Color Theme' })}
          description={t('settings.colorThemeDesc', {
            defaultValue: 'Switch between light and dark mode across the entire management dashboard.',
          })}
        >
          <div className="flex items-center gap-3">
            <span className="text-muted text-sm">
              {isDark
                ? t('settings.dark', { defaultValue: 'Dark' })
                : t('settings.light', { defaultValue: 'Light' })}
            </span>
            <ThemeToggle variant="switch" />
          </div>
        </SettingRow>

        <SettingRow
          icon={Droplets}
          label={t('settings.liquidGlass', { defaultValue: 'Liquid Glass' })}
          description={t('settings.liquidGlassDesc', {
            defaultValue:
              'Frosted translucent panels with soft blur and subtle depth across the dashboard. Works with light and dark theme.',
          })}
        >
          <div className="flex items-center gap-3">
            <span className="text-muted text-sm">
              {isLiquidGlass
                ? t('settings.active', { defaultValue: 'Active' })
                : t('settings.inactive', { defaultValue: 'Inactive' })}
            </span>
            <SettingToggle
              enabled={isLiquidGlass}
              onChange={setIsLiquidGlass}
              ariaLabel={t('a11y.toggleLiquidGlass')}
            />
          </div>
        </SettingRow>
      </div>

      <div className="space-y-4">
        <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
          {t('settings.notifications', { defaultValue: 'Notifications' })}
        </h4>

        <SettingRow
          icon={Bell}
          label={t('settings.lowStockAlerts', { defaultValue: 'Low Stock Alerts' })}
          description={t('settings.lowStockAlertsDesc', {
            defaultValue: 'Receive alerts when inventory items fall below safe thresholds.',
          })}
        >
          <div className="flex items-center gap-3">
            <span className="text-muted text-sm">
              {lowStockAlertsEnabled
                ? t('settings.enabled', { defaultValue: 'Enabled' })
                : t('settings.disabled', { defaultValue: 'Disabled' })}
            </span>
            <SettingToggle
              enabled={lowStockAlertsEnabled}
              onChange={setLowStockAlertsEnabled}
              ariaLabel={t('a11y.toggleLowStockAlerts')}
            />
          </div>
        </SettingRow>
      </div>

      <div className="space-y-4">
        <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
          {t('settings.security', { defaultValue: 'Security' })}
        </h4>

        <SettingRow
          icon={Shield}
          label={t('settings.sessionEndsAfter', { hours: sessionHours })}
        >
          {isAdmin ? (
            <div className="flex gap-2">
              {[2].map((hours) => {
                const selected = sessionHours === hours
                return (
                  <button
                    key={hours}
                    type="button"
                    disabled={savingSession}
                    onClick={() => handleSessionHoursChange(hours)}
                    className={
                      selected
                        ? 'rounded-full bg-forest-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-70'
                        : 'rounded-full bg-cocoa-50 px-4 py-1.5 text-sm text-cocoa-800 hover:bg-cocoa-100 disabled:opacity-70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }
                  >
                    {t('settings.sessionHoursOption', { hours })}
                  </button>
                )
              })}
            </div>
          ) : null}
        </SettingRow>
      </div>

      {isAdmin && (
        <div className="space-y-4">
          <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
            {t('settings.auditSection', { defaultValue: 'Security History' })}
          </h4>
          <div className="surface-card p-5">
            <AuditLogPanel />
          </div>
        </div>
      )}
    </div>
  )
}
