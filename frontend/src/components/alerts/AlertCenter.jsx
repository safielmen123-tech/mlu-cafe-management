import {
  AlertTriangle,
  Bell,
  Brain,
  CheckCircle2,
  DollarSign,
  Package,
  Sparkles,
} from 'lucide-react'

const SEVERITY_STYLES = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-100 text-red-800 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800/60',
    border: 'border-l-red-500',
    iconBg: 'bg-red-500/15 text-red-600 dark:text-red-300',
    Icon: AlertTriangle,
  },
  warning: {
    label: 'Warning',
    badge: 'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
    border: 'border-l-amber-400',
    iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  ai_suggestion: {
    label: 'AI Suggestion',
    badge:
      'border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30',
    border: 'border-l-sky-500 dark:border-l-violet-400',
    iconBg: 'bg-sky-500/15 text-sky-700 dark:bg-violet-500/15 dark:text-violet-300',
    Icon: Brain,
  },
}

const CATEGORY_ICONS = {
  stock: Package,
  ai_suggestion: Sparkles,
  margin: DollarSign,
}

function formatAlertTime(timestamp) {
  if (!timestamp) return ''
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return timestamp
  }
}

export function AlertSeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.warning
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style.badge}`}
    >
      {style.label}
    </span>
  )
}

export function AlertCard({ alert, onAction, compact = false }) {
  const severity = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.warning
  const SeverityIcon = severity.Icon
  const CategoryIcon = CATEGORY_ICONS[alert.category] || Bell

  return (
    <article
      className={`border-l-4 ${severity.border} bg-white px-3 py-3 transition-colors hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 ${
        compact ? '' : 'rounded-xl border border-slate-200 dark:border-zinc-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${severity.iconBg}`}
        >
          <SeverityIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AlertSeverityBadge severity={alert.severity} />
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <CategoryIcon className="h-3 w-3" />
              {alert.category === 'ai_suggestion' ? 'AI' : alert.category}
            </span>
          </div>
          <h4 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{alert.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{alert.message}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground/80">{formatAlertTime(alert.timestamp)}</p>
            {alert.action?.label && (
              <button
                type="button"
                onClick={() => onAction?.(alert)}
                className="rounded-lg bg-forest-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-forest-500 dark:bg-forest-500 dark:hover:bg-forest-400"
              >
                {alert.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * Reusable alert list / dashboard widget.
 * variant: 'panel' (dropdown) | 'widget' (dashboard card)
 */
export default function AlertCenter({
  alerts = [],
  counts,
  isLoading = false,
  error = null,
  onAction,
  onViewAll,
  variant = 'panel',
  maxItems,
}) {
  const visibleAlerts = maxItems ? alerts.slice(0, maxItems) : alerts
  const total = counts?.total ?? alerts.length
  const isWidget = variant === 'widget'

  return (
    <div
      className={
        isWidget
          ? 'surface-card overflow-hidden'
          : 'flex max-h-[28rem] flex-col'
      }
    >
      <div
        className={`flex items-start justify-between gap-3 border-b border-border/40 ${
          isWidget ? 'px-5 py-4' : 'px-4 py-3'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-forest-600 dark:text-forest-400" />
            <p className="text-heading text-sm font-semibold">
              {isWidget ? 'Alert & AI Advisory Center' : 'Alerts & Advisories'}
            </p>
          </div>
          <p className="text-muted mt-0.5 text-xs">
            {isLoading
              ? 'Scanning inventory, weather, FX, and demand...'
              : error
                ? error
                : total === 0
                  ? 'No active alerts — operations look stable'
                  : `${total} active · ${counts?.critical || 0} critical · ${counts?.warning || 0} warning · ${counts?.ai_suggestion || 0} AI`}
          </p>
        </div>
        {isWidget && total > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(counts?.critical || 0) > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950/50 dark:text-red-200">
                {counts.critical} Critical
              </span>
            )}
            {(counts?.warning || 0) > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {counts.warning} Warning
              </span>
            )}
            {(counts?.ai_suggestion || 0) > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900 dark:bg-indigo-950/50 dark:text-sky-200">
                {counts.ai_suggestion} AI
              </span>
            )}
          </div>
        )}
      </div>

      <div className={`overflow-y-auto ${isWidget ? 'max-h-96 px-4 py-3' : 'max-h-80'}`}>
        {isLoading ? (
          <div className="px-4 py-8 text-center">
            <p className="text-muted text-sm">Loading alerts...</p>
          </div>
        ) : total === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-foreground text-sm font-medium">All clear</p>
            <p className="text-muted mt-1 text-xs">
              Stock, margins, and market signals are within thresholds.
            </p>
          </div>
        ) : (
          <ul className={isWidget ? 'space-y-3' : 'divide-y divide-border/30'}>
            {visibleAlerts.map((alert) => (
              <li key={alert.id} className={isWidget ? '' : ''}>
                <AlertCard
                  alert={alert}
                  onAction={onAction}
                  compact={!isWidget}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {onViewAll && total > 0 && (
        <div className="border-t border-border/40 px-4 py-2.5">
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View Inventory & Stock →
          </button>
        </div>
      )}
    </div>
  )
}
