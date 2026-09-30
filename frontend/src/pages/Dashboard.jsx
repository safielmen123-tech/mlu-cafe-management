import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { useAlerts } from '../context/AlertsContext'
import AlertCenter from '../components/alerts/AlertCenter'
import LiveConditions from '../components/dashboard/LiveConditions'
import MenuItemImage from '../components/menu/MenuItemImage'
import { apiFetch, getAuthToken } from '../services/apiClient'
import {
  buildDashboardStats,
  buildPaymentSplitData,
  buildPopularPicks,
  buildRecentOrders,
  buildWeeklySalesData,
} from '../utils/dashboardAnalytics'
import { translateMenuName, translateMenuSummary } from '../utils/menuNameTranslations'

const API_PATH = '/orders/history?days=30'
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function useChartTheme() {
  const { isDark } = useTheme()

  return useMemo(
    () => ({
      axis: isDark ? '#aeaeb2' : '#86868b',
      grid: isDark ? '#3a3a3c' : '#e5e5e7',
      tooltipBg: isDark ? '#1d1d1f' : '#ffffff',
      tooltipBorder: isDark ? '#3a3a3c' : '#e5e5e7',
      tooltipText: isDark ? '#f5f5f7' : '#1d1d1f',
      primary: isDark ? '#34d399' : '#10b981',
      primarySoft: isDark ? '#064e3b' : '#d1fae5',
      secondary: isDark ? '#c9a882' : '#8b5e34',
      muted: isDark ? '#aeaeb2' : '#86868b',
    }),
    [isDark],
  )
}

function ChartTooltip({ active, payload, label, theme, valuePrefix = '$' }) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.tooltipText,
      }}
    >
      <p className="text-xs font-medium" style={{ color: theme.muted }}>
        {label}
      </p>
      <p className="text-sm font-bold">
        {valuePrefix}
        {Number(payload[0].value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  )
}

function PaymentTooltip({ active, payload, theme }) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.tooltipText,
      }}
    >
      <p className="text-sm font-semibold">{payload[0].name}</p>
      <p className="text-xs" style={{ color: theme.muted }}>
        ${Number(payload[0].value).toFixed(2)}
      </p>
    </div>
  )
}

function paymentMethodLabel(name, t) {
  if (name === 'Bank Scan') return t('payment.methods.bankScan')
  if (name === 'Cash') return t('payment.methods.cash')
  return name
}

