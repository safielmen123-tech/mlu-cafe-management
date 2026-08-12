import { useCallback, useEffect, useState } from 'react'
import { ChefHat, Plus, Trash2, X } from 'lucide-react'
import { apiFetch } from '../../services/apiClient'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'
import { useModalKeyboard } from '../../hooks/useModalKeyboard'

const RECIPE_UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', 'pcs']

const emptyRow = () => ({
  inventory_item_id: '',
  inventoryItemName: '',
  quantity_required: '',
  unit: 'g',
  isNew: true,
})

function defaultStockUnit(stock) {
  const raw = stock?.unit || stock?.unit_label || 'pcs'
  if (String(raw).toLowerCase() === 'l') return 'L'
  return raw
}

function formatInventoryOptionLabel(stock) {
  const unit = defaultStockUnit(stock)
  return `${stock.item_name} (${unit})`
}

export default function RecipeModal({ open, menuItem, inventoryStock = [], onClose, onSaved }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const stockOptions = Array.isArray(inventoryStock) ? inventoryStock : []
  const menuItemId = menuItem?.id

  const loadRecipe = useCallback(async () => {
    if (!menuItemId) return
    setLoading(true)
    setLoadError(null)
    setRows([])
    try {
      const response = await apiFetch(`/menu/${menuItemId}/recipe`)
      if (!response.ok) {
        let message = 'Could not load recipe'
        try {
          const body = await response.json()
          message = body.message || message
        } catch {
          /* non-JSON error body */
        }
        setLoadError(message)
        return
      }
      const data = await response.json()
      const mapped = (data.ingredients || []).map((row) => ({
        inventory_item_id: String(row.inventory_item_id),
        inventoryItemName: row.inventoryItemName || '',
        quantity_required: String(row.quantity_required),
        unit: row.unit === 'l' ? 'L' : row.unit || 'g',
        isNew: false,
      }))
      setRows(mapped)
    } catch (error) {
      console.error('Failed to load recipe:', error)
      setLoadError('Could not load recipe')
    } finally {
      setLoading(false)
    }
  }, [menuItemId])

  useEffect(() => {
    if (open && menuItemId) {
      loadRecipe()
    }
  }, [open, menuItemId, loadRecipe])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const panelRef = useModalKeyboard({
    isOpen: open && !removeTarget && !loading,
    onEscape: handleClose,
    primaryActionMode: 'auto',
  })

  if (!open || !menuItem) return null

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        if (field === 'inventory_item_id') {
          const stock = stockOptions.find((s) => String(s.id) === String(value))
          return {
            ...row,
            inventory_item_id: value,
            inventoryItemName: stock?.item_name || '',
            unit: stock ? defaultStockUnit(stock) : row.unit,
            isNew: false,
          }
        }
        return { ...row, [field]: value }
      }),
    )
  }

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const requestRemoveRow = (index) => {
    const row = rows[index]
    if (!row.inventory_item_id) {
      removeRow(index)
      return
    }
    setRemoveTarget({ index, row })
  }

  const confirmRemoveRow = () => {
    if (removeTarget == null) return
    removeRow(removeTarget.index)
    setRemoveTarget(null)
  }

  const removeConfirmMessage = () => {
    if (!removeTarget || !menuItem) return ''
    const { row } = removeTarget
    const name = row.inventoryItemName || 'this ingredient'
    const qty =
      row.quantity_required !== '' && row.quantity_required != null
        ? ` (${row.quantity_required}${row.unit})`
        : ''
    return `Remove ${name}${qty} from ${menuItem.name} recipe?`
  }

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()])
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const ingredients = rows
      .filter((row) => row.inventory_item_id && row.quantity_required)
      .map((row) => ({
        inventory_item_id: Number(row.inventory_item_id),
        quantity_required: Number.parseFloat(row.quantity_required),
        unit: row.unit === 'L' ? 'l' : row.unit,
      }))
      .filter((row) => row.inventory_item_id && row.quantity_required > 0)

    setSaving(true)
    try {
      const response = await apiFetch(`/menu/${menuItem.id}/recipe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        alert(data.message || 'Failed to save recipe')
        return
      }
      if (data.recipe) {
        const mapped = (data.recipe.ingredients || []).map((row) => ({
          inventory_item_id: String(row.inventory_item_id),
          inventoryItemName: row.inventoryItemName || '',
          quantity_required: String(row.quantity_required),
          unit: row.unit === 'l' ? 'L' : row.unit || 'g',
          isNew: false,
        }))
        setRows(mapped)
        onSaved?.(data.recipe)
      }
    } catch (error) {
      console.error('Error saving recipe:', error)
      alert('Failed to save recipe')
    } finally {
      setSaving(false)
    }
  }

  const usedIds = new Set(rows.map((r) => r.inventory_item_id).filter(Boolean))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close recipe modal"
        className="modal-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="modal-panel relative z-10"
      >
        <div className="modal-panel-body p-6 pb-3">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ChefHat className="h-5 w-5 shrink-0 text-forest-600" />
              <div className="min-w-0">
                <h3 className="text-heading truncate text-lg">{menuItem.name}</h3>
                <p className="text-muted mt-0.5 text-xs">
                  Link raw ingredients and quantities (e.g. 18g Coffee Beans + 150ml Whole Milk). Stock deducts automatically when an order is completed.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-olive-400 hover:bg-olive-50"
              aria-label="Close recipe editor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <p className="text-muted py-12 text-center text-sm">Loading ingredients…</p>
          ) : loadError ? (
            <div className="mt-5 space-y-3 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
              <button type="button" onClick={loadRecipe} className="btn-secondary text-sm">
                Try again
              </button>
            </div>
          ) : (
            <form id="recipe-modal-form" onSubmit={handleSave} className="mt-5 space-y-3">
              <div className="order-menu-scroll max-h-[min(52vh,28rem)] space-y-2 overflow-y-auto pr-1">
              {rows.length === 0 ? (
                <p className="text-muted py-6 text-center text-sm">No ingredients yet.</p>
              ) : (
                rows.map((row, index) => (
                  <div
                    key={`${row.inventory_item_id || 'new'}-${index}`}
                    className="grid items-center gap-2 rounded-2xl border border-border bg-olive-50/50 px-3 py-2.5 dark:bg-obsidian-850 sm:grid-cols-[1fr_88px_72px_36px]"
                  >
                    {row.isNew || !row.inventoryItemName ? (
                      <select
                        value={row.inventory_item_id}
                        onChange={(e) => updateRow(index, 'inventory_item_id', e.target.value)}
                        className="input-field py-2 text-sm"
                        required
                      >
                        <option value="">Choose ingredient…</option>
                        {stockOptions.map((stock) => (
                          <option
                            key={stock.id}
                            value={stock.id}
                            disabled={usedIds.has(String(stock.id)) && String(stock.id) !== String(row.inventory_item_id)}
                          >
                            {formatInventoryOptionLabel(stock)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-heading truncate text-sm font-medium">{row.inventoryItemName}</p>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Qty"
                      value={row.quantity_required}
                      onChange={(e) => updateRow(index, 'quantity_required', e.target.value)}
                      className="input-field py-2 text-sm tabular-nums"
                      required={Boolean(row.inventory_item_id)}
                    />
                    <select
                      value={row.unit}
                      onChange={(e) => updateRow(index, 'unit', e.target.value)}
                      className="input-field py-2 text-sm"
                    >
                      {RECIPE_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => requestRemoveRow(index)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove ingredient"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 dark:text-forest-400"
              >
                <Plus className="h-4 w-4" />
                Add Ingredient
              </button>
            </form>
          )}
        </div>

        {!loading && !loadError && (
          <div className="modal-panel-footer flex gap-3 px-6 pb-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              form="recipe-modal-form"
              disabled={saving}
              className="btn-primary flex-1 text-sm disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Recipe'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(removeTarget)}
        title="Remove ingredient?"
        message={removeConfirmMessage()}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemoveRow}
        confirmLabel="Yes, Delete"
      />
    </div>
  )
}
