import { useEffect, useState } from 'react'
import { Coffee, X } from 'lucide-react'
import { useModalKeyboard } from '../../hooks/useModalKeyboard'
import { DEFAULT_SUGAR_LEVEL, SUGAR_LEVELS } from '../../utils/sugarLevel'

export default function SugarLevelModal({ item, onConfirm, onClose }) {
  const [sugarLevel, setSugarLevel] = useState(DEFAULT_SUGAR_LEVEL)
  const [notes, setNotes] = useState('')
  const isOpen = Boolean(item)

  const panelRef = useModalKeyboard({
    isOpen,
    onEscape: onClose,
    primaryActionMode: 'auto',
  })

  useEffect(() => {
    if (!item) return
    setSugarLevel(DEFAULT_SUGAR_LEVEL)
    setNotes('')
  }, [item])

  if (!item) return null

  const handleSubmit = (event) => {
    event.preventDefault()
    onConfirm({
      sugarLevel,
      extraNotes: notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 overscroll-contain">
      <button
        type="button"
        aria-label="Close sugar level options"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sugar-level-title"
        className="modal-panel relative z-10 max-w-md"
      >
        <form id="sugar-level-form" onSubmit={handleSubmit}>
          <div className="modal-panel-body p-6 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[#10b981]">
                  <Coffee className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h3 id="sugar-level-title" className="text-heading text-lg font-semibold">
                    Sugar Level
                  </h3>
                  <p className="text-heading mt-1 truncate text-sm font-medium">{item.name}</p>
                  <p className="text-muted mt-1 text-xs">
                    Choose sweetness, then add optional notes for the kitchen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
                aria-label="Close sugar options"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {SUGAR_LEVELS.map((option) => {
                const selected = sugarLevel === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSugarLevel(option.value)}
                    className={
                      selected
                        ? 'min-h-11 rounded-xl bg-[#10b981] px-2 py-2 text-center text-sm font-semibold text-white shadow-sm'
                        : 'min-h-11 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30'
                    }
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <label htmlFor="drink-item-notes" className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">
                Item notes <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <textarea
                id="drink-item-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={160}
                placeholder="e.g. less ice, oat milk…"
                className="input-field min-h-[4.5rem] resize-none rounded-xl"
              />
            </label>
          </div>

          <div className="modal-panel-footer flex gap-3 px-6 pb-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
              Cancel
            </button>
            <button type="submit" form="sugar-level-form" className="btn-primary flex-1 text-sm">
              Add to Order
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
