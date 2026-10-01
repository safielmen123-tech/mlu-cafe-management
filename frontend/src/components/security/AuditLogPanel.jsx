import { useCallback, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../services/apiClient'
import { formatDateTimeDisplay } from '../../utils/dateTimeFormat'

const EMPTY_FILTERS = {
  from: '',
  to: '',
  user: '',
  module: '',
  action: '',
  q: '',
}

export default function AuditLogPanel() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [modules, setModules] = useState([])
  const [actions, setActions] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.user) params.set('user', filters.user)
      if (filters.module) params.set('module', filters.module)
      if (filters.action) params.set('action', filters.action)
      if (filters.q) params.set('q', filters.q)

      const res = await apiFetch(`/audit-logs?${params.toString()}`)
      if (!res.ok) throw new Error(t('audit.errors.load'))
      const data = await res.json()
      setLogs(Array.isArray(data.logs) ? data.logs : [])
      setTotal(Number(data.total) || 0)
      setPageSize(Number(data.pageSize) || 50)
      setModules(Array.isArray(data.modules) ? data.modules : [])
      setActions(Array.isArray(data.actions) ? data.actions : [])
    } catch (err) {
      console.error(err)
      setError(t('audit.errors.couldNotLoad'))
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters, page, t])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const applyFilters = (event) => {
    event.preventDefault()
    setPage(1)
    setFilters({ ...draft })
  }

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-forest-600 ring-1 ring-forest-100 dark:bg-forest-950/40 dark:text-forest-300 dark:ring-forest-800">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-heading font-semibold">{t('audit.title')}</h4>
          <p className="text-muted text-sm">{t('audit.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={applyFilters} className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">{t('audit.filterFrom')}</span>
          <input
            type="date"
            value={draft.from}
            onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
            className="input-field px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">{t('audit.filterTo')}</span>
          <input
            type="date"
            value={draft.to}
            onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
            className="input-field px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">{t('audit.filterUser')}</span>
          <input
            type="text"
            value={draft.user}
            onChange={(e) => setDraft((prev) => ({ ...prev, user: e.target.value }))}
            className="input-field px-3 py-2 text-sm"
            placeholder={t('audit.filterUserPlaceholder')}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">{t('audit.filterModule')}</span>
          <select
            value={draft.module}
            onChange={(e) => setDraft((prev) => ({ ...prev, module: e.target.value }))}
            className="input-field bg-white px-3 py-2 text-sm dark:bg-obsidian-900"
          >
            <option value="">{t('audit.allModules')}</option>
            {modules.map((moduleName) => (
              <option key={moduleName} value={moduleName}>{moduleName}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">{t('audit.filterAction')}</span>
          <select
            value={draft.action}
            onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}
            className="input-field bg-white px-3 py-2 text-sm dark:bg-obsidian-900"
          >
            <option value="">{t('audit.allActions')}</option>
            {actions.map((actionName) => (
              <option key={actionName} value={actionName}>{actionName}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
          <span className="text-muted">{t('audit.search')}</span>
          <input
            type="search"
            value={draft.q}
            onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
            className="input-field px-3 py-2 text-sm"
            placeholder={t('audit.searchPlaceholder')}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn-primary px-3 py-2 text-xs font-semibold">
            {t('audit.applyFilters')}
          </button>
          <button type="button" onClick={clearFilters} className="btn-secondary px-3 py-2 text-xs font-semibold">
            {t('audit.clearFilters')}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-3">{t('audit.timestamp')}</th>
              <th className="px-4 py-3">{t('audit.user')}</th>
              <th className="px-4 py-3">{t('audit.role')}</th>
              <th className="px-4 py-3">{t('audit.module')}</th>
              <th className="px-4 py-3">{t('audit.action')}</th>
              <th className="px-4 py-3">{t('audit.description')}</th>
            </tr>
          </thead>
          <tbody className="table-divider">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  {t('audit.loading')}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  {t('audit.empty')}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const created = log.created_at ? new Date(log.created_at) : null
                return (
                  <tr key={log.id} className="table-row align-top">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                      {created ? formatDateTimeDisplay(created, created) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-heading">
                      {log.username || `#${log.user_id || '—'}`}
                    </td>
                    <td className="px-4 py-3 text-muted">{log.user_role || '—'}</td>
                    <td className="px-4 py-3 text-heading">{log.module}</td>
                    <td className="px-4 py-3">
                      <span className="badge-olive">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-normal break-words text-muted">
                      {log.description || '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-xs">
          {t('audit.pageStatus', { page, totalPages, total })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            {t('common.previous')}
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            {t('common.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
