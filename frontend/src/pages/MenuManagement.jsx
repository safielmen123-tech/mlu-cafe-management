import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChefHat, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { apiFetch } from '../services/apiClient'
import { cacheMenuItems, getInventoryFallback, getMenuFallback } from '../utils/offlineFallbacks'
import RecipeModal from '../components/menu/RecipeModal'
import MenuItemImage from '../components/menu/MenuItemImage'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

const CATEGORIES = ['Coffee', 'Bakery', 'Cold Drinks', 'Food']
const EMOJI_OPTIONS = ['☕', '🥛', '🧊', '🍫', '🥐', '🧁', '🍰', '🍌', '🫖', '🥤']

function recipeSummaryFromSaved(recipe) {
  const ingredients = recipe?.ingredients || []
  return {
    count: ingredients.length,
    preview: ingredients.slice(0, 3).map((row) => ({
      name: row.inventoryItemName,
      quantity_required: row.quantity_required,
      unit: row.unit,
    })),
  }
}

export default function MenuManagement() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [isLoadingMenu, setIsLoadingMenu] = useState(true)
  const [usingFallbackMenu, setUsingFallbackMenu] = useState(false)
  const [inventoryStock, setInventoryStock] = useState([])
  const [recipeSummaries, setRecipeSummaries] = useState({})
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [recipeMenuItem, setRecipeMenuItem] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [menuDeleteTarget, setMenuDeleteTarget] = useState(null)

  const [form, setForm] = useState({
    name: '',
    category: 'Coffee',
    price: '',
    emoji: '☕',
    image_url: '',
  })

  const categories = ['All', ...CATEGORIES]

  const fetchRecipeSummaries = () => {
    apiFetch('/menu/recipe-summaries')
      .then(async (res) => {
        if (!res.ok) return {}
        const data = await res.json()
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
      })
      .then(setRecipeSummaries)
      .catch((err) => {
        console.error('Error loading recipe summaries:', err)
        setRecipeSummaries({})
      })
  }

  const fetchMenu = () => {
    apiFetch('/menu')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server status returned ${res.status}`)
        const data = await res.json()
        return Array.isArray(data) ? data : []
      })
      .then((menu) => {
        if (menu.length === 0) {
          setItems(getMenuFallback())
          setUsingFallbackMenu(true)
          return
        }
        cacheMenuItems(menu)
        setItems(menu)
        setUsingFallbackMenu(false)
      })
      .catch((err) => {
        console.error('Error pulling menu from database:', err)
        setItems(getMenuFallback())
        setUsingFallbackMenu(true)
      })
      .finally(() => {
        setIsLoadingMenu(false)
      })
  }

  const fetchInventoryStock = () => {
    apiFetch('/inventory')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server status returned ${res.status}`)
        const data = await res.json()
        return Array.isArray(data) ? data : data?.items || []
      })
      .then(setInventoryStock)
      .catch((err) => {
        console.error('Error loading inventory for recipes:', err)
        setInventoryStock(getInventoryFallback())
      })
  }

  useEffect(() => {
    fetchMenu()
    fetchInventoryStock()
    fetchRecipeSummaries()
  }, [])

  const filtered = items.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleEditClick = (item) => {
    setIsEditing(true)
    setEditingId(item.id)
    setForm({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      emoji: item.emoji || (item.category === 'Coffee' ? '☕' : '🥐'),
      image_url: item.image_url || '',
    })
    setShowDetailsModal(true)
  }

  const openRecipeModal = (item) => {
    setRecipeMenuItem({ id: item.id, name: item.name, price: item.price })
  }

  const handleRecipeSaved = (recipe) => {
    setRecipeSummaries((prev) => ({
      ...prev,
      [recipe.menuItemId]: recipeSummaryFromSaved(recipe),
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.name || !form.price) return

    if (isEditing) {
      try {
        const response = await apiFetch(`/menu/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            price: parseFloat(form.price),
            image_url: form.image_url.trim() || null,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          fetchMenu()
          handleCloseDetailsModal()
        } else {
          alert(data.message || 'Failed to update item')
        }
      } catch (error) {
        console.error('Error updating item:', error)
      }
    } else {
      try {
        const response = await apiFetch('/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            price: parseFloat(form.price),
            image_url: form.image_url.trim() || null,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          fetchMenu()
          const created = data.item
          handleCloseDetailsModal()
          if (created?.id) {
            openRecipeModal({ ...created, emoji: form.emoji })
          }
        } else {
          alert(data.message || 'Failed to save item')
        }
      } catch (error) {
        console.error('Error adding item:', error)
      }
    }
  }

  const handleDeleteItem = async (id) => {
    try {
      const response = await apiFetch(`/menu/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id))
        setRecipeSummaries((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete item')
      }
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const requestDeleteMenuItem = (item) => {
    setMenuDeleteTarget({ id: item.id, name: item.name })
  }

  const confirmDeleteMenuItem = async () => {
    if (!menuDeleteTarget) return
    const { id } = menuDeleteTarget
    setMenuDeleteTarget(null)
    await handleDeleteItem(id)
  }

  const handleCloseDetailsModal = useCallback(() => {
    setShowDetailsModal(false)
    setIsEditing(false)
    setEditingId(null)
    setForm({ name: '', category: 'Coffee', price: '', emoji: '☕', image_url: '' })
  }, [])

  const openAddModal = () => {
    setIsEditing(false)
    setEditingId(null)
    setForm({ name: '', category: 'Coffee', price: '', emoji: '☕', image_url: '' })
    setShowDetailsModal(true)
  }

  const detailsPanelRef = useModalKeyboard({
    isOpen: showDetailsModal && !menuDeleteTarget && !recipeMenuItem,
    onEscape: handleCloseDetailsModal,
    primaryActionMode: 'auto',
  })

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="page-title">{t('nav.menuManagement')}</h3>
          <p className="page-subtitle">Menu pricing and recipes</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add New Item
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </form>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`tab-pill shrink-0 ${
                activeCategory === category ? 'tab-pill-active' : 'tab-pill-inactive'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {usingFallbackMenu && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          Showing offline menu data. Reconnect the backend to sync live items.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item) => {
          const summary = recipeSummaries[item.id]
          const count = summary?.count ?? 0

          return (
            <div
              key={item.id}
              className="surface-card flex flex-col p-5 transition-colors hover:border-olive-300"
            >
              <div className="flex items-start justify-between gap-2">
                <MenuItemImage
                  imageUrl={item.image_url}
                  alt={item.name}
                  className="h-14 w-14 shrink-0 rounded-2xl border border-slate-100 object-cover ring-1 ring-border dark:border-zinc-800"
                />
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <span className="badge-olive mr-1">{item.category}</span>
                  <button
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="rounded-full p-2 text-olive-400 transition hover:bg-olive-50 hover:text-forest-600 dark:hover:bg-olive-900/40 dark:hover:text-forest-300"
                    title="Edit item details"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openRecipeModal(item)}
                    className="rounded-full p-2 text-olive-400 transition hover:bg-olive-50 hover:text-forest-600 dark:hover:bg-olive-900/40 dark:hover:text-forest-300"
                    title="Manage recipe"
                  >
                    <ChefHat className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDeleteMenuItem(item)}
                    className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h4 className="text-heading mt-4 text-lg">{item.name}</h4>
              <p className="mt-1 text-2xl font-bold text-forest-600 dark:text-forest-400">
                ${Number(item.price).toFixed(2)}
              </p>

              <div className="mt-auto border-t border-border/30 pt-3">
                {count > 0 ? (
                  <>
                    <p className="text-muted text-xs">
                      {count} ingredient{count === 1 ? '' : 's'} linked
                    </p>
                    {summary.preview?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {summary.preview.map((tag) => (
                          <span
                            key={`${item.id}-${tag.name}-${tag.quantity_required}`}
                            className="rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-medium text-forest-700 ring-1 ring-forest-100 dark:bg-forest-950/40 dark:text-forest-300 dark:ring-forest-800"
                          >
                            {tag.name}{' '}
                            <span className="tabular-nums text-stone-500 dark:text-zinc-400">
                              {tag.quantity_required}
                              {tag.unit}
                            </span>
                          </span>
                        ))}
                        {count > summary.preview.length ? (
                          <span className="text-muted px-1 text-[11px]">+{count - summary.preview.length} more</span>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted text-xs">No ingredients linked</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isLoadingMenu && items.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="surface-card h-40 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoadingMenu && items.length === 0 && (
        <div className="surface-card border-dashed py-12 text-center">
          <p className="text-muted">No menu items loaded. Make sure your backend server is online.</p>
        </div>
      )}

      {items.length > 0 && filtered.length === 0 && (
        <div className="surface-card border-dashed py-12 text-center">
          <p className="text-muted">No items match your search or filter.</p>
        </div>
      )}

      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="modal-backdrop"
            onClick={handleCloseDetailsModal}
          />
          <div
            ref={detailsPanelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="modal-panel relative z-10 max-w-lg p-6 outline-none"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-heading text-lg">
                {isEditing ? 'Modify Menu Item' : 'Add New Menu Item'}
              </h3>
              <button
                type="button"
                onClick={handleCloseDetailsModal}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-olive-100 dark:hover:bg-olive-900/40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="item-name" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Item Name
                </label>
                <input
                  id="item-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Caramel Macchiato"
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="item-category" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                    Category
                  </label>
                  <select
                    id="item-category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input-field"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="item-price" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                    Price ($)
                  </label>
                  <input
                    id="item-price"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="item-image-url" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Image URL / Path
                </label>
                <div className="flex items-start gap-4">
                  <input
                    id="item-image-url"
                    type="text"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="/menu-images/espresso.jpg"
                    className="input-field min-w-0 flex-1"
                  />
                  <MenuItemImage
                    imageUrl={form.image_url}
                    alt={form.name ? `${form.name} preview` : 'Menu item preview'}
                    className="h-20 w-20 shrink-0 rounded-xl border border-slate-100 object-cover dark:border-zinc-800"
                    fallbackClassName="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
                  />
                </div>
                <p className="text-muted mt-1.5 text-xs">
                  Place files in <code className="text-xs">frontend/public/menu-images/</code> and use
                  paths like <code className="text-xs">/menu-images/your-photo.jpg</code>.
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-stone-700 dark:text-zinc-300">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm({ ...form, emoji })}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition ${
                        form.emoji === emoji
                          ? 'bg-forest-500 ring-2 ring-forest-300 dark:bg-forest-600'
                          : 'bg-olive-50 hover:bg-olive-100 dark:bg-olive-950/30 dark:hover:bg-olive-900/40'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseDetailsModal} className="btn-secondary flex-1 py-2.5 text-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">
                  {isEditing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RecipeModal
        open={Boolean(recipeMenuItem)}
        menuItem={recipeMenuItem}
        inventoryStock={inventoryStock}
        onClose={() => setRecipeMenuItem(null)}
        onSaved={handleRecipeSaved}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(menuDeleteTarget)}
        title="Delete menu item?"
        message="This will permanently remove the item from your menu. This action cannot be undone."
        itemName={menuDeleteTarget?.name}
        onCancel={() => setMenuDeleteTarget(null)}
        onConfirm={confirmDeleteMenuItem}
        confirmLabel="Yes, Delete"
      />
    </div>
  )
}
