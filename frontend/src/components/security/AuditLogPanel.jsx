import { useCallback, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { apiFetch } from '../../services/apiClient'
import { formatDateTimeDisplay } from '../../utils/dateTimeFormat'

export default function AuditLogPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/audit-logs?limit=200')
      if (!res.ok) throw new Error('Failed to load audit logs')
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Could not load security history.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-forest-600 ring-1 ring-forest-100 dark:bg-forest-950/40 dark:text-forest-300 dark:ring-forest-800">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-heading font-semibold">Audit Logs / Security History</h4>
          <p className="text-muted text-sm">
            Administrator-only trail of logins, orders, menu edits, and payments
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody className="table-divider">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Loading audit logs…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const created = log.created_at ? new Date(log.created_at) : null
                const date = created ? created.toISOString().slice(0, 10) : ''
                const time = created
                  ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  : ''
                return (
                  <tr key={log.id} className="table-row">
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {created ? formatDateTimeDisplay(date, time) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-heading">
                      {log.username || `#${log.user_id || '—'}`}
                    </td>
                    <td className="px-4 py-3 text-muted">{log.user_role || '—'}</td>
                    <td className="px-4 py-3 text-heading">{log.module}</td>
                    <td className="px-4 py-3">
                      <span className="badge-olive">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{log.description || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
