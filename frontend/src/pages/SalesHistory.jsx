import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, Printer, Search } from 'lucide-react'
import ReceiptModal from '../components/pos/ReceiptModal'
import ExpenseTracker from '../components/finance/ExpenseTracker'
import { SalesFilterBar } from '../components/ui/SalesFilterBar'
import { usePOS } from '../context/POSContext'
import { apiFetch } from '../services/apiClient'
import { fetchReceiptTransaction } from '../utils/receiptHelpers'
import {
  buildMonthFilterOptions,
  filterCompletedOrders,
  filterOrdersByMonth,
  formatMonthLabel,
  getCurrentMonthKey,
  summarizeSalesMetrics,
} from '../utils/salesHistoryAnalytics'
import { formatDateTimeDisplay, sortOrdersByDateTime } from '../utils/dateTimeFormat'

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function ElapsedBadge({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return undefined
    const tick = () => setElapsed(Date.now() - startedAt)
    const initial = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [startedAt])

  const isUrgent = elapsed > 5 * 60 * 1000

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        isUrgent
          ? 'bg-red-100 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/60'
          : 'bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {formatElapsed(elapsed)}
    </span>
  )
}

const statusStyles = {
  Completed:
    'border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30 ring-1',
  Refunded:
    'bg-red-500/10 text-red-900 ring-red-500/30 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30 ring-1',
}

const paymentStyles = {
  Cash: 'badge-olive',
  'Bank Scan': 'badge-forest',
}

const kitchenStatusStyles = {
  Pending: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
  Preparing: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/50',
  Ready: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
}

const kitchenNextStatus = {
  Pending: 'Preparing',
  Preparing: 'Ready',
  Ready: null,
}

