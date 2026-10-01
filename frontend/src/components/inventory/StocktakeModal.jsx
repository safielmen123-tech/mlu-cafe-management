import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import Modal from '../common/Modal'
import { apiFetch, saveBlobAsDownload } from '../../services/apiClient'

const WHOLE_UNITS = new Set(['bottles', 'bottle', 'cans', 'can', 'eggs', 'egg', 'coconuts', 'coconut', 'tea bags', 'tea bag'])

function formatAmount(value, isWeight) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  const exact = Math.round(num * 1000) / 1000
  if (!isWeight && Number.isInteger(exact)) return exact
  return exact
}

function allowsDecimal(item) {
  if (Number(item.is_weight) === 1) return true
  const unit = String(item.unit_label || '').trim().toLowerCase()
  // Condensed Milk (and similar) may be fractional cans after open-can recipes.
  if (unit === 'cans' || unit === 'can') return true
  return !WHOLE_UNITS.has(unit)
}

function parseField(text, item) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return { value: null }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: 'number' }
  const amount = Math.round(Number(trimmed) * 1000) / 1000
  if (!Number.isFinite(amount) || amount < 0) return { error: 'number' }
  if (!allowsDecimal(item) && !Number.isInteger(amount)) return { error: 'whole' }
  return { value: amount }
}

function isLarge(before, after) {
  if (before === after) return false
  if (before === 0) return after !== 0
  return Math.abs(after - before) / Math.abs(before) > 0.5
}

function sectionRank(section) {
  if (section === 'countable') return 0
  if (section === 'uncountable') return 1
  return 2
}

