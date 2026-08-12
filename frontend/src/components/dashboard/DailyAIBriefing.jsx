import { useCallback, useEffect, useState } from 'react'
import {
  CloudRain,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  Sun,
  Users,
  Clock3,
  CheckSquare2,
  Square,
} from 'lucide-react'
import { apiFetch } from '../../services/apiClient'
import { STORE } from '../../config/store'

function WeatherIcon({ condition }) {
  if (condition === 'rain') return <CloudRain className="h-4 w-4" />
  if (condition === 'hot') return <Sun className="h-4 w-4" />
  return <Sun className="h-4 w-4" />
}

function KpiTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="surface-subtle p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-forest-600" />
        <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function FocusItemRow({ item, checked, onToggle }) {
  const priorityColor =
    item.priority === 'critical'
      ? 'text-red-600'
      : item.priority === 'high'
        ? 'text-amber-600'
        : 'text-sky-600'

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
      >
        <span className="mt-0.5 text-forest-600">
          {checked ? (
            <CheckSquare2 className="h-5 w-5 text-forest-600" />
          ) : (
            <Square className="h-5 w-5 opacity-50" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${priorityColor}`}>
            {item.priority} · {item.type}
          </span>
          <p
            className={`text-sm font-medium text-foreground ${
              checked ? 'line-through opacity-60' : ''
            }`}
          >
            {item.title}
          </p>
          <p className={`mt-0.5 text-xs leading-relaxed text-muted-foreground ${checked ? 'opacity-50' : ''}`}>
            {item.detail}
          </p>
        </span>
      </button>
    </li>
  )
}

export default function DailyAIBriefing({ displayName, hidden = false }) {
  const [briefing, setBriefing] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [checkedIds, setCheckedIds] = useState(() => new Set())

  const loadBriefing = useCallback(async ({ refresh = false } = {}) => {
    if (hidden) return
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const path = refresh ? '/ai/daily-briefing?refresh=1' : '/ai/daily-briefing'
      const response = await apiFetch(path)
      if (!response.ok) throw new Error('Failed to load daily briefing')
      const data = await response.json()
      setBriefing(data)
      setError(null)
      if (refresh) setCheckedIds(new Set())
    } catch (err) {
      setError(err.message || 'Unable to load briefing')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [hidden])

  useEffect(() => {
    if (hidden) return
    loadBriefing()
  }, [hidden, loadBriefing])

  const toggleFocusItem = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (hidden) return null

  if (isLoading && !briefing) {
    return (
      <div className="surface-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-forest-500" />
          <p className="text-sm text-muted-foreground">Preparing today&apos;s AI manager briefing…</p>
        </div>
      </div>
    )
  }

  if (error && !briefing) {
    return (
      <div className="surface-card border-red-200 p-6">
        <p className="text-sm font-semibold text-foreground">Daily briefing unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => loadBriefing({ refresh: true })}
          className="btn-secondary mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    )
  }

  const kpis = briefing?.kpis || {}
  const weather = briefing?.weather || {}
  const focusItems = briefing?.focusItems || []
  const greeting = briefing?.greeting || {}

  return (
    <section className="surface-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-forest inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              Daily Manager AI Briefing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-700">
              <WeatherIcon condition={weather.condition} />
              {weather.badge || `${STORE.location} weather`}
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {greeting.headline || `Good day, ${displayName || 'Manager'}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {greeting.dateLabel || 'Today'} · {STORE.officialName}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {briefing?.meta?.domainContext || STORE.domainContext}
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadBriefing({ refresh: true })}
          disabled={isRefreshing}
          className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing…' : 'Refresh Briefing'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={DollarSign}
          label="Projected Revenue"
          value={`$${(kpis.projectedRevenue ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          hint={`${kpis.projectedOrders ?? 0} estimated orders`}
        />
        <KpiTile
          icon={Users}
          label="Estimated Visitors"
          value={(kpis.estimatedVisitors ?? 0).toLocaleString()}
          hint={`Footfall index ${kpis.touristFootfallIndex ?? 100} · ${kpis.seasonLabel || 'Seasonal'}`}
        />
        <KpiTile
          icon={Clock3}
          label="Peak Time Range"
          value={kpis.peakTimeRange || '—'}
          hint={kpis.primaryPeakLabel ? `Primary: ${kpis.primaryPeakLabel}` : 'Based on sales history'}
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">AI Focus Items for Today</h4>
          <p className="text-[11px] text-muted-foreground">
            {checkedIds.size}/{focusItems.length} checked
          </p>
        </div>
        {focusItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
            No urgent focus items — operations look steady for today.
          </p>
        ) : (
          <ul className="space-y-2">
            {focusItems.map((item) => (
              <FocusItemRow
                key={item.id}
                item={item}
                checked={checkedIds.has(item.id)}
                onToggle={toggleFocusItem}
              />
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-4 text-xs text-amber-600">Last refresh issue: {error}</p>
      ) : null}
    </section>
  )
}
