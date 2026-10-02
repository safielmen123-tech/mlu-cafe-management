import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import { apiFetch } from '../../services/apiClient'
import { formatOrderDate } from '../../utils/dateTimeFormat'

const EXPENSE_CATEGORIES = ['Inventory Restock', 'Payroll', 'Others']

const CATEGORY_I18N_KEYS = {
  'Inventory Restock': 'expenses.categories.inventoryRestock',
  Payroll: 'expenses.categories.staffPayroll',
  'Staff / Payroll': 'expenses.categories.staffPayroll',
  Others: 'expenses.categories.other',
  Other: 'expenses.categories.other',
}

function categoryLabel(t, category) {
  const key = CATEGORY_I18N_KEYS[category]
  return key ? t(key) : category
}

function todayIso() {
  return formatOrderDate(new Date())
}

/**
 * Quick expense entry used from Stock (next to Stocktake).
 * Saves amount + what it was used for so Dashboard spending/profit stay accurate.
 */
export default function ExpenseLogModal({
  onClose,
  onSaved,
  defaultCategory = 'Inventory Restock',
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    category: defaultCategory,
    description: '',
    amount: '',
    expense_date: todayIso(),
  })

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
      if (!res.ok) throw new Error(data.message || t('expenses.errors.save'))
      onSaved?.(data)
      onClose?.()
    } catch (err) {
      setError(err.message || t('expenses.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      titleId="expense-log-title"
      closeLabel={t('a11y.close')}
      onClose={onClose}
      maxWidth="max-w-md"
      header={(
        <div>
          <h3 id="expense-log-title" className="text-heading text-lg font-semibold">
            {t('expenses.logExpense')}
          </h3>
          <p className="text-muted mt-1 text-sm">{t('inventory.expenseHint')}</p>
        </div>
      )}
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="expense-log-form"
            disabled={saving}
            className="btn-primary flex-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('expenses.save')}
          </button>
        </>
      )}
    >
      <form id="expense-log-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div>
          <label htmlFor="expense-category" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
            {t('common.category')}
          </label>
          <select
            id="expense-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input-field"
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(t, category)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="expense-amount" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
            {t('expenses.amountLabel')}
          </label>
          <input
            id="expense-amount"
            type="number"
            required
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input-field"
            placeholder="30.00"
          />
        </div>

        <div>
          <label htmlFor="expense-date" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
            {t('reservations.date')}
          </label>
          <input
            id="expense-date"
            type="date"
            required
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="expense-description" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
            {t('common.description')}
          </label>
          <input
            id="expense-description"
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('expenses.descriptionPlaceholder')}
            className="input-field"
            maxLength={500}
          />
        </div>
      </form>
    </Modal>
  )
}