export default function StocktakeModal({ items, onClose, onApplied }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [counted, setCounted] = useState({})
  const [maximums, setMaximums] = useState({})
  const [step, setStep] = useState('edit')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const rows = useMemo(() => {
    return items
      .filter((item) => !item.archived)
      .slice()
      .sort((a, b) => (
        sectionRank(a.section) - sectionRank(b.section)
        || String(a.category).localeCompare(String(b.category))
        || String(a.item_name).localeCompare(String(b.item_name))
      ))
  }, [items])

  const visible = rows.filter((item) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return item.item_name.toLowerCase().includes(query) || String(item.category).toLowerCase().includes(query)
  })

  const review = useMemo(() => {
    const changes = []
    let fieldError = ''
    for (const item of rows) {
      const count = parseField(counted[item.id], item)
      const max = parseField(maximums[item.id], item)
      if (count.error || max.error) {
        const kind = count.error || max.error
        fieldError = kind === 'whole'
          ? t('inventory.wholeNumber', { unit: item.unit_label })
          : `${item.item_name}: ${t('inventory.numberRequired')}`
        break
      }
      const before = formatAmount(item.stock_quantity, item.is_weight)
      const maxBefore = formatAmount(item.max_stock, item.is_weight)
      const countChanged = count.value != null && count.value !== before
      const maxChanged = max.value != null && max.value !== maxBefore
      if (!countChanged && !maxChanged) continue
      changes.push({
        id: item.id,
        name: item.item_name,
        unit: item.unit_label,
        before,
        after: countChanged ? count.value : before,
        difference: Math.round(((countChanged ? count.value : before) - before) * 1000) / 1000,
        maxBefore,
        maxAfter: maxChanged ? max.value : maxBefore,
        large: countChanged && isLarge(before, count.value),
        counted: counted[item.id] ?? '',
        max: maximums[item.id] ?? '',
      })
    }
    changes.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    return {
      fieldError,
      changes,
      blank: rows.length - changes.length,
      large: changes.filter((row) => row.large),
    }
  }, [rows, counted, maximums, t])

  const openSummary = () => {
    if (review.fieldError) {
      setError(review.fieldError)
      return
    }
    if (review.changes.length === 0) {
      setError(t('inventory.rowsChanged', { count: 0 }))
      return
    }
    setError('')
    setStep('summary')
  }

  const apply = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await apiFetch('/inventory/stocktake', {
        method: 'POST',
        body: JSON.stringify({
          confirmLarge: review.large.length > 0,
          rows: review.changes.map((row) => ({
            id: row.id,
            counted: row.counted,
            max: row.max,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('inventory.invalidAmount'))
      setResult(data)
      setStep('done')
      onApplied()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const download = async () => {
    if (!result) return
    setError('')
    try {
      const response = await apiFetch('/inventory/stocktake/excel', {
        method: 'POST',
        body: JSON.stringify({ note: result.note, changed: result.changed }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || t('inventory.invalidAmount'))
      }
      const blob = await response.blob()
      const match = /filename="?([^"]+)"?/.exec(response.headers.get('Content-Disposition') || '')
      saveBlobAsDownload(blob, match?.[1] || 'Stocktake.xlsx')
    } catch (err) {
      setError(err.message)
    }
  }

  const fields = (item) => (
    <>
      <label className="block text-sm">
        <span className="text-muted">{t('inventory.countedQuantity')}</span>
        <input
          value={counted[item.id] ?? ''}
          onChange={(event) => setCounted((current) => ({ ...current, [item.id]: event.target.value }))}
          inputMode={allowsDecimal(item) ? 'decimal' : 'numeric'}
          className="input-field mt-1"
          aria-label={`${item.item_name} ${t('inventory.countedQuantity')}`}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">{t('inventory.newMaximum')} ({t('inventory.optional')})</span>
        <input
          value={maximums[item.id] ?? ''}
          onChange={(event) => setMaximums((current) => ({ ...current, [item.id]: event.target.value }))}
          inputMode={allowsDecimal(item) ? 'decimal' : 'numeric'}
          className="input-field mt-1"
          aria-label={`${item.item_name} ${t('inventory.newMaximum')}`}
        />
      </label>
    </>
  )

  return (
    <Modal
      title={step === 'done' ? t('inventory.stocktakeComplete') : t('inventory.stocktakeTitle')}
      onClose={onClose}
      closeLabel={t('a11y.close')}
      dismissible={!saving}
      maxWidth="max-w-4xl"
      footer={step === 'edit' ? (
        <>
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2.5 text-sm">{t('common.cancel')}</button>
          <button type="button" onClick={openSummary} className="btn-primary px-4 py-2.5 text-sm">{t('inventory.applyStocktake')}</button>
        </>
      ) : step === 'summary' ? (
        <>
          <button type="button" onClick={() => setStep('edit')} disabled={saving} className="btn-secondary px-4 py-2.5 text-sm">{t('inventory.backToCounts')}</button>
          <button type="button" onClick={apply} disabled={saving} className="btn-primary px-4 py-2.5 text-sm">
            {review.large.length ? t('inventory.confirmLarge') : t('inventory.applyStocktake')}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={download} className="btn-secondary px-4 py-2.5 text-sm">{t('inventory.downloadStocktake')}</button>
          <button type="button" onClick={onClose} className="btn-primary px-4 py-2.5 text-sm">{t('inventory.closeStocktake')}</button>
        </>
      )}
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {step === 'edit' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('inventory.searchPlaceholder')}
              className="input-field pl-10"
            />
          </div>
          {visible.length === 0 ? <p className="text-muted text-sm">{t('inventory.noMatches')}</p> : null}
          <div className="space-y-3 lg:hidden">
            {visible.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-3">
                <p className="font-medium">{item.item_name}</p>
                <p className="text-muted text-sm">{item.category} · {item.unit_label}</p>
                <p className="mt-1 text-sm tabular-nums">
                  {t('inventory.systemCount')}: {formatAmount(item.stock_quantity, item.is_weight)}
                </p>
                <div className="mt-3 grid gap-3">{fields(item)}</div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-3 py-2">{t('inventory.itemName')}</th>
                  <th className="px-3 py-2">{t('inventory.systemCount')}</th>
                  <th className="px-3 py-2">{t('inventory.countedQuantity')}</th>
                  <th className="px-3 py-2">{t('inventory.newMaximum')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium">{item.item_name}</p>
                      <p className="text-muted text-xs">{item.category} · {item.unit_label}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatAmount(item.stock_quantity, item.is_weight)}</td>
                    <td className="px-3 py-2">
                      <input
                        value={counted[item.id] ?? ''}
                        onChange={(event) => setCounted((current) => ({ ...current, [item.id]: event.target.value }))}
                        inputMode={allowsDecimal(item) ? 'decimal' : 'numeric'}
                        className="input-field"
                        aria-label={`${item.item_name} ${t('inventory.countedQuantity')}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={maximums[item.id] ?? ''}
                        onChange={(event) => setMaximums((current) => ({ ...current, [item.id]: event.target.value }))}
                        inputMode={allowsDecimal(item) ? 'decimal' : 'numeric'}
                        className="input-field"
                        aria-label={`${item.item_name} ${t('inventory.newMaximum')}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {step === 'summary' ? (
        <div className="space-y-4 text-sm">
          <p className="text-muted">{t('inventory.stocktakeSummary')}</p>
          <p>{t('inventory.rowsChanged', { count: review.changes.length })}</p>
          <p>{t('inventory.rowsBlank', { count: review.blank })}</p>
          {review.large.length ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
              {t('inventory.largeWarning')} {review.large.map((row) => row.name).join(', ')}
            </p>
          ) : null}
          <div>
            <p className="font-medium">{t('inventory.largestDifferences')}</p>
            <ul className="mt-2 space-y-1">
              {review.changes.slice(0, 5).map((row) => (
                <li key={row.id} className="tabular-nums">
                  {row.name}: {row.before} → {row.after} {row.unit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {step === 'done' && result ? (
        <div className="space-y-3 text-sm">
          <p>{t('inventory.stocktakeSaved', { count: result.changed.length, blank: result.blank })}</p>
          <ul className="space-y-1">
            {result.changed.map((row) => (
              <li key={row.id} className="tabular-nums">
                {row.name}: {row.before} → {row.after} {row.unit}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  )
}
