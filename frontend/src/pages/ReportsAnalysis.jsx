import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Banknote,
  BarChart3,
  ScanLine,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SalesFilterBar } from '../components/ui/SalesFilterBar'
import { usePOS } from '../context/POSContext'
import { useTheme } from '../context/ThemeContext'
import {
  buildDailySalesForMonth,
  buildMonthFilterOptions,
  buildMonthlyTotalsChart,
  filterCompletedOrders,
  filterOrdersByMonth,
  formatMonthLabel,
  getCurrentMonthKey,
  summarizeSalesMetrics,
} from '../utils/salesHistoryAnalytics'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="surface-card rounded-xl border px-3 py-2 text-sm shadow-lg">
      <p className="text-muted text-xs">{label}</p>
      <p className="text-heading font-bold tabular-nums">${Number(payload[0].value).toFixed(2)}</p>
    </div>
  )
}

export default function ReportsAnalysis() {
  const { t } = useTranslation()
  const { salesHistory } = usePOS()
  const { isDark } = useTheme()
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey())

  const monthOptions = useMemo(() => buildMonthFilterOptions(12), [])

  const completedSales = useMemo(
    () => filterCompletedOrders(salesHistory),
    [salesHistory],
  )

  const monthScopedSales = useMemo(
    () => filterOrdersByMonth(completedSales, selectedMonth),
    [completedSales, selectedMonth],
  )

  const metrics = useMemo(() => summarizeSalesMetrics(monthScopedSales), [monthScopedSales])

  const chartData = useMemo(() => {
    if (selectedMonth === 'all') {
      return buildMonthlyTotalsChart(completedSales, monthOptions)
    }
    return buildDailySalesForMonth(completedSales, selectedMonth)
  }, [completedSales, monthOptions, selectedMonth])

  const chartLabel =
    selectedMonth === 'all'
      ? 'Monthly revenue (all months in range)'
      : `Daily revenue — ${formatMonthLabel(selectedMonth)}`

  const axisColor = isDark ? '#c2cbc5' : '#57534e'
  const gridColor = isDark ? '#323b36' : '#d5efd5'
  const barColor = isDark ? '#3da83d' : '#228b22'

  const statCards = [
    {
      label: 'Total Gross Revenue',
      value: `$${metrics.grossRevenue.toFixed(2)}`,
      icon: TrendingUp,
      accent: 'bg-forest-500',
    },
    {
      label: 'Total Orders Fulfilled',
      value: metrics.ordersFulfilled.toString(),
      icon: ShoppingBag,
      accent: 'bg-olive-600',
    },
    {
      label: 'Cash Sales Total',
      value: `$${metrics.cashTotal.toFixed(2)}`,
      icon: Banknote,
      accent: 'bg-forest-700',
    },
    {
      label: 'Bank Scan Sales Total',
      value: `$${metrics.bankScanTotal.toFixed(2)}`,
      icon: ScanLine,
      accent: 'bg-forest-600',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-heading text-lg">{t('nav.analysis')}</h3>
        <p className="text-muted text-sm">
          Financial performance derived from completed Sales History transactions
        </p>
      </div>

      <div className="surface-card p-4">
        <SalesFilterBar
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          monthOptions={monthOptions}
        />
        <p className="text-muted mt-3 text-sm">
          Metrics and charts below reflect{' '}
          {selectedMonth === 'all'
            ? 'all completed orders in the loaded history'
            : `completed orders in ${formatMonthLabel(selectedMonth)}`}
          . New checkouts from Payment sync here automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="surface-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted text-sm">{label}</p>
                <p className="text-heading mt-2 text-2xl font-bold tabular-nums">{value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-olive-100/60 px-6 py-4 dark:border-olive-800/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-100 dark:bg-forest-900/40">
              <BarChart3 className="h-5 w-5 text-forest-600 dark:text-forest-400" />
            </div>
            <div>
              <h4 className="text-heading font-semibold">{chartLabel}</h4>
              <p className="text-muted text-sm">
                Aggregated from shared Sales History records
              </p>
            </div>
          </div>
        </div>
        <div className="h-72 p-4">
          {chartData.length === 0 || chartData.every((point) => point.revenue === 0) ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted text-sm">No revenue data for the selected period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey={selectedMonth === 'all' ? 'fullLabel' : 'label'}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  interval={selectedMonth === 'all' ? 0 : 'preserveStartEnd'}
                />
                <YAxis tick={{ fill: axisColor, fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" fill={barColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
