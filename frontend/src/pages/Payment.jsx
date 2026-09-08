import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Minus, Printer, Receipt } from 'lucide-react'
import { usePOS } from '../context/POSContext'
import { useNotifications } from '../context/NotificationContext'
import { PAYMENT_QUEUE_STATUS } from '../data/tables'
import { buildPreCheckoutReceipt, calculateTotals } from '../utils/posHelpers'
import PaymentModule from '../components/pos/PaymentModule'
import ReceiptModal from '../components/pos/ReceiptModal'

function ActiveBillList({ bills, selectedId, onSelect }) {
  if (bills.length === 0) {
    return (
      <div className="surface-inset flex flex-col items-center justify-center px-4 py-12 text-center">
        <CreditCard className="text-muted mb-3 h-10 w-10 opacity-40" />
        <p className="text-heading text-sm font-semibold">No active bills</p>
        <p className="text-muted mt-1 text-xs">
          Tables with un-invoiced orders will appear here for checkout.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {bills.map((bill) => {
        const { total } = calculateTotals(bill.items)
        const isSelected = selectedId === bill.id

        return (
          <button
            key={bill.id}
            type="button"
            onClick={() => onSelect(bill.id)}
            className={`min-h-11 w-full rounded-2xl border p-4 text-left transition-colors ${
              isSelected
                ? 'surface-emerald-selected'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-heading truncate font-semibold">{bill.name}</p>
                {bill.orderSummary && (
                  <p className="text-muted mt-1 line-clamp-2 text-xs">{bill.orderSummary}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${PAYMENT_QUEUE_STATUS.badge}`}
              >
                {PAYMENT_QUEUE_STATUS.label}
              </span>
            </div>
            <p className="mt-2 text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-300">
              ${total.toFixed(2)}
            </p>
          </button>
        )
      })}
    </div>
  )
}

function BillManager({
  bill,
  onDecrementItem,
  onUpdateItemPrice,
  onPrintBill,
  onPaymentComplete,
}) {
  // Drafts hold only in-progress edits; anything untouched reads straight from the bill.
  const [priceDrafts, setPriceDrafts] = useState({})
  const [draftBillId, setDraftBillId] = useState(bill.id)
  const { subtotal, total } = calculateTotals(bill.items)

  if (draftBillId !== bill.id) {
    setDraftBillId(bill.id)
    setPriceDrafts({})
  }

  const priceValueFor = (item) =>
    priceDrafts[item.id] ?? (item.unitPrice ?? item.price ?? 0).toFixed(2)

  const handlePriceBlur = (itemId) => {
    const draft = priceDrafts[itemId]
    if (draft == null) return
    onUpdateItemPrice(itemId, draft)
    setPriceDrafts((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl surface-emerald text-emerald-900 dark:text-emerald-300">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-heading text-lg font-bold">{bill.name}</h3>
            <p className="text-muted text-sm">Itemized bill &amp; checkout processing</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        {bill.items.map((item, index) => (
          <div
            key={`${item.id ?? 'line'}-${item.name}-${index}`}
            className="surface-inset flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-heading font-medium">{item.name}</p>
              {item.notes && !String(item.name || '').includes(item.notes) ? (
                <p className="text-muted mt-0.5 text-xs">{item.notes}</p>
              ) : null}
              <p className="text-muted text-xs">
                Qty: {item.qty || item.quantity || 1}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onDecrementItem(item.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                aria-label={`Remove one ${item.name}`}
              >
                <Minus className="h-4 w-4" />
              </button>

              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted font-medium">Edit Price</span>
                <div className="relative">
                  <span className="text-muted absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceValueFor(item)}
                    onChange={(e) =>
                      setPriceDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    onBlur={() => handlePriceBlur(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePriceBlur(item.id)
                    }}
                    className="w-24 rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm tabular-nums text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </label>

              <p className="min-w-[4.5rem] text-right font-semibold tabular-nums text-forest-600 dark:text-forest-400">
                ${(item.lineTotal || 0).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-6 dark:border-zinc-800">
        <div className="space-y-2 text-sm">
          <div className="text-muted flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </div>
          <div className="text-heading flex justify-between border-t border-slate-200 pt-2 text-xl font-bold dark:border-zinc-800">
            <span>Total Due</span>
            <span className="tabular-nums text-forest-600 dark:text-forest-400">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={onPrintBill}
            disabled={bill.items.length === 0}
            className="btn-secondary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print Bill / Invoice
          </button>

          <div>
            <p className="mb-3 text-sm font-semibold text-forest-800 dark:text-mint-200">
              Process Payment / Checkout
            </p>
            <PaymentModule
              disabled={bill.items.length === 0}
              onConfirm={(method) => onPaymentComplete(method)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Payment() {
  const { t } = useTranslation()
  const { pushBanner } = useNotifications()
  const {
    getActiveBills,
    getBillById,
    paymentTargetId,
    clearPaymentTarget,
    decrementBillItem,
    updateBillItemPrice,
    processPayment,
    loadSalesHistory,
  } = usePOS()

  const activeBills = getActiveBills()
  const [selectedId, setSelectedId] = useState(null)
  const [completedReceipt, setCompletedReceipt] = useState(null)
  const [previewReceipt, setPreviewReceipt] = useState(null)

  useEffect(() => {
    if (paymentTargetId != null) {
      setSelectedId(paymentTargetId)
      clearPaymentTarget()
      return
    }

    if (selectedId == null && activeBills.length > 0) {
      setSelectedId(activeBills[0].id)
    }
  }, [paymentTargetId, activeBills, selectedId, clearPaymentTarget])

  useEffect(() => {
    if (selectedId == null) return
    const stillActive = activeBills.some((bill) => bill.id === selectedId)
    if (!stillActive) {
      setSelectedId(activeBills[0]?.id ?? null)
    }
  }, [activeBills, selectedId])

  const selectedBill = selectedId != null ? getBillById(selectedId) : null

  const handlePaymentComplete = async (paymentMethod) => {
    if (!selectedBill) return
    const sourceLabel = selectedBill.name || selectedBill.source || 'Order'
    const transaction = await processPayment(selectedBill.id, paymentMethod)
    if (transaction) {
      setCompletedReceipt(transaction)
      pushBanner({
        title: t('payment.receivedTitle', { defaultValue: 'Payment Received' }),
        message: t('payment.receivedMessage', {
          defaultValue: `Payment Received for ${sourceLabel} / Invoice #${transaction.id}`,
          source: sourceLabel,
          invoice: transaction.id,
        }),
        tone: 'success',
      })
      loadSalesHistory?.()
    }
  }

  const handlePrintBill = () => {
    if (!selectedBill || selectedBill.items.length === 0) return
    setPreviewReceipt(buildPreCheckoutReceipt(selectedBill))
  }

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h3 className="page-title">{t('nav.payment')}</h3>
        <p className="page-subtitle">
          Manage active bills, apply adjustments, and complete checkout transactions
        </p>
      </div>

      <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4 lg:flex-row">
        <div className="surface-panel flex max-h-[40vh] flex-col overflow-hidden shadow-sm lg:max-h-none lg:w-[min(100%,320px)] lg:shrink-0">
          <div className="border-b border-border px-5 py-4">
            <h4 className="text-heading font-semibold">Active Bills</h4>
            <p className="text-muted text-xs">
              {activeBills.length} table{activeBills.length === 1 ? '' : 's'} awaiting payment
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ActiveBillList
              bills={activeBills}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <div className="surface-panel flex min-h-[min(60vh,32rem)] flex-1 flex-col overflow-hidden shadow-sm lg:min-h-0">
          {selectedBill && selectedBill.items.length > 0 ? (
            <BillManager
              bill={selectedBill}
              onDecrementItem={(itemId) => decrementBillItem(selectedBill.id, itemId)}
              onUpdateItemPrice={(itemId, price) =>
                updateBillItemPrice(selectedBill.id, itemId, price)
              }
              onPrintBill={handlePrintBill}
              onPaymentComplete={handlePaymentComplete}
            />
          ) : selectedBill ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <CreditCard className="text-muted mb-4 h-12 w-12 opacity-30" />
              <p className="text-heading font-semibold">This bill has no items</p>
              <p className="text-muted mt-2 max-w-sm text-sm">
                {selectedBill.name} is selected, but there are no line items left to charge.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <CreditCard className="text-muted mb-4 h-12 w-12 opacity-30" />
              <p className="text-heading font-semibold">Select a bill to manage</p>
              <p className="text-muted mt-2 max-w-sm text-sm">
                Choose an active table from the left panel to review items, apply discounts, and
                process payment.
              </p>
            </div>
          )}
        </div>
      </div>

      {previewReceipt && (
        <ReceiptModal
          transaction={previewReceipt}
          variant="invoice"
          onClose={() => setPreviewReceipt(null)}
        />
      )}

      {completedReceipt && (
        <ReceiptModal
          transaction={completedReceipt}
          variant="receipt"
          onClose={() => {
            setCompletedReceipt(null)
            loadSalesHistory().catch((err) => {
              console.error('Failed to refresh sales history:', err.message)
            })
          }}
        />
      )}
    </div>
  )
}
