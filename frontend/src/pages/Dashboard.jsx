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
import { STORE } from '../config/store'
import { useAlerts } from '../hooks/useAlerts'
import AlertCenter from '../components/alerts/AlertCenter'
import { apiFetch, getAuthToken } from '../services/apiClient'
import {
  buildDashboardStats,
  buildPaymentSplitData,
  buildRecentOrders,
  buildWeeklySalesData,
} from '../utils/dashboardAnalytics'

const API_PATH = '/orders/history?days=730'

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
      secondary: isDark ? '#6ee7b7' : '#059669',
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

export default function Dashboard({ onNavigate }) {
  const { t } = useTranslation()
  const { user, isAdmin } = useAuth()
  const chartTheme = useChartTheme()
  const { lowStockAlertsEnabled } = useSettings()
  const { alerts, counts, isLoading: alertsLoading, error: alertsError, refresh, markNotificationRead } = useAlerts()
  const [orders, setOrders] = useState([])
  const [todaySpending, setTodaySpending] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
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
    ])
      .then(([orderRows, spending]) => {
        setOrders(orderRows)
        setTodaySpending(spending)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const weeklySales = useMemo(() => buildWeeklySalesData(orders), [orders])
  const paymentSplit = useMemo(() => buildPaymentSplitData(orders), [orders])
  const dashboardStats = useMemo(
    () => buildDashboardStats(orders, user, todaySpending),
    [orders, user, todaySpending],
  )
  const recentOrders = useMemo(() => buildRecentOrders(orders), [orders])

  const paymentColors = [chartTheme.primary, chartTheme.secondary]
  const paymentTotal = paymentSplit.reduce((sum, item) => sum + item.value, 0)

  const handleAlertAction = (alert) => {
    onNavigate?.(
      alert?.action?.navigateTo ||
        (alert?.category === 'password_reset' ? 'users' : alert?.category === 'reservation' ? 'reservations' : 'inventory'),
    )
  }

  const hasSecurityAlerts = alerts.some((alert) => alert.category === 'password_reset')
  const hasReservationAlerts = alerts.some((alert) => alert.category === 'reservation')
  const showAlertCenter =
    lowStockAlertsEnabled ||
    (isAdmin && hasSecurityAlerts) ||
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
      color: 'bg-amber-600',
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
    <div className="space-y-8 page-enter">
      <div>
        <h3 className="page-title">{t('nav.dashboard')}</h3>
        <p className="page-subtitle">
          {STORE.officialName} · Overview of sales, orders, and daily performance
        </p>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="surface-card p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted text-sm font-medium">{stat.title}</p>
                  <p className="text-heading mt-2 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
                  <p className={`mt-2 inline-flex items-center gap-1 ${stat.light}`}>
                    <TrendingUp className="h-3 w-3" />
                    {stat.change}
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${stat.color} text-white shadow-sm`}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="surface-card p-6 xl:col-span-2">
          <h3 className="text-heading text-lg">Recent Orders</h3>
          <p className="text-muted mt-1 text-sm">Latest transactions from the POS</p>
          <div className="mt-6 space-y-4">
            {recentOrders.length === 0 ? (
              <p className="text-muted text-sm">{isLoading ? 'Loading orders...' : 'No orders yet.'}</p>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="surface-inset flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-heading font-medium">{order.id}</p>
                    <p className="text-muted truncate text-sm">{order.item}</p>
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

        <div className="grid gap-6 sm:grid-cols-2 xl:col-span-3">
          <div className="surface-card p-6">
            <h3 className="text-heading text-lg">Weekly Sales Performance</h3>
            <p className="text-muted mt-1 text-sm">Daily revenue trend over the past 7 days</p>
            <div className="mt-6 h-72 w-full">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted text-sm">Loading chart data...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            <h3 className="text-heading text-lg">Payment Methods Split</h3>
            <p className="text-muted mt-1 text-sm">Cash vs. Bank Scan distribution</p>
            <div className="mt-4 flex flex-col items-center">
              <div className="h-52 w-full">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted text-sm">Loading chart data...</p>
                  </div>
                ) : paymentTotal === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted text-sm">No payment data available yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentSplit}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {paymentSplit.map((entry, index) => (
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
                {paymentSplit.map((entry, index) => {
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
                Total processed:{' '}
                <span className="text-heading font-semibold tabular-nums">
                  ${paymentTotal.toFixed(2)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
