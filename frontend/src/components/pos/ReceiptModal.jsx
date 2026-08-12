import { BadgeCheck, Coffee, Printer, X } from 'lucide-react'
import { STORE } from '../../config/store'
import { formatDateTimeDisplay } from '../../utils/dateTimeFormat'
import { calculateTotals } from '../../utils/posHelpers'
import { useModalKeyboard } from '../../hooks/useModalKeyboard'

function ModalShell({ onClose, printLabel, documentContent }) {
  const panelRef = useModalKeyboard({
    isOpen: true,
    onEscape: onClose,
    primaryActionMode: 'never',
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md print:relative print:inset-auto print:block print:bg-transparent print:p-0 print:backdrop-blur-none">
      <button
        type="button"
        aria-label="Close document preview"
        className="absolute inset-0 print:hidden"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white text-stone-900 shadow-2xl outline-none print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex min-h-9 min-w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 print:hidden"
          aria-label="Close receipt"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white p-6 text-stone-900 print:overflow-visible">
          {documentContent}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-slate-50 p-4 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10b981] py-3 font-semibold text-white transition hover:bg-[#0d9668]"
          >
            <Printer className="h-4 w-4" />
            {printLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl py-2.5 font-medium text-slate-600 transition hover:bg-slate-200/50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function InvoiceTemplate({ transaction }) {
  return (
    <div
      id="receipt-print-area"
      className="mx-auto cursor-default select-none rounded-xl bg-white p-1 text-stone-900 print:rounded-none print:border print:border-stone-400 print:p-4 print:shadow-none"
    >
      <div className="border-b border-dashed border-stone-300 pb-5 text-center">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">{STORE.officialName}</h2>
        <p className="mt-1 text-[11px] text-stone-600">{STORE.address}</p>
        <p className="text-[11px] text-stone-500">{STORE.phone}</p>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="rounded-full border border-orange-300 bg-orange-50 px-5 py-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800">
            Status: Unpaid / Pending
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1 border-b border-dashed border-stone-300 pb-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-stone-500">Reference No.</span>
          <span className="font-semibold tabular-nums">{transaction.id}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-stone-500">Account / Table</span>
          <span className="font-medium">{transaction.source}</span>
        </div>
      </div>

      <div className="py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
          Itemized Charges
        </p>
        <div className="space-y-2.5">
          {transaction.items.map((item, index) => (
            <div key={`${item.id ?? 'line'}-${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {item.qty} × ${item.unitPrice.toFixed(2)}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-stone-900">
                ${item.lineTotal.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-dashed border-stone-300 pt-4 text-sm">
        <div className="flex justify-between text-stone-600">
          <span>Subtotal</span>
          <span className="tabular-nums">${transaction.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-stone-600">
          <span>Tax (10%)</span>
          <span className="tabular-nums">${transaction.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-stone-900">
          <span>Total Balance Due</span>
          <span className="tabular-nums">${transaction.total.toFixed(2)}</span>
        </div>
      </div>

      <p className="mt-6 border-t border-dashed border-stone-300 pt-4 text-center text-xs font-medium leading-relaxed text-stone-600">
        Please present this invoice at the counter to settle your payment.
      </p>
    </div>
  )
}

function ReceiptTemplate({ transaction }) {
  const paymentMethod = transaction.payment || 'Cash'

  return (
    <div
      id="receipt-print-area"
      className="relative mx-auto cursor-default select-none overflow-hidden rounded-xl bg-white p-1 text-stone-900 print:rounded-none print:border print:border-stone-400 print:p-4 print:shadow-none"
    >
      <div className="flex flex-col items-center border-b border-dashed border-emerald-200 pb-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 print:border print:border-stone-400 print:bg-white print:text-emerald-700 print:shadow-none">
          <Coffee className="h-7 w-7" />
        </div>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-stone-900">{STORE.officialName}</h2>
        <p className="mt-2 text-[11px] text-stone-600">{STORE.address}</p>
        <p className="mt-0.5 text-[11px] text-stone-500">{STORE.phone}</p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400 bg-emerald-50 px-4 py-1.5">
          <BadgeCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
            Official Receipt
          </span>
        </div>
      </div>

      <div className="space-y-1 border-b border-dashed border-emerald-200 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-stone-500">Invoice No.</span>
          <span className="font-semibold tabular-nums">{transaction.id}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-stone-500">Date / Time</span>
          <span className="tabular-nums">{formatDateTimeDisplay(transaction.date, transaction.time)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-stone-500">Table / Source</span>
          <span className="font-medium">{transaction.source}</span>
        </div>
      </div>

      <div className="py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Items</p>
        <div className="space-y-2.5">
          {transaction.items.map((item, index) => (
            <div key={`${item.id ?? 'line'}-${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {item.qty} × ${item.unitPrice.toFixed(2)}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-stone-900">
                ${item.lineTotal.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-dashed border-emerald-200 pt-4 text-sm">
        <div className="flex justify-between text-stone-600">
          <span>Subtotal</span>
          <span className="tabular-nums">${transaction.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-stone-600">
          <span>Tax (10%)</span>
          <span className="tabular-nums">${transaction.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-emerald-100 pt-2 text-base font-bold text-stone-900">
          <span>Total Paid</span>
          <span className="tabular-nums">${transaction.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
          Paid Via
        </p>
        <p className="mt-1 text-sm font-black uppercase tracking-wide text-emerald-900">
          {paymentMethod}
        </p>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">
        {STORE.receiptThanks}
        <br />
        Have a wonderful day!
      </p>
    </div>
  )
}

export default function ReceiptModal({ transaction, onClose, isPreCheckout = false, variant }) {
  if (!transaction) return null

  const items = Array.isArray(transaction.items) ? transaction.items : []
  const hasTotals =
    typeof transaction.subtotal === 'number' &&
    typeof transaction.tax === 'number' &&
    typeof transaction.total === 'number'
  const totals = hasTotals ? transaction : calculateTotals(items)
  const normalizedTransaction = {
    ...transaction,
    items,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
  }

  const isInvoice = variant === 'invoice' || isPreCheckout || transaction.isPreCheckout

  return (
    <ModalShell
      onClose={onClose}
      printLabel={isInvoice ? 'Print Bill / Invoice' : 'Print Receipt'}
      documentContent={
        isInvoice ? (
          <InvoiceTemplate transaction={normalizedTransaction} />
        ) : (
          <ReceiptTemplate transaction={normalizedTransaction} />
        )
      }
    />
  )
}