export default function Dashboard({ onNavigate }) {
  const { t, i18n } = useTranslation()
  const { user, isAdmin } = useAuth()
  const chartTheme = useChartTheme()
  const { lowStockAlertsEnabled } = useSettings()
  const { alerts, counts, isLoading: alertsLoading, error: alertsError, refresh, markNotificationRead } = useAlerts()
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [liveConditions, setLiveConditions] = useState(null)
  const [todaySpending, setTodaySpending] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [liveLoading, setLiveLoading] = useState(true)

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      setLiveLoading(false)
      return undefined
    }

    Promise.all([
      apiFetch(API_PATH, { token })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => (Array.isArray(data) ? data : []))
        .catch(() => []),
      apiFetch('/expenses/summary', { token })
        .then((res) => (res.ok ? res.json() : { todaySpending: 0 }))
        .then((data) => Number(data.todaySpending) || 0)
        .catch(() => 0),
      apiFetch('/menu', { token })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => (Array.isArray(data) ? data : []))
        .catch(() => []),
      apiFetch('/dashboard/live', { token })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([orderRows, spending, menuRows, live]) => {
        setOrders(orderRows)
        setTodaySpending(spending)
        setMenuItems(menuRows)
        setLiveConditions(live)
      })
      .finally(() => {
        setIsLoading(false)
        setLiveLoading(false)
      })
  }, [])

  const weeklySales = useMemo(() => buildWeeklySalesData(orders), [orders])
  const localizedWeeklySales = useMemo(
    () =>
      weeklySales.map((day) => {
        const weekday = new Date(`${day.key}T12:00:00`).getDay()
        return {
          ...day,
          label: t(`dates.weekdays.${WEEKDAY_KEYS[weekday]}`),
        }
      }),
    [weeklySales, t],
  )
  const paymentSplit = useMemo(() => buildPaymentSplitData(orders), [orders])
  const dashboardStats = useMemo(
    () => buildDashboardStats(orders, user, todaySpending),
    [orders, user, todaySpending],
  )
  const recentOrders = useMemo(() => buildRecentOrders(orders), [orders])
  const popularPicks = useMemo(() => {
    const picks = buildPopularPicks(orders, 6)
    const menuByName = new Map(
      menuItems.map((item) => [String(item.name || '').trim().toLowerCase(), item]),
    )
    return picks.map((pick) => {
      const menuItem = menuByName.get(pick.name.toLowerCase())
      return {
        ...pick,
        imageUrl: menuItem?.image_url || '',
        menuItemId: menuItem?.id ?? null,
      }
    })
  }, [orders, menuItems])

  const paymentColors = [chartTheme.primary, chartTheme.secondary]
  const localizedPaymentSplit = useMemo(
    () =>
      paymentSplit.map((entry) => ({
        ...entry,
        name: paymentMethodLabel(entry.name, t),
      })),
    [paymentSplit, t],
  )
  const paymentTotal = localizedPaymentSplit.reduce((sum, item) => sum + item.value, 0)

  const openPopularPick = (pick) => {
    if (pick.menuItemId == null) return
    onNavigate?.('order')
    if (!window.location.hash.startsWith('#/order')) return
    const url = new URL(window.location.href)
    url.searchParams.set('item', String(pick.menuItemId))
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  const handleAlertAction = (alert) => {
    onNavigate?.(
      alert?.action?.navigateTo ||
        (alert?.category === 'security_alert'
          ? 'security_alerts'
          : alert?.category === 'password_reset'
            ? 'users'
            : alert?.category === 'reservation'
              ? 'reservations'
              : 'inventory'),
    )
  }

  const hasSecurityAlerts = alerts.some((alert) => alert.category === 'password_reset')
  const hasLoginLockAlerts = alerts.some((alert) => alert.category === 'security_alert')
  const hasReservationAlerts = alerts.some((alert) => alert.category === 'reservation')
  const showAlertCenter =
    lowStockAlertsEnabled ||
    (isAdmin && (hasSecurityAlerts || hasLoginLockAlerts)) ||
    hasReservationAlerts

  const stats = [
    {
      title: t('dashboard.todaySales', { defaultValue: "Today's Sales" }),
      value: `$${dashboardStats.todayRevenue.toFixed(2)}`,
      change: `${dashboardStats.todayOrderCount} ${t('dashboard.ordersToday', { defaultValue: 'orders today' })}`,
      icon: DollarSign,
      color: 'bg-forest-500',
      light: 'badge-forest',
    },
    {
      title: t('dashboard.todaySpending', { defaultValue: "Today's Spending" }),
      value: `$${dashboardStats.todaySpending.toFixed(2)}`,
      change: t('dashboard.spendingHint', { defaultValue: 'Logged expenses' }),
      icon: Wallet,
      color: 'bg-cocoa-600',
      light: 'badge-olive',
    },
    {
      title: t('dashboard.netProfit', { defaultValue: 'Net Profit' }),
      value: `$${dashboardStats.netProfit.toFixed(2)}`,
      change: t('dashboard.netProfitHint', { defaultValue: 'Income − Spending' }),
      icon: dashboardStats.netProfit >= 0 ? TrendingUp : TrendingDown,
      color: dashboardStats.netProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600',
      light: dashboardStats.netProfit >= 0 ? 'badge-forest' : 'badge-olive',
    },
    {
      title: t('dashboard.activeCashier', { defaultValue: 'Active Cashier' }),
      value: dashboardStats.cashierName,
      change: t('dashboard.onDuty', { defaultValue: 'On duty' }),
      icon: UserCheck,
      color: 'bg-olive-600',
      light: 'badge-forest',
    },
  ]

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h3 className="page-title">{t('nav.dashboard')}</h3>
      </div>

      <LiveConditions
        weather={liveConditions?.weather}
        exchange={liveConditions?.exchange}
        isLoading={liveLoading}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="surface-card min-w-0 p-5"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted text-sm font-medium">{stat.title}</p>
                  <p className="text-heading mt-2 line-clamp-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
                  <p className={`mt-2 inline-flex max-w-full items-center gap-1 ${stat.light}`}>
                    <TrendingUp className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">{stat.change}</span>
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stat.color} text-white shadow-sm`}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="surface-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-heading text-lg">{t('dashboard.popularPicks')}</h3>
            <p className="text-muted mt-1 text-sm">{t('dashboard.popularPicksHint')}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {popularPicks.length === 0 ? (
            <p className="text-muted col-span-full text-sm">
              {isLoading ? t('dashboard.loadingOrders') : t('dashboard.noPopularPicks')}
            </p>
          ) : (
            popularPicks.map((pick, index) => {
              const label = translateMenuName(pick.name, i18n.language, t)
              return (
                <button
                  key={pick.menuItemId ?? pick.name}
                  type="button"
                  disabled={pick.menuItemId == null}
                  onClick={() => openPopularPick(pick)}
                  aria-label={label}
                  className="surface-inset flex w-full cursor-pointer flex-col items-center px-3 py-4 text-center transition hover:border-forest-400 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:cursor-default disabled:shadow-none"
                >
                  <MenuItemImage
                    imageUrl={pick.imageUrl}
                    alt=""
                    eager={index < 6}
                    className="h-16 w-16 rounded-xl border border-slate-100 object-cover dark:border-zinc-800"
                  />
                  <p className="text-heading mt-3 line-clamp-2 text-sm font-semibold">
                    {label}
                  </p>
                  <p className="text-muted mt-1 text-xs tabular-nums">
                    {t('dashboard.soldCount', { count: pick.sold })}
                  </p>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="surface-card p-6">
          <h3 className="text-heading text-lg">{t('dashboard.weeklySales')}</h3>
          <div className="mt-6 h-72 w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted text-sm">{t('dashboard.loadingChart')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={localizedWeeklySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: chartTheme.axis, fontSize: 12 }}
                    axisLine={{ stroke: chartTheme.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: chartTheme.primarySoft, opacity: 0.35 }}
                    content={({ active, payload, label }) => (
                      <ChartTooltip
                        active={active}
                        payload={payload}
                        label={
                          payload?.[0]?.payload?.fullLabel
                            ? `${label} · ${payload[0].payload.fullLabel}`
                            : label
                        }
                        theme={chartTheme}
                      />
                    )}
                  />
                  <Bar
                    dataKey="revenue"
                    radius={[8, 8, 0, 0]}
                    fill={chartTheme.primary}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <h3 className="text-heading text-lg">{t('dashboard.paymentSplit')}</h3>
          <div className="mt-4 flex flex-col items-center">
            <div className="h-52 w-full">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted text-sm">{t('dashboard.loadingChart')}</p>
                </div>
              ) : paymentTotal === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted text-sm">{t('dashboard.noPaymentData')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={localizedPaymentSplit}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {localizedPaymentSplit.map((entry, index) => (
                        <Cell key={entry.name} fill={paymentColors[index % paymentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => (
                        <PaymentTooltip active={active} payload={payload} theme={chartTheme} />
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-2 w-full space-y-3">
              {localizedPaymentSplit.map((entry, index) => {
                const percent = paymentTotal > 0 ? (entry.value / paymentTotal) * 100 : 0
                return (
                  <div key={entry.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: paymentColors[index] }}
                        />
                        <span className="text-foreground">{entry.name}</span>
                      </div>
                      <span className="text-heading font-semibold tabular-nums">
                        ${entry.value.toFixed(2)} ({percent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background/80 dark:bg-card/40">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: paymentColors[index],
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-muted mt-4 text-center text-xs">
              {t('dashboard.totalProcessed')}{' '}
              <span className="text-heading font-semibold tabular-nums">
                ${paymentTotal.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="surface-card p-6">
        <h3 className="text-heading text-lg">{t('dashboard.recentOrders')}</h3>
        <div className="mt-6 space-y-4">
          {recentOrders.length === 0 ? (
            <p className="text-muted text-sm">
              {isLoading ? t('dashboard.loadingOrders') : t('dashboard.noOrders')}
            </p>
          ) : (
            recentOrders.map((order) => (
              <div
                key={order.id}
                className="surface-inset flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-heading font-medium">{order.id}</p>
                  <p className="text-muted truncate text-sm">
                    {translateMenuSummary(order.item, i18n.language, t)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-primary tabular-nums">{order.total}</p>
                  <p className="text-muted text-xs">{order.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAlertCenter && (
        <AlertCenter
          alerts={alerts}
          counts={counts}
          isLoading={alertsLoading}
          error={alertsError}
          onAction={handleAlertAction}
          onDismiss={markNotificationRead}
          onViewAll={() => onNavigate?.(hasSecurityAlerts ? 'users' : hasReservationAlerts ? 'reservations' : 'inventory')}
          variant="widget"
          maxItems={5}
        />
      )}
    </div>
  )
}
