import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ExpenseTracker from '../components/finance/ExpenseTracker'
import { SalesFilterBar } from '../components/ui/SalesFilterBar'
import { usePOS } from '../context/POSContext'
import { useTheme } from '../context/ThemeContext'
import { apiFetch } from '../services/apiClient'
import {
  buildMonthFilterOptions,
  filterCompletedOrders,
  filterOrdersByMonth,
  formatMonthLabel,
} from '../utils/salesHistoryAnalytics'
import {
  buildDailyProfitForMonth,
  buildMonthlyProfitChart,
  filterExpensesByMonth,
  summarizeExpenses,
  summarizeProfit,
} from '../utils/profitAnalytics'

function ProfitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const title = payload[0]?.payload?.fullLabel || label

  return (
    <div className="surface-card rounded-xl border px-3 py-2 text-sm shadow-lg">
      <p className="text-muted text-xs">{title}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-0.5 font-semibold tabular-nums" style={{ color: entry.color }}>
          {entry.name}: ${Number(entry.value || 0).toFixed(2)}
        </p>
      ))}
    </div>
  )
}

export default function ReportsAnalysis() {
  const { t } = useTranslation()
  const { salesHistory } = usePOS()
  const { isDark } = useTheme()
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [expenses, setExpenses] = useState([])
  const [expenseError, setExpenseError] = useState('')
  const [expenseTick, setExpenseTick] = useState(0)

  const monthOptions = useMemo(() => buildMonthFilterOptions(16), [])

  const loadExpenses = useCallback(async () => {
    setExpenseError('')
    try {
      const response = await apiFetch('/expenses?days=730')
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data.message || 'Failed to load expenses')
      setExpenses(Array.isArray(data) ? data : [])
    } catch (error) {
      setExpenseError(error.message || 'Could not load spending records.')
      setExpenses([])
    }
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses, expenseTick])

  const completedSales = useMemo(
    () => filterCompletedOrders(salesHistory),
    [salesHistory],
  )

  const monthScopedSales = useMemo(
    () => filterOrdersByMonth(completedSales, selectedMonth),
    [completedSales, selectedMonth],
  )

  const monthScopedExpenses = useMemo(
    () => filterExpensesByMonth(expenses, selectedMonth),
    [expenses, selectedMonth],
  )

  const profit = useMemo(
    () => summarizeProfit(monthScopedSales, monthScopedExpenses),
    [monthScopedSales, monthScopedExpenses],
  )

  const expenseBreakdown = useMemo(
    () => summarizeExpenses(monthScopedExpenses),
    [monthScopedExpenses],
  )

  const chartData = useMemo(() => {
    if (selectedMonth === 'all') {
      return buildMonthlyProfitChart(completedSales, expenses, monthOptions)
    }
    return buildDailyProfitForMonth(completedSales, expenses, selectedMonth)
  }, [completedSales, expenses, monthOptions, selectedMonth])

  const chartLabel =
    selectedMonth === 'all'
      ? 'Monthly income, expenses, and profit'
      : `Daily income vs spending — ${formatMonthLabel(selectedMonth)}`

  const axisColor = isDark ? '#c2cbc5' : '#57534e'
  const gridColor = isDark ? '#323b36' : '#d5efd5'
  const incomeColor = isDark ? '#3da83d' : '#228b22'
  const expenseColor = isDark ? '#d97706' : '#b45309'
  const profitColor = isDark ? '#86a373' : '#4d7c0f'
  const hasChartValues = chartData.some(
    (point) => point.revenue > 0 || point.expenses > 0,
  )

  const statCards = [
    {
      label: 'Income',
      value: `$${profit.revenue.toFixed(2)}`,
      hint: `${profit.orders} completed orders`,
      icon: TrendingUp,
      accent: 'bg-forest-500',
    },
    {
      label: 'Expenses',
      value: `$${profit.expenses.toFixed(2)}`,
      hint: `${monthScopedExpenses.length} spending records`,
      icon: TrendingDown,
      accent: 'bg-amber-700',
    },
    {
      label: 'Net profit',
      value: `$${profit.profit.toFixed(2)}`,
      hint: 'Income minus expenses',
      icon: Wallet,
      accent: profit.profit >= 0 ? 'bg-olive-600' : 'bg-red-600',
    },
    {
      label: 'Orders fulfilled',
      value: profit.orders.toString(),
      hint: selectedMonth === 'all' ? 'All months in range' : formatMonthLabel(selectedMonth),
      icon: ShoppingBag,
      accent: 'bg-forest-700',
    },
  ]

  const categoryEntries = Object.entries(expenseBreakdown.byCategory).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-heading text-lg">{t('nav.analysis')}</h3>
        <p className="text-muted text-sm">
          Compare income from completed sales with operating expenses to see profit by day or month.
        </p>
      </div>

      <div className="surface-card p-4">
        <SalesFilterBar
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          monthOptions={monthOptions}
        />
        <p className="text-muted mt-3 text-sm">
          Choose a month for a daily view, or keep all months to see the year at a glance.
        </p>
      </div>

      {expenseError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {expenseError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, hint, icon: Icon, accent }) => (
          <div key={label} className="surface-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted text-sm">{label}</p>
                <p className="text-heading mt-2 text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-muted mt-1 text-xs">{hint}</p>
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
              <p className="text-muted text-sm">Income from Sales History, expenses from logged spending</p>
            </div>
          </div>
        </div>
        <div className="h-80 p-4">
          {!hasChartValues ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted text-sm">No income or expense data for the selected period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  interval={0}
                  angle={selectedMonth === 'all' ? -40 : 0}
                  textAnchor={selectedMonth === 'all' ? 'end' : 'middle'}
                  height={selectedMonth === 'all' ? 64 : 32}
                />
                <YAxis tick={{ fill: axisColor, fontSize: 12 }} />
                <Tooltip content={<ProfitTooltip />} />
                <Legend />
                <Bar dataKey="revenue" name="Income" fill={incomeColor} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={expenseColor} radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill={profitColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {categoryEntries.length > 0 ? (
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/40">
              <Receipt className="h-5 w-5 text-amber-800 dark:text-amber-300" />
            </div>
            <div>
              <h4 className="text-heading font-semibold">Spending by category</h4>
              <p className="text-muted text-sm">Where the cafe money went in this period</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categoryEntries.map(([category, amount]) => (
              <div key={category} className="surface-inset rounded-xl px-4 py-3">
                <p className="text-muted text-xs uppercase tracking-wider">{category}</p>
                <p className="text-heading mt-1 text-lg font-semibold tabular-nums">${amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="surface-card p-5">
        <ExpenseTracker
          days={730}
          filterMonth={selectedMonth}
          onChanged={() => setExpenseTick((tick) => tick + 1)}
        />
      </div>
    </div>
  )
}
