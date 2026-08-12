import { ArrowRight, BaggageClaim, LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePOS } from '../context/POSContext'
import { FLOOR_STATUS_KEYS, TABLE_STATUS_META } from '../data/tables'
import { calculateTotals } from '../utils/posHelpers'

function getFloorStatus(bill) {
  return bill.status === 'empty' ? 'empty' : 'occupied'
}

function TableCard({ bill, onSendToCheckout }) {
  const floorStatus = getFloorStatus(bill)
  const meta = TABLE_STATUS_META[floorStatus]
  const isEmpty = floorStatus === 'empty'
  const { total } = isEmpty ? { total: 0 } : calculateTotals(bill.items)
  const isActive = !isEmpty

  return (
    <div className={`flex cursor-default select-none flex-col rounded-2xl border p-5 shadow-sm ${meta.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-lg font-bold ${isEmpty ? 'text-emerald-700 dark:text-emerald-400' : 'text-heading'}`}>
            {bill.name}
          </p>
          {!isEmpty && bill.orderSummary && (
            <p className="text-muted mt-1 line-clamp-2 text-xs">{bill.orderSummary}</p>
          )}
        </div>
        <span className={`shrink-0 cursor-default select-none rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end">
        {!isEmpty && (
          <p className="text-2xl font-bold tabular-nums text-forest-700 dark:text-forest-400">
            ${total.toFixed(2)}
          </p>
        )}
        {isEmpty && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Available</p>
        )}

        {isActive && (
          <button
            type="button"
            onClick={() => onSendToCheckout(bill)}
            className="mt-4 inline-flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-xl border border-forest-300/70 bg-white py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50 dark:border-forest-700/50 dark:bg-obsidian-850 dark:text-mint-100 dark:hover:bg-forest-950/30"
          >
            Send to Cashier Checkout
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function TakeOutCard({ bill, onSendToCheckout }) {
  const floorStatus = getFloorStatus(bill)
  const meta = TABLE_STATUS_META[floorStatus]
  const isEmpty = floorStatus === 'empty'
  const { total } = isEmpty ? { total: 0 } : calculateTotals(bill.items)
  const isActive = !isEmpty

  return (
    <div
      className={`col-span-full cursor-default select-none rounded-2xl border-2 p-6 shadow-md ${
        isActive
          ? meta.card
          : 'border-dashed border-emerald-300/70 bg-emerald-50/20 dark:border-emerald-700/50 dark:bg-emerald-950/10'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-forest-500 text-white shadow-lg shadow-forest-900/20">
            <BaggageClaim className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-heading text-xl font-bold">Take Out</h4>
              <span className={`cursor-default select-none rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-muted mt-1 text-sm">
              {isEmpty
                ? 'No active take-out tickets — assign orders from the Order tab'
                : bill.orderSummary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:text-right">
          {isActive && (
            <p className="text-3xl font-bold tabular-nums text-forest-700 dark:text-forest-400">
              ${total.toFixed(2)}
            </p>
          )}
          {isActive && (
            <button
              type="button"
              onClick={() => onSendToCheckout(bill)}
              className="btn-primary inline-flex shrink-0 items-center gap-2 px-5 py-2.5 text-sm"
            >
              Send to Cashier Checkout
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Table() {
  const { t } = useTranslation()
  const { tables, takeOut, openPaymentFor } = usePOS()

  const activeCount =
    tables.filter((t) => t.status !== 'empty').length + (takeOut.status !== 'empty' ? 1 : 0)

  const handleSendToCheckout = (bill) => {
    openPaymentFor(bill.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-heading text-lg">{t('nav.table')}</h3>
          <p className="text-muted text-sm">
            Floor layout and live table status monitoring
          </p>
        </div>
        <div className="badge-olive inline-flex items-center gap-2 self-start px-3 py-1.5 text-sm">
          <LayoutGrid className="h-4 w-4" />
          {activeCount} active bill(s)
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <TakeOutCard bill={takeOut} onSendToCheckout={handleSendToCheckout} />
        {tables.map((table) => (
          <TableCard key={table.id} bill={table} onSendToCheckout={handleSendToCheckout} />
        ))}
      </div>

      <div className="surface-inset flex flex-wrap items-center gap-4 px-5 py-4">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">Status legend</p>
        {FLOOR_STATUS_KEYS.map((key) => {
          const meta = TABLE_STATUS_META[key]
          return (
            <span key={key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
              {meta.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
