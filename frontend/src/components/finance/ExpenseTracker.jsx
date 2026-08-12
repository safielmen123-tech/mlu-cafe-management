import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { apiFetch } from '../../services/apiClient'
import { useModalKeyboard } from '../../hooks/useModalKeyboard'

const EXPENSE_CATEGORIES = [
  'Inventory Restock',
  'Daily Overhead',
  'Utilities',
  'Staff / Payroll',
  'Maintenance',
  'Other',
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function ExpenseTracker({ days = 365 }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
    expense_date: todayIso(),
  })

  const panelRef = useModalKeyboard({
    isOpen: showForm,
    onEscape: () => setShowForm(false),
    primaryActionMode: 'never',
  })

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/expenses?days=${days}`)
      if (!res.ok) throw new Error('Failed to load expenses')
      const data = await res.json()
      setExpenses(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Could not load spending records.')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const totalSpending = useMemo(
    () => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          expense_date: form.expense_date,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to save expense')
      setShowForm(false)
      setForm({
        category: EXPENSE_CATEGORIES[0],
        description: '',
        amount: '',
        expense_date: todayIso(),
      })
      await loadExpenses()
    } catch (err) {
      setError(err.message || 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete expense')
      setExpenses((prev) => prev.filter((row) => row.id !== id))
    } catch (err) {
      setError(err.message || 'Failed to delete expense')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-heading text-base font-semibold">Expense / Spending</h4>
          <p className="text-muted text-sm">
            Log restocks and overheads · Total ${totalSpending.toFixed(2)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="table-divider">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Loading expenses…
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No spending logged yet.
                </td>
              </tr>
            ) : (
              expenses.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-4 py-3 tabular-nums text-muted">{row.expense_date}</td>
                  <td className="px-4 py-3 font-medium text-heading">{row.category}</td>
                  <td className="px-4 py-3 text-muted">{row.description || '—'}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-heading">
                    ${Number(row.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-muted">{row.created_by_name || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="modal-backdrop"
            onClick={() => setShowForm(false)}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="surface-card relative z-10 w-full max-w-md p-6 shadow-xl"
          >
            <h5 className="text-heading text-lg font-semibold">Log Expense</h5>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input-field"
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Amount ($)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Weekly milk restock"
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1 py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                  {saving ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
