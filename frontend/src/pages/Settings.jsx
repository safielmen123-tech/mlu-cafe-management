import { Bell, Clock, Moon, Palette, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '../components/ui/ThemeToggle'
import SettingToggle from '../components/ui/SettingToggle'
import AuditLogPanel from '../components/security/AuditLogPanel'
import OperatingHoursNotice from '../components/common/OperatingHoursNotice'
import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { isAdminRole } from '../utils/permissions'
import { getSeasonForDate, STORE_SCHEDULE } from '../config/siteData'

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-600 ring-1 ring-forest-100 dark:bg-forest-950/40 dark:text-forest-300 dark:ring-forest-800">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-heading font-semibold">{label}</p>
          <p className="text-muted mt-1 text-sm">{description}</p>
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
    isDarkCanvas,
    lowStockAlertsEnabled,
    setIsDarkCanvas,
    setLowStockAlertsEnabled,
  } = useSettings()

  const isAdmin = isAdminRole(user?.role)
  const currentSeason = getSeasonForDate(new Date())

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h3 className="page-title">{t('nav.settings')}</h3>
        <p className="page-subtitle">
          {t('settings.subtitle', {
            defaultValue: 'Manage appearance, notifications, and system preferences',
          })}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
          Store hours
        </h4>
        <SettingRow
          icon={Clock}
          label="Operating hours"
          description={`${currentSeason.label} today (${currentSeason.hoursLabel}). Weekly off day: ${STORE_SCHEDULE.weeklyOffDay.label}.`}
        >
          <span className="text-muted max-w-xs text-right text-sm font-medium">
            {currentSeason.label}
          </span>
        </SettingRow>
        <OperatingHoursNotice />
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
            <ThemeToggle />
          </div>
        </SettingRow>

        <SettingRow
          icon={Moon}
          label={t('settings.darkCanvas', { defaultValue: 'Dark Canvas' })}
          description={t('settings.darkCanvasDesc', {
            defaultValue:
              'Dashboard uses deep backgrounds and glass-effect cards in dark mode for high contrast readability.',
          })}
        >
          <div className="flex items-center gap-3">
            <span className="text-muted text-sm">
              {isDarkCanvas
                ? t('settings.active', { defaultValue: 'Active' })
                : t('settings.inactive', { defaultValue: 'Inactive' })}
            </span>
            <SettingToggle
              enabled={isDarkCanvas}
              onChange={setIsDarkCanvas}
              ariaLabel="Toggle dark canvas high-contrast theme"
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
              ariaLabel="Toggle low stock alerts"
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
          label={t('settings.session', { defaultValue: 'Session Management' })}
          description={t('settings.sessionDesc', {
            defaultValue: 'Your session expires 8 hours after sign-in for security.',
          })}
        >
          <span className="text-muted text-sm font-medium">
            {t('settings.standard', { defaultValue: 'Standard' })}
          </span>
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
