import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, PackagePlus, Scale, Search, X } from 'lucide-react'
import { apiFetch } from '../services/apiClient'
import { cacheInventoryItems, getInventoryFallback } from '../utils/offlineFallbacks'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

const statusStyles = {
  'In Stock':
    'border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30 ring-1 ring-emerald-500/30',
  'Low Stock':
    'bg-amber-500/10 text-amber-900 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30 ring-1',
  'Very Low Stock':
    'bg-red-500/10 text-red-900 ring-red-500/30 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30 ring-1',
  'Out of Stock':
    'bg-red-500/10 text-red-900 ring-red-500/30 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30 ring-1',
}

const barColors = {
  'In Stock': 'from-emerald-500 to-teal-500',
  'Low Stock': 'from-amber-400 to-amber-500',
  'Very Low Stock': 'from-red-500 to-red-600',
  'Out of Stock': 'from-red-400 to-red-500',
}

const STATUS_I18N_KEYS = {
  'In Stock': 'statuses.inStock',
  'Low Stock': 'statuses.lowStock',
  'Very Low Stock': 'statuses.veryLowStock',
  'Out of Stock': 'statuses.outOfStock',
}

function getStatus(item) {
  const stock = Number(item.stock_quantity)
  if (stock === 0) return 'Out of Stock'
  if (item.critical_threshold != null && stock <= Number(item.critical_threshold)) return 'Very Low Stock'
  if (stock <= Number(item.low_threshold)) return 'Low Stock'
  return 'In Stock'
}

function clampStock(value, maxStock) {
  return Math.max(0, Math.min(maxStock, value))
}

function formatAmount(value, isWeight) {
  const num = Number(value)
  return isWeight ? Number(num.toFixed(1)) : Math.round(num)
}

function formatStockDisplay(item) {
  const current = formatAmount(item.stock_quantity, item.is_weight)
  const max = formatAmount(item.max_stock, item.is_weight)
  return `${current} / ${max} ${item.unit_label}`
}

function getFillPercent(item) {
  return Math.min(100, (Number(item.stock_quantity) / Number(item.max_stock)) * 100)
}

