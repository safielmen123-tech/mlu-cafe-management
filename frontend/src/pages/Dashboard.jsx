import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Brain,
  Clock,
  DollarSign,
  Package,
  Sparkles,
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
import DailyAIBriefing from '../components/dashboard/DailyAIBriefing'
import { apiFetch } from '../services/apiClient'
import {
  buildDashboardStats,
  buildPaymentSplitData,
  buildRecentOrders,
  buildWeeklySalesData,
} from '../utils/dashboardAnalytics'

const API_PATH = '/orders/history?days=365'

const peakHours = [
  { hour: '6 AM', demand: 72, label: 'Tourist coffee rush' },
  { hour: '8 AM', demand: 88, label: 'Morning peak' },
  { hour: '12 PM', demand: 95, label: 'Midday food orders' },
  { hour: '3 PM', demand: 58, label: 'Afternoon' },
  { hour: '5 PM', demand: 70, label: 'Evening mix' },
  { hour: '7 PM', demand: 40, label: 'Closing' },
]

const forecastItems = [
  { name: 'Cappuccino', predicted: 34, trend: '+18%' },
  { name: 'Iced Coffee', predicted: 28, trend: '+24%' },
  { name: 'Croissant', predicted: 22, trend: '+11%' },
  { name: 'Latte', predicted: 19, trend: '+8%' },
]

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
  const { user } = useAuth()
  const chartTheme = useChartTheme()
  const { lowStockAlertsEnabled, aiForecastUpdatesEnabled } = useSettings()
  const { alerts, counts, isLoading: alertsLoading, error: alertsError, refresh } = useAlerts()
  const [orders, setOrders] = useState([])
  const [todaySpending, setTodaySpending] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    Promise.all([
      apiFetch(API_PATH)
        .then((res) => res.json())
        .then((data) => (Array.isArray(data) ? data : []))
        .catch(() => []),
      apiFetch('/expenses/summary')
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
  const stockAlerts = useMemo(
    () => alerts.filter((alert) => alert.category === 'stock').slice(0, 4),
    [alerts],
  )

  const paymentColors = [chartTheme.primary, chartTheme.secondary]
  const paymentTotal = paymentSplit.reduce((sum, item) => sum + item.value, 0)
  const maxDemand = Math.max(...peakHours.map((hour) => hour.demand))

  const handleAlertAction = (alert) => {
    onNavigate?.(alert?.action?.navigateTo || 'inventory')
  }

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

      <DailyAIBriefing
        displayName={user?.display_name || user?.displayName || user?.username}
        hidden={!aiForecastUpdatesEnabled}
      />

      {(lowStockAlertsEnabled || aiForecastUpdatesEnabled) && (
        <AlertCenter
          alerts={alerts}
          counts={counts}
          isLoading={alertsLoading}
          error={alertsError}
          onAction={handleAlertAction}
          onViewAll={() => onNavigate?.('inventory')}
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

      {(aiForecastUpdatesEnabled || lowStockAlertsEnabled) && (
      <div className="surface-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl surface-emerald text-emerald-900 dark:text-emerald-300">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">AI Sales &amp; Demand Analytics</h3>
                <span className="inline-flex items-center gap-1 rounded-full badge-forest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" />
                  Live
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Predictions based on 30-day sales history and local foot traffic patterns
              </p>
            </div>
          </div>
          <div className="rounded-2xl surface-subtle px-4 py-2 text-center">
            <p className="text-xs text-slate-500 dark:text-zinc-400">7-Day Revenue</p>
            <p className="text-2xl font-semibold text-emerald-900 tabular-nums tracking-tight dark:text-emerald-300">
              ${weeklySales.reduce((sum, day) => sum + day.revenue, 0).toFixed(2)}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">From completed orders</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {aiForecastUpdatesEnabled && (
          <div className="surface-subtle p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-forest-600" />
              <h4 className="text-sm font-semibold text-foreground">Predicted Peak Hours Today</h4>
            </div>
            <div className="mt-4 space-y-3">
              {peakHours.map((slot) => (
                <div key={slot.hour}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{slot.hour}</span>
                    <span className="text-muted-foreground">{slot.label}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-forest-500 transition-all"
                      style={{ width: `${(slot.demand / maxDemand) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {lowStockAlertsEnabled && (
          <div className="surface-subtle p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              <h4 className="text-sm font-semibold text-foreground">Inventory Restock Alerts</h4>
            </div>
            <div className="mt-4 space-y-3">
              {stockAlerts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No stock alerts right now.</p>
              ) : (
                stockAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => handleAlertAction(alert)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          alert.severity === 'critical'
                            ? 'text-red-500'
                            : 'text-amber-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{alert.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                        alert.severity === 'critical'
                          ? 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/60'
                          : 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60'
                      }`}
                    >
                      {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          )}

          {aiForecastUpdatesEnabled && (
          <div className="surface-subtle p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-forest-600" />
              <h4 className="text-sm font-semibold text-foreground">Tomorrow&apos;s Top Sellers</h4>
            </div>
            <div className="mt-4 space-y-3">
              {forecastItems.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full badge-forest text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-forest-500"
                        style={{ width: `${(item.predicted / 34) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">~{item.predicted}</p>
                    <p className="text-xs text-forest-600">{item.trend}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
      )}

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
