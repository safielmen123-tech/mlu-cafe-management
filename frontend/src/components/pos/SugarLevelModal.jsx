import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Coffee, Snowflake } from 'lucide-react'
import Modal from '../common/Modal'
import {
  availableServings,
  defaultServing,
  needsTeaFlavor,
  servingPrice,
  TEA_SELECTION_FLAVORS,
} from '../../utils/drinkOptions'
import { DEFAULT_SUGAR_LEVEL, SUGAR_LEVELS, needsSugarLevel } from '../../utils/sugarLevel'
import { translateMenuName } from '../../utils/menuNameTranslations'

export default function SugarLevelModal({ item, onConfirm, onClose }) {
  const { t, i18n } = useTranslation()
  const servings = availableServings(item)
  const [serving, setServing] = useState(defaultServing(item))
  const showSugar = needsSugarLevel(item, serving)
  const [sugarLevel, setSugarLevel] = useState(DEFAULT_SUGAR_LEVEL)
  const [teaFlavor, setTeaFlavor] = useState('')
  const [notes, setNotes] = useState('')
  const showTeaFlavor = needsTeaFlavor(item)

  useEffect(() => {
    if (!item) return
    setServing(defaultServing(item))
    setSugarLevel(DEFAULT_SUGAR_LEVEL)
    setTeaFlavor('')
    setNotes('')
  }, [item])

  if (!item) return null

  const selectedPrice = servingPrice(item, serving)
  const canSubmit = (servings.length === 0 || Boolean(serving)) && (!showTeaFlavor || teaFlavor)

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    const flavorName = TEA_SELECTION_FLAVORS.find((entry) => entry.id === teaFlavor)?.name || ''
    onConfirm({
      serving: serving || null,
      sugarLevel: showSugar ? sugarLevel : null,
      teaFlavor: flavorName,
      extraNotes: notes.trim(),
      price: selectedPrice,
    })
  }

  return (
    <Modal
      titleId="sugar-level-title"
      closeLabel={t('a11y.closeSugarOptions')}
      onClose={onClose}
      maxWidth="max-w-md"
      header={(
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[#10b981]">
            <Coffee className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 id="sugar-level-title" className="text-heading text-lg font-semibold">
              {t('order.sugar.title')}
            </h3>
            <p className="text-heading mt-1 truncate text-sm font-medium">
              {translateMenuName(item.name, i18n.language, t)}
            </p>
            <p className="text-muted mt-1 text-xs">
              {showSugar
                ? servings.length > 1
                  ? t('order.sugar.description')
                  : t('order.sugar.descriptionIcedOnly')
                : t('order.sugar.descriptionServingOnly')}
            </p>
          </div>
        </div>
      )}
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="sugar-level-form"
            disabled={!canSubmit}
            className="btn-primary flex-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('order.sugar.addToOrder')} · ${selectedPrice.toFixed(2)}
          </button>
        </>
      )}
    >
      <form id="sugar-level-form" onSubmit={handleSubmit}>
        {servings.length > 1 ? (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">
              {t('order.serving.title')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {servings.map((option) => {
                const selected = serving === option.id
                const Icon = option.id === 'iced' ? Snowflake : Coffee
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setServing(option.id)}
                    className={
                      selected
                        ? 'min-h-12 rounded-xl bg-[#10b981] px-3 py-2 text-left text-sm font-semibold text-white shadow-sm'
                        : 'min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30'
                    }
                    aria-pressed={selected}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-4 w-4" aria-hidden />
                        {t(`order.serving.${option.id}`)}
                      </span>
                      <span className="tabular-nums">${option.price.toFixed(2)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {showTeaFlavor ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">
              {t('order.flavor.title')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TEA_SELECTION_FLAVORS.map((option) => {
                const selected = teaFlavor === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTeaFlavor(option.id)}
                    className={
                      selected
                        ? 'min-h-11 rounded-xl bg-[#10b981] px-2 py-2 text-center text-sm font-semibold text-white shadow-sm'
                        : 'min-h-11 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30'
                    }
                    aria-pressed={selected}
                  >
                    {t(`order.teaFlavors.${option.id}`)}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {showSugar ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {SUGAR_LEVELS.map((option) => {
              const selected = sugarLevel === option.value
              const label =
                option.value === '120%' ? t('order.sugar.extraSweet') : option.label
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
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}

        <label htmlFor="drink-item-notes" className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">
            {t('order.sugar.itemNotes')}{' '}
            <span className="font-normal text-slate-400">{t('common.optional')}</span>
          </span>
          <textarea
            id="drink-item-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={160}
            placeholder={t('order.sugar.notesPlaceholder')}
            className="input-field min-h-[4.5rem] resize-none rounded-xl"
          />
        </label>
      </form>
    </Modal>
  )
}