function StockGauge({ item }) {
  const status = getStatus(item)
  const fill = getFillPercent(item)

  return (
    <div className="min-w-[10rem]">
      <p className="text-heading text-sm font-semibold tabular-nums">{formatStockDisplay(item)}</p>
      <div className="mt-2 h-2 w-full max-w-[9rem] overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${barColors[status]}`}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  )
}

function InventoryTable({ items, onRestock, isLoading }) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-2 px-6 py-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-200/70 dark:bg-zinc-700/50" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-muted text-sm">{t('inventory.noMatches')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-6 py-3">{t('inventory.itemName')}</th>
            <th className="px-6 py-3">{t('common.category')}</th>
            <th className="px-6 py-3">{t('inventory.stockOnHand')}</th>
            <th className="px-6 py-3">{t('inventory.unit')}</th>
            <th className="px-6 py-3">{t('common.status')}</th>
            <th className="px-6 py-3">{t('common.action')}</th>
          </tr>
        </thead>
        <tbody className="table-divider">
          {items.map((item) => {
            const status = getStatus(item)
            return (
              <tr key={item.id} className="table-row">
                <td className="text-heading px-6 py-4 font-semibold">
                  <span>{item.item_name}</span>
                </td>
                <td className="table-cell-muted px-6 py-4">{item.category}</td>
                <td className="px-6 py-4">
                  <StockGauge item={item} />
                </td>
                <td className="table-cell-muted px-6 py-4">
                  {item.unit_label}
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors duration-300 ${statusStyles[status]}`}>
                    {t(STATUS_I18N_KEYS[status])}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => onRestock(item)}
                    className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    {t('inventory.restock')}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RestockModal({ item, onClose, onSave }) {
  const { t } = useTranslation()
  const [quantityToAdd, setQuantityToAdd] = useState('')
  const [stockOverride, setStockOverride] = useState('')
  const [error, setError] = useState('')
  const units = item.unit_label
  const step = item.is_weight ? 0.1 : 1

  const panelRef = useModalKeyboard({
    isOpen: Boolean(item),
    onEscape: onClose,
    primaryActionMode: 'auto',
  })

  const currentStock = Number(item.stock_quantity)
  const maxStock = Number(item.max_stock)

  const previewStock = (() => {
    if (stockOverride.trim() !== '') {
      const value = Number(stockOverride)
      if (!Number.isNaN(value)) return clampStock(value, maxStock)
    } else if (quantityToAdd.trim() !== '') {
      const value = Number(quantityToAdd)
      if (!Number.isNaN(value)) return clampStock(currentStock + value, maxStock)
    }
    return currentStock
  })()

  const previewItem = { ...item, stock_quantity: previewStock }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    const hasOverride = stockOverride.trim() !== ''
    const hasQuantity = quantityToAdd.trim() !== ''

    if (!hasOverride && !hasQuantity) {
      setError(t('inventory.amountRequired'))
      return
    }

    const nextStock = hasOverride
      ? Number(stockOverride)
      : currentStock + Number(quantityToAdd)

    if (Number.isNaN(nextStock) || nextStock < 0) {
      setError(t('inventory.invalidAmount'))
      return
    }

    onSave(item.id, clampStock(nextStock, maxStock))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="modal-backdrop" onClick={onClose} />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="modal-panel relative z-10 w-full max-w-md p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-heading text-lg">{t('inventory.restockItem')}</h3>
            <p className="text-muted mt-1 text-sm">
              {t('inventory.adjustStockFor', { item: item.item_name })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-stone-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="surface-inset mt-5 space-y-3 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-muted text-xs">{t('inventory.currentOnHand')}</p>
              <p className="text-heading text-lg font-bold tabular-nums">{formatStockDisplay(item)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted text-xs">{t('inventory.afterUpdate')}</p>
              <p className="text-lg font-bold tabular-nums text-forest-600 dark:text-forest-400">{formatStockDisplay(previewItem)}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="quantity-to-add" className="mb-1.5 block text-sm font-medium">
              {t('inventory.enterUnitsToAdd', { units })}
            </label>
            <input
              id="quantity-to-add"
              type="number"
              min="0"
              step={step}
              value={quantityToAdd}
              onChange={(e) => { setQuantityToAdd(e.target.value); setStockOverride(''); setError(''); }}
              placeholder={item.is_weight ? t('inventory.weightPlaceholder') : t('inventory.countPlaceholder')}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="stock-override" className="mb-1.5 block text-sm font-medium">
              {t('inventory.setCurrentCount', { units })}{' '}
              <span className="font-normal text-stone-400">{t('common.optional')}</span>
            </label>
            <input
              id="stock-override"
              type="number"
              min="0"
              step={step}
              value={stockOverride}
              onChange={(e) => { setStockOverride(e.target.value); setQuantityToAdd(''); setError(''); }}
              placeholder={t('inventory.currentPlaceholder', {
                amount: formatAmount(item.stock_quantity, item.is_weight),
                units,
              })}
              className="input-field"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">{t('common.cancel')}</button>
            <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">{t('inventory.updateStock')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InventoryStock() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [usingFallbackInventory, setUsingFallbackInventory] = useState(false)
  const [search, setSearch] = useState('')
  const [restockItem, setRestockItem] = useState(null)

  const fetchInventory = useCallback(async () => {
    try {
      const response = await apiFetch('/inventory')
      if (!response.ok) {
        throw new Error(`Server status returned ${response.status}`)
      }
      const data = await response.json()
      const nextItems = Array.isArray(data) ? data : data.items || []
      if (nextItems.length === 0) {
        setItems(getInventoryFallback())
        setUsingFallbackInventory(true)
        return
      }
      cacheInventoryItems(nextItems)
      setItems(nextItems)
      setUsingFallbackInventory(false)
    } catch (error) {
      console.error('Error loading inventory layout:', error)
      setItems(getInventoryFallback())
      setUsingFallbackInventory(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const handleSaveRestock = async (id, newStock) => {
    try {
      const response = await apiFetch(`/inventory/${id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_quantity: newStock })
      })
      if (response.ok) fetchInventory()
    } catch (error) {
      console.error("Error submitting stock update:", error)
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.item_name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  )

  const countableItems = filteredItems.filter((item) => item.section === 'countable')
  const uncountableItems = filteredItems.filter((item) => item.section === 'uncountable')

  return (
    <div className="space-y-8">
      {usingFallbackInventory && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          {t('inventory.offlineData')}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-heading text-lg">{t('nav.inventoryStock')}</h3>
        </div>
        <div className="relative max-w-xs flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      <section className="table-shell">
        <div className="flex items-start gap-3 border-b px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive-100 dark:bg-olive-900/40">
            <Package className="h-5 w-5 text-forest-600 dark:text-forest-400" />
          </div>
          <div>
            <h4 className="text-heading text-base font-semibold">{t('inventory.countableTitle')}</h4>
            <p className="text-muted mt-0.5 text-sm">{t('inventory.countableDescription')}</p>
          </div>
        </div>
        <InventoryTable items={countableItems} onRestock={setRestockItem} isLoading={isLoading} />
      </section>

      <section className="table-shell">
        <div className="flex items-start gap-3 border-b px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive-100 dark:bg-olive-900/40">
            <Scale className="h-5 w-5 text-forest-600 dark:text-forest-400" />
          </div>
          <div>
            <h4 className="text-heading text-base font-semibold">{t('inventory.uncountableTitle')}</h4>
            <p className="text-muted mt-0.5 text-sm">{t('inventory.uncountableDescription')}</p>
          </div>
        </div>
        <InventoryTable items={uncountableItems} onRestock={setRestockItem} isLoading={isLoading} />
      </section>

      {restockItem && (
        <RestockModal
          item={restockItem}
          onClose={() => setRestockItem(null)}
          onSave={handleSaveRestock}
        />
      )}
    </div>
  )
}
