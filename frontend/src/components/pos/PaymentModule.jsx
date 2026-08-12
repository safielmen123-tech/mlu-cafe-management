import { Banknote, ScanLine } from 'lucide-react'
import { useState } from 'react'

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'Bank Scan', label: 'Bank Scan', icon: ScanLine },
]

export default function PaymentModule({ disabled, onConfirm }) {
  const [method, setMethod] = useState('Cash')

  const handleConfirm = () => {
    if (disabled || !method) return
    onConfirm?.(method)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Payment Method
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => {
            const isActive = method === id
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setMethod(id)}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition ${
                  isActive
                    ? 'surface-emerald-selected'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon
                  className={`h-6 w-6 ${isActive ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-400 dark:text-zinc-500'}`}
                />
                <span
                  className={`text-sm font-semibold ${isActive ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-700 dark:text-zinc-300'}`}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleConfirm}
        className="btn-primary w-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Confirm Payment / Complete Order
      </button>
    </div>
  )
}
