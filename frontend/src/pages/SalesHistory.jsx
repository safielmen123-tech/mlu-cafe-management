import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, Search } from 'lucide-react'
import ReceiptModal from '../components/pos/ReceiptModal'
import { SalesFilterBar } from '../components/ui/SalesFilterBar'
import { usePOS } from '../context/POSContext'
import { fetchReceiptTransaction } from '../utils/receiptHelpers'
import {
  buildMonthFilterOptions,
  filterCompletedOrders,
  filterOrdersByMonth,
  formatMonthLabel,
  summarizeSalesMetrics,
} from '../utils/salesHistoryAnalytics'
import { formatDateTimeDisplay, sortOrdersByDateTime } from '../utils/dateTimeFormat'

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

export default function SalesHistory() {
  const { t } = useTranslation()
  const { salesHistory } = usePOS()
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [receiptTransaction, setReceiptTransaction] = useState(null)
  const [printingOrderId, setPrintingOrderId] = useState(null)
  const [receiptError, setReceiptError] = useState('')

  const monthOptions = useMemo(() => buildMonthFilterOptions(16), [])

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-heading text-lg">{t('nav.salesHistory')}</h3>
        <p className="text-muted text-sm">
          {t('sales.subtitle', {
            defaultValue: 'Review completed orders and print receipts',
          })}
        </p>
      </div>

      {receiptError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
          {receiptError}
        </div>
      )}

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
