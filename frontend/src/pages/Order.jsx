import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  Minus,
  Plus,
  Receipt,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { usePOS } from '../context/POSContext'
import { apiFetch } from '../services/apiClient'
import { cacheMenuItems, getMenuFallback } from '../utils/offlineFallbacks'

import MenuItemImage from '../components/menu/MenuItemImage'

const CATEGORY_FILTERS = ['All', 'Coffee', 'Bakery', 'Cold Drinks', 'Food']

export default function Order() {
  const { t } = useTranslation()
  const { assignmentTargets, assignOrder } = usePOS()
  const [menuItems, setMenuItems] = useState([])
  const [usingFallbackMenu, setUsingFallbackMenu] = useState(false)
  const [cart, setCart] = useState([])
  const [selectedDestination, setSelectedDestination] = useState('')
  const [sentConfirmation, setSentConfirmation] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    apiFetch('/menu')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server status returned ${res.status}`)
        const data = await res.json()
        return Array.isArray(data) ? data : []
      })
      .then((items) => {
        if (items.length === 0) {
          setMenuItems(getMenuFallback())
          setUsingFallbackMenu(true)
          return
        }
        cacheMenuItems(items)
        setMenuItems(items)
        setUsingFallbackMenu(false)
      })
      .catch((err) => {
        console.error('Error pulling menu for ordering page:', err)
        setMenuItems(getMenuFallback())
        setUsingFallbackMenu(true)
      })
  }, [])

  const filteredMenuItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return menuItems.filter((item) => {
      const matchesCategory =
        activeCategory === 'All' ||
        String(item.category || '').toLowerCase() === activeCategory.toLowerCase()
      const matchesSearch =
        !query ||
        String(item.name || '')
          .toLowerCase()
          .includes(query) ||
        String(item.category || '')
          .toLowerCase()
          .includes(query)
      return matchesCategory && matchesSearch
    })
  }, [menuItems, activeCategory, searchQuery])

  const addToCart = (item) => {
    setSentConfirmation(null)
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const updateQuantity = (id, delta) => {
    setSentConfirmation(null)
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const clearCart = () => {
    setCart([])
    setSentConfirmation(null)
  }

  const handleSendOrder = () => {
    if (!selectedDestination || cart.length === 0) return

    const target = assignmentTargets.find((t) => String(t.id) === selectedDestination)
    const success = assignOrder(
      target?.isTakeOut ? 'takeout' : Number(selectedDestination),
      cart,
    )

    if (success) {
      setSentConfirmation(target?.name ?? 'Table')
      setCart([])
      setSelectedDestination('')
      setTimeout(() => setSentConfirmation(null), 2500)
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const destinationLabel =
    assignmentTargets.find((t) => String(t.id) === selectedDestination)?.name ?? null

  return (
    <div className="flex h-[calc(100vh-5rem)] min-h-0 flex-col overflow-hidden page-enter">
      <div className="mb-6 shrink-0">
        <h3 className="page-title">{t('nav.order')}</h3>
        <p className="page-subtitle">Build orders and send them to tables or take out</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
        {/* ITEMS SELECTION GRID */}
        <div className="surface-panel flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm">
          <div className="shrink-0 space-y-4 border-b border-slate-100 px-5 py-5 dark:border-zinc-800">
            <div>
              <h3 className="text-heading font-semibold">Select Items</h3>
              <p className="text-muted text-sm">Tap a card to add it to the current order</p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu..."
                className="w-full rounded-xl border border-slate-100 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_FILTERS.map((category) => {
                const isActive = activeCategory === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={
                      isActive
                        ? 'shrink-0 rounded-full bg-[#10b981] px-4 py-1.5 text-sm font-medium text-white shadow-sm'
                        : 'shrink-0 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="order-menu-scroll min-h-0 flex-1 overflow-y-auto p-4 pb-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left transition-all hover:border-emerald-500/50 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900"
                >
                  <div className="flex justify-center">
                    <MenuItemImage
                      imageUrl={item.image_url}
                      alt={item.name}
                      className="h-16 w-16 rounded-xl border border-slate-100 object-cover dark:border-zinc-800"
                    />
                  </div>

                  <div className="mt-3 min-w-0 text-center">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                      {item.category}
                    </p>
                  </div>

                  <p className="mt-2 text-center text-base font-bold text-[#10b981]">
                    ${Number(item.price).toFixed(2)}
                  </p>
                </button>
              ))}

              {usingFallbackMenu && menuItems.length > 0 && (
                <div className="col-span-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
                  Showing offline menu data. Reconnect the backend to sync live items.
                </div>
              )}

              {menuItems.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
                  No items loaded. Make sure your backend server is online!
                </div>
              )}

              {menuItems.length > 0 && filteredMenuItems.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
                  No items match your search or category filter.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CURRENT ORDER SIDEBAR PANEL */}
        <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:w-[26rem] lg:shrink-0">
          <div className="shrink-0 border-b border-slate-100 px-5 py-5 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-heading font-semibold">Current Order</h3>
                <p className="text-muted text-sm">{cart.length} item line(s)</p>
              </div>
              {cart.length > 0 && !sentConfirmation && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                  aria-label="Clear cart"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="order-menu-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {sentConfirmation ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-8 w-8 text-[#10b981]" />
                </div>
                <p className="text-heading mt-4 text-lg font-semibold">Sent to {sentConfirmation}</p>
                <p className="text-muted mt-1 text-sm">Order added to the active bill</p>
              </div>
            ) : cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-zinc-500">
                <Receipt className="mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">No items in cart yet</p>
                <p className="mt-1 text-xs">Select items from the grid to begin</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-zinc-100">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[#10b981]">
                      ${Number(item.price).toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[1.75rem] text-center text-base font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {!sentConfirmation && (
            <div className="mt-auto shrink-0 border-t border-slate-100 p-5 dark:border-zinc-800">
              <div className="space-y-2 text-sm select-none">
                <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                  <span>Tax (10%)</span>
                  <span className="tabular-nums">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-semibold text-slate-900 dark:border-zinc-800 dark:text-zinc-100">
                  <span>Running Total</span>
                  <span className="tabular-nums text-[#10b981]">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="table-destination"
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  <UtensilsCrossed className="h-4 w-4 text-[#10b981]" />
                  Table Assignment
                </label>
                <select
                  id="table-destination"
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="input-field rounded-xl"
                >
                  <option value="">Select table or take out...</option>
                  <optgroup label="Dining Tables">
                    {assignmentTargets
                      .filter((t) => !t.isTakeOut)
                      .map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                          {table.status !== 'empty' ? ` (${table.status.replace('_', ' ')})` : ''}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Take Out">
                    <option value="takeout">
                      Take Out
                      {assignmentTargets.find((t) => t.isTakeOut)?.status !== 'empty'
                        ? ' (active ticket)'
                        : ''}
                    </option>
                  </optgroup>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSendOrder}
                disabled={cart.length === 0 || !selectedDestination}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#10b981] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {destinationLabel ? `Send to ${destinationLabel}` : 'Confirm Order'}
              </button>

              <p className="mt-3 text-center text-xs text-slate-400 dark:text-zinc-500">
                Payment is processed from the Table view after service.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
