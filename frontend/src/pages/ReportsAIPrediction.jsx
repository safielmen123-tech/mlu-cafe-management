import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Brain,
  Clock,
  DollarSign,
  Loader2,
  Package,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '../context/ThemeContext'
import { apiFetch } from '../services/apiClient'

const ANALYSIS_DAYS = 365

const TARGET_PERIODS = [
  { month: 8, year: 2026, label: 'August 2026' },
  { month: 9, year: 2026, label: 'September 2026' },
  { month: 10, year: 2026, label: 'October 2026' },
  { month: 11, year: 2026, label: 'November 2026' },
  { month: 12, year: 2026, label: 'December 2026' },
  { month: 1, year: 2027, label: 'January 2027' },
  { month: 2, year: 2027, label: 'February 2027' },
  { month: 3, year: 2027, label: 'March 2027' },
]

const DEFAULT_TARGET = TARGET_PERIODS[0]

const pillStyles = {
  critical: 'bg-red-100 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/50',
  high: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
  medium: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
  low: 'bg-stone-100 text-stone-600 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
  info: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/50',
  positive: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
}

function StatusPill({ label, tone = 'info' }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${pillStyles[tone] || pillStyles.info}`}>
      {label}
    </span>
  )
}

function useChartTheme() {
  const { isDark } = useTheme()
  return useMemo(
    () => ({
      axis: isDark ? '#c2cbc5' : '#57534e',
      grid: isDark ? '#323b36' : '#d5efd5',
      actual: isDark ? '#3da83d' : '#228b22',
      predicted: isDark ? '#a8a833' : '#808000',
      tooltipBg: isDark ? '#121816' : '#ffffff',
      tooltipBorder: isDark ? '#323b36' : '#e0e0ab',
      tooltipText: isDark ? '#eaf5ec' : '#0a220a',
      muted: isDark ? '#a8a29e' : '#78716c',
    }),
    [isDark],
  )
}

function TrendTooltip({ active, payload, label, theme }) {
  if (!active || !payload?.length) return null
  const actual = payload.find((entry) => entry.dataKey === 'actualRevenue')?.value
  const predicted = payload.find((entry) => entry.dataKey === 'predictedRevenue')?.value
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.tooltipText,
      }}
    >
      <p className="text-xs" style={{ color: theme.muted }}>{label}</p>
      {actual != null && actual > 0 && (
        <p className="text-sm font-bold tabular-nums">${Number(actual).toFixed(2)}</p>
      )}
      {predicted != null && (
        <p className="text-sm font-bold tabular-nums">${Number(predicted).toFixed(2)}</p>
      )}
    </div>
  )
}

export default function ReportsAIPrediction() {
  const { t } = useTranslation()
  const chartTheme = useChartTheme()
  const [predictions, setPredictions] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [targetPeriod, setTargetPeriod] = useState(DEFAULT_TARGET)

  const runAnalysis = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        days: String(ANALYSIS_DAYS),
        targetMonth: String(targetPeriod.month),
        targetYear: String(targetPeriod.year),
      })
      const response = await apiFetch(`/ai/predictions?${params.toString()}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Failed to load AI predictions')
      setPredictions(payload)
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to run AI analysis')
      setPredictions(null)
    } finally {
      setIsLoading(false)
    }
  }, [targetPeriod])

  useEffect(() => {
    runAnalysis()
  }, [runAnalysis])

  const callouts = useMemo(() => {
    if (!predictions) return []
    const { forecasts, historicalSummary } = predictions
    const growth = forecasts.weeklyGrowthPercent
    return [
      {
        label: t('ai.predictedRevenue', { defaultValue: 'Predicted Revenue' }),
        value: `$${(forecasts.targetMonthRevenue ?? forecasts.next7DaysRevenue).toFixed(2)}`,
        pill: growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`,
        tone: growth >= 0 ? 'positive' : 'warning',
        icon: DollarSign,
      },
      {
        label: t('ai.busyHours', { defaultValue: 'Busy Hours' }),
        value: forecasts.expectedBusyHours,
        pill: t('ai.highDemand', { defaultValue: 'High Demand' }),
        tone: 'high',
        icon: Clock,
      },
      {
        label: t('ai.monthlyOrders', { defaultValue: 'Monthly Orders' }),
        value: String(forecasts.targetMonthOrders ?? historicalSummary.totalOrders),
        pill: `${ANALYSIS_DAYS}d`,
        tone: 'info',
        icon: TrendingUp,
      },
      {
        label: t('ai.stockAlerts', { defaultValue: 'Stock Alerts' }),
        value: String(predictions.inventoryWarnings.length),
        pill:
          predictions.inventoryWarnings.length > 0
            ? t('ai.stockAlert', { defaultValue: 'Stock Alert' })
            : t('ai.stockOk', { defaultValue: 'Healthy' }),
        tone: predictions.inventoryWarnings.length > 0 ? 'critical' : 'positive',
        icon: AlertTriangle,
      },
    ]
  }, [predictions, t])

  const chartData = useMemo(() => {
    if (!predictions?.trendChart?.length) return []
    return predictions.trendChart.map((point) => ({
      ...point,
      label: point.dayLabel,
      actualRevenue: point.actualRevenue ?? 0,
      predictedRevenue: point.predictedRevenue ?? null,
    }))
  }, [predictions])

  const maxPeak = Math.max(
    1,
    ...(predictions?.forecasts?.peakHours ?? []).map((slot) => Number(slot.orders) || 0),
  )

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="page-title">{t('nav.aiPrediction')}</h3>
          <p className="page-subtitle">
            {t('ai.subtitle', { defaultValue: 'Sales & demand signals at a glance' })}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <select
            value={`${targetPeriod.year}-${targetPeriod.month}`}
            onChange={(event) => {
              const selected = TARGET_PERIODS.find(
                (period) => `${period.year}-${period.month}` === event.target.value,
              )
              if (selected) setTargetPeriod(selected)
            }}
            disabled={isLoading}
            className="input-field min-w-[200px] px-3 py-2 text-sm"
          >
            {TARGET_PERIODS.map((period) => (
              <option key={`${period.year}-${period.month}`} value={`${period.year}-${period.month}`}>
                {period.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={isLoading}
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isLoading
              ? t('ai.running', { defaultValue: 'Analyzing…' })
              : t('ai.run', { defaultValue: 'Refresh AI' })}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(callouts.length ? callouts : Array.from({ length: 4 })).map((card, index) => {
          if (!card?.label) {
            return <div key={index} className="surface-card h-28 animate-pulse" />
          }
          const Icon = card.icon
          return (
            <div key={card.label} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-muted text-sm">{card.label}</p>
                  <p className="text-heading mt-2 text-3xl font-semibold tabular-nums">{card.value}</p>
                  <div className="mt-3">
                    <StatusPill label={card.pill} tone={card.tone} />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-500 text-white">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-forest-600" />
            <h4 className="text-heading text-sm font-semibold">
              {t('ai.trend', { defaultValue: 'Revenue Trend' })}
            </h4>
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                  <Tooltip content={<TrendTooltip theme={chartTheme} />} />
                  <Bar dataKey="actualRevenue" fill={chartTheme.actual} radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="predictedRevenue"
                    stroke={chartTheme.predicted}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                {isLoading ? '…' : t('ai.noChart', { defaultValue: 'No trend data yet' })}
              </div>
            )}
          </div>
        </div>

        <div className="surface-card p-5">
          <h4 className="text-heading text-sm font-semibold">
            {t('ai.peakHours', { defaultValue: 'Peak Hours' })}
          </h4>
          <div className="mt-4 space-y-3">
            {(predictions?.forecasts?.peakHours ?? []).slice(0, 5).map((slot) => {
              const width = Math.max(8, (Number(slot.orders) / maxPeak) * 100)
              return (
                <div key={`${slot.hour}-${slot.orders}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-heading font-medium">{slot.hour}</span>
                    <span className="tabular-nums text-muted">{slot.orders}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
            {!predictions?.forecasts?.peakHours?.length && (
              <p className="text-muted text-sm">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <h4 className="text-heading text-sm font-semibold">
            {t('ai.topItems', { defaultValue: 'Top Items' })}
          </h4>
          <ul className="mt-4 space-y-2">
            {(predictions?.historicalSummary?.topItems ?? []).slice(0, 6).map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2 dark:bg-card/40"
              >
                <span className="text-heading text-sm font-medium">{item.name}</span>
                <StatusPill
                  label={`${item.unitsSold ?? item.qty ?? item.units_sold ?? 0}`}
                  tone={index < 2 ? 'high' : 'info'}
                />
              </li>
            ))}
            {!predictions?.historicalSummary?.topItems?.length && (
              <li className="text-muted text-sm">—</li>
            )}
          </ul>
        </div>

        <div className="surface-card p-5">
          <h4 className="text-heading mb-4 text-sm font-semibold">
            {t('ai.actions', { defaultValue: 'Action Pills' })}
          </h4>
          <div className="flex flex-wrap gap-2">
            {(predictions?.highDemandAlerts ?? []).slice(0, 4).map((alert) => (
              <StatusPill
                key={`demand-${alert.name || alert.title}`}
                label={alert.name || alert.title || t('ai.highDemand', { defaultValue: 'High Demand' })}
                tone="high"
              />
            ))}
            {(predictions?.inventoryWarnings ?? []).slice(0, 4).map((item) => (
              <StatusPill
                key={`stock-${item.id ?? item.itemName ?? item.item_name ?? item.name}`}
                label={item.itemName || item.item_name || item.name || t('ai.stockAlert', { defaultValue: 'Stock Alert' })}
                tone={item.urgency === 'critical' ? 'critical' : 'warning'}
              />
            ))}
            {(predictions?.recommendations ?? []).slice(0, 4).map((tip) => (
              <StatusPill
                key={`tip-${tip.title || tip.id}`}
                label={tip.title || tip.type || 'Tip'}
                tone="info"
              />
            ))}
            {!predictions && !isLoading && <span className="text-muted text-sm">—</span>}
          </div>

          {(predictions?.inventoryWarnings?.length ?? 0) > 0 && (
            <ul className="mt-5 space-y-2">
              {predictions.inventoryWarnings.slice(0, 4).map((item) => (
                <li key={item.id ?? item.itemName ?? item.item_name ?? item.name} className="flex items-start gap-2 text-sm">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-heading">
                    {item.itemName || item.item_name || item.name}
                    <span className="text-muted"> · {item.reason || item.message || 'Reorder soon'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
