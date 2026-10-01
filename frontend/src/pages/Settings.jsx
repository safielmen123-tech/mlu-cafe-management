import { Bell, Clock, Palette, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '../components/ui/ThemeToggle'
import SettingToggle from '../components/ui/SettingToggle'
import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { isAdminRole, userHasPermission } from '../utils/permissions'
import { getSeasonForDate } from '../config/siteData'

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
    lowStockAlertsEnabled,
    setLowStockAlertsEnabled,
    loginAlertsEnabled,
    setLoginAlertsEnabled,
  } = useSettings()

  const isAdmin = isAdminRole(user?.role)
  const canManageSettings = isAdmin || userHasPermission(user, 'settings')
  const currentSeason = getSeasonForDate(new Date())

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h3 className="page-title">{t('nav.settings')}</h3>
      </div>

      {canManageSettings ? (
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
      ) : null}

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
      </div>

      {canManageSettings ? (
        <div className="space-y-4">
          <h4 className="text-muted text-xs font-semibold uppercase tracking-wider">
            {t('settings.notifications', { defaultValue: 'Notifications' })}
          </h4>

          <SettingRow
            icon={Bell}
            label={t('settings.lowStockAlerts', { defaultValue: 'Low stock' })}
            description={t('settings.lowStockAlertsDesc', {
              defaultValue: 'Alert when stock is low.',
            })}
          >
            <div className="flex items-center gap-3">
              <span className="text-muted text-sm">
                {lowStockAlertsEnabled
                  ? t('settings.enabled', { defaultValue: 'On' })
                  : t('settings.disabled', { defaultValue: 'Off' })}
              </span>
              <SettingToggle
                enabled={lowStockAlertsEnabled}
                onChange={setLowStockAlertsEnabled}
                ariaLabel={t('a11y.toggleLowStockAlerts')}
              />
            </div>
          </SettingRow>

          {isAdmin ? (
            <SettingRow
              icon={ShieldAlert}
              label={t('settings.loginAlerts', { defaultValue: 'Login alert' })}
              description={t('settings.loginAlertsDesc', {
                defaultValue: 'Alert on login lockouts.',
              })}
            >
              <div className="flex items-center gap-3">
                <span className="text-muted text-sm">
                  {loginAlertsEnabled
                    ? t('settings.enabled', { defaultValue: 'On' })
                    : t('settings.disabled', { defaultValue: 'Off' })}
                </span>
                <SettingToggle
                  enabled={loginAlertsEnabled}
                  onChange={setLoginAlertsEnabled}
                  ariaLabel={t('a11y.toggleLoginAlerts')}
                />
              </div>
            </SettingRow>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