export default function SalesHistory() {
  const { t } = useTranslation()
  const { salesHistory } = usePOS()
  const [activeTab, setActiveTab] = useState('logs')
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey())
  const [kitchenQueue, setKitchenQueue] = useState([])
  const [kitchenError, setKitchenError] = useState('')
  const [updatingKitchenId, setUpdatingKitchenId] = useState(null)
  const [receiptTransaction, setReceiptTransaction] = useState(null)
  const [printingOrderId, setPrintingOrderId] = useState(null)
  const [receiptError, setReceiptError] = useState('')

  const monthOptions = useMemo(() => buildMonthFilterOptions(12), [])

  const completedHistory = useMemo(
    () => filterCompletedOrders(salesHistory || []),
    [salesHistory],
  )

  const monthScopedHistory = useMemo(
    () => filterOrdersByMonth(completedHistory, selectedMonth),
    [completedHistory, selectedMonth],
  )

  const monthMetrics = useMemo(
    () => summarizeSalesMetrics(monthScopedHistory),
    [monthScopedHistory],
  )

  const filteredLogs = useMemo(() => {
    const searched = monthScopedHistory.filter(
      (order) =>
        (order.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (order.payment || '').toLowerCase().includes(search.toLowerCase()) ||
        (order.status || '').toLowerCase().includes(search.toLowerCase()) ||
        (order.source ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    return sortOrdersByDateTime(searched, 'desc')
  }, [monthScopedHistory, search])

  const loadKitchenQueue = useCallback(async () => {
    try {
      const res = await apiFetch('/orders/kitchen')
      if (!res.ok) throw new Error('Failed to load kitchen queue')
      const data = await res.json()
      setKitchenQueue(Array.isArray(data) ? data : [])
      setKitchenError('')
    } catch (error) {
      console.error(error)
      setKitchenError('Kitchen queue unavailable. Check backend connection.')
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'kitchen') return undefined
    loadKitchenQueue()
    const interval = setInterval(loadKitchenQueue, 4000)
    return () => clearInterval(interval)
  }, [activeTab, loadKitchenQueue])

  const handleKitchenAdvance = async (order) => {
    const next = kitchenNextStatus[order.kitchen_status] || kitchenNextStatus.Pending
    if (!next) return
    setUpdatingKitchenId(order.id)
    try {
      const res = await apiFetch(`/orders/${order.id}/kitchen-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_status: next }),
      })
      if (!res.ok) throw new Error('Failed to update kitchen status')
      await loadKitchenQueue()
    } catch (error) {
      console.error(error)
      setKitchenError('Could not update order status.')
    } finally {
      setUpdatingKitchenId(null)
    }
  }

  const handlePrintReceipt = async (order) => {
    setPrintingOrderId(order.id)
    setReceiptError('')
    try {
      const transaction = await fetchReceiptTransaction(order)
      setReceiptTransaction(transaction)
    } catch (error) {
      console.error('Failed to prepare receipt:', error)
      setReceiptError('Could not load receipt. Please try again.')
    } finally {
      setPrintingOrderId(null)
    }
  }

  const tabs = [
    { id: 'logs', label: t('sales.tabs.logs', { defaultValue: 'Order Logs' }) },
    { id: 'kitchen', label: t('sales.tabs.kitchen', { defaultValue: 'Kitchen Display' }) },
    { id: 'expenses', label: t('sales.tabs.expenses', { defaultValue: 'Expenses' }) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-heading text-lg">{t('nav.salesHistory')}</h3>
          <p className="text-muted text-sm">
            {t('sales.subtitle', {
              defaultValue: 'Review sales, kitchen tickets, and operational spending',
            })}
          </p>
        </div>
        <div className="flex flex-wrap rounded-xl bg-white p-1 ring-1 ring-olive-200/60 dark:bg-obsidian-850 dark:ring-olive-800/40">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-forest-500 text-white shadow-sm dark:bg-forest-600'
                  : 'text-stone-600 hover:bg-mint-50 dark:text-stone-300 dark:hover:bg-obsidian-800'
              }`}
            >
              {tab.label}
              {tab.id === 'kitchen' && kitchenQueue.length > 0 && (
                <span className="ml-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {kitchenQueue.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {receiptError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {receiptError}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="surface-card p-4">
            <SalesFilterBar
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              monthOptions={monthOptions}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="surface-inset rounded-xl px-4 py-3">
                <p className="text-muted text-xs uppercase tracking-wider">
                  {t('sales.period', { defaultValue: 'Period' })}
                </p>
                <p className="text-heading mt-1 text-sm font-semibold">
                  {selectedMonth === 'all' ? 'All months in range' : formatMonthLabel(selectedMonth)}
                </p>
              </div>
              <div className="surface-inset rounded-xl px-4 py-3">
                <p className="text-muted text-xs uppercase tracking-wider">
                  {t('sales.orders', { defaultValue: 'Orders' })}
                </p>
                <p className="text-heading mt-1 text-2xl font-bold tabular-nums">
                  {monthMetrics.ordersFulfilled}
                </p>
              </div>
              <div className="surface-inset rounded-xl px-4 py-3">
                <p className="text-muted text-xs uppercase tracking-wider">
                  {t('sales.grossRevenue', { defaultValue: 'Gross revenue' })}
                </p>
                <p className="text-heading mt-1 text-2xl font-bold tabular-nums text-forest-600 dark:text-forest-400">
                  ${monthMetrics.grossRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="table-shell">
            <div className="border-b border-olive-100/60 p-4 dark:border-olive-800/30">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder={t('sales.searchPlaceholder', {
                    defaultValue: 'Search by invoice, source, payment, or status...',
                  })}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">{t('common.source', { defaultValue: 'Source' })}</th>
                    <th className="px-6 py-3">{t('common.dateTime', { defaultValue: 'Date / Time' })}</th>
                    <th className="px-6 py-3">{t('common.payment', { defaultValue: 'Payment' })}</th>
                    <th className="px-6 py-3">{t('common.total', { defaultValue: 'Total' })}</th>
                    <th className="px-6 py-3">{t('common.status', { defaultValue: 'Status' })}</th>
                    <th className="px-6 py-3 text-right">{t('common.actions', { defaultValue: 'Actions' })}</th>
                  </tr>
                </thead>
                <tbody className="table-divider">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-stone-500 dark:text-zinc-400">
                        {t('sales.emptyLogs', {
                          defaultValue: 'No completed orders found for this month and search filter.',
                        })}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((order) => {
                      const pStyle =
                        paymentStyles[order.payment] ||
                        'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      const sStyle =
                        statusStyles[order.status] ||
                        'bg-stone-50 text-stone-700 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
                      const isPrinting = printingOrderId === order.id

                      return (
                        <tr key={order.id} className="table-row">
                          <td className="px-6 py-4 font-semibold text-forest-600 dark:text-forest-400">
                            {order.id}
                          </td>
                          <td className="px-6 py-4 text-stone-600 dark:text-stone-300">
                            {order.source ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-stone-600 tabular-nums dark:text-stone-300">
                            {formatDateTimeDisplay(order.date, order.time)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`rounded px-2.5 py-1 text-xs font-semibold ${pStyle}`}>
                              {order.payment}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-heading tabular-nums">
                            ${(order.total || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${sStyle}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(order)}
                              disabled={isPrinting}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60 dark:bg-card/30"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              {isPrinting
                                ? t('common.loading', { defaultValue: 'Loading...' })
                                : t('sales.printReceipt', { defaultValue: 'Print Receipt' })}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'kitchen' && (
        <div className="space-y-4">
          {kitchenError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
              {kitchenError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {kitchenQueue.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-olive-300/60 bg-white py-16 text-center dark:border-olive-800/40 dark:bg-obsidian-900">
                <CheckCircle2 className="h-12 w-12 text-forest-400" />
                <p className="text-heading mt-4 text-lg">
                  {t('kitchen.clearTitle', { defaultValue: 'Kitchen is clear!' })}
                </p>
                <p className="text-muted mt-1 text-sm">
                  {t('kitchen.clearBody', { defaultValue: 'New confirmed orders appear here instantly.' })}
                </p>
              </div>
            ) : (
              kitchenQueue.map((order) => {
                const kitchenStatus = order.kitchen_status || 'Pending'
                const next = kitchenNextStatus[kitchenStatus]
                const startedAt = order.created_at
                  ? new Date(order.created_at).getTime()
                  : null
                return (
                  <div
                    key={order.id}
                    className="interactive-card surface-card flex flex-col p-5 hover:border-olive-300/60 dark:hover:border-olive-700/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-forest-600 dark:text-forest-400">
                          #{order.id} · {order.source}
                        </p>
                        <p className="text-heading mt-2 text-base leading-snug">{order.summary}</p>
                      </div>
                      <ElapsedBadge startedAt={startedAt} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          kitchenStatusStyles[kitchenStatus] || kitchenStatusStyles.Pending
                        }`}
                      >
                        {kitchenStatus}
                      </span>
                    </div>
                    {next ? (
                      <button
                        type="button"
                        onClick={() => handleKitchenAdvance(order)}
                        disabled={updatingKitchenId === order.id}
                        className="btn-primary mt-5 w-full py-3 text-sm font-bold active:scale-[0.98] disabled:opacity-60"
                      >
                        {updatingKitchenId === order.id
                          ? t('common.updating', { defaultValue: 'Updating…' })
                          : t('kitchen.markAs', {
                              defaultValue: `Mark as ${next}`,
                              status: next,
                            })}
                      </button>
                    ) : (
                      <p className="mt-5 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                        {t('kitchen.readyHint', { defaultValue: 'Ready for pickup / serve' })}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="surface-card p-5">
          <ExpenseTracker days={365} />
        </div>
      )}

      {receiptTransaction && (
        <ReceiptModal
          transaction={receiptTransaction}
          variant="receipt"
          onClose={() => setReceiptTransaction(null)}
        />
      )}
    </div>
  )
}
