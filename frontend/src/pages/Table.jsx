import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BaggageClaim, Crown, LayoutGrid, Phone, UserCheck, Users, UtensilsCrossed, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePOS } from '../context/POSContext'
import { useAlerts } from '../context/AlertsContext'
import { FLOOR_STATUS_KEYS, TABLE_STATUS_META } from '../data/tables'
import { canCheckInReservation, SEATED_STATUS, slotLabel } from '../data/reservations'
import { calculateTotals } from '../utils/posHelpers'
import { apiFetch, getAuthToken } from '../services/apiClient'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

function getFloorStatus(bill, reservation) {
  if (bill.status !== 'empty') return 'occupied'
  if (reservation?.status === SEATED_STATUS) return 'occupied'
  if (reservation) return 'reserved'
  return 'empty'
}

function floorTableDisplayName(bill, t) {
  if (!bill) return t('tables.table')
  if (bill.isTakeOut || bill.id === 'takeout' || bill.section === 'takeout') {
    return t('tables.takeOut')
  }
  if (bill.section === 'vip' || String(bill.name || '').startsWith('VIP')) {
    const match = String(bill.name || '').match(/(\d+)/)
    return t('tables.vipRoomNumber', { number: match ? match[1] : bill.id })
  }
  const match = String(bill.name || '').match(/(\d+)/)
  return t('tables.tableNumber', { number: match ? match[1] : bill.id })
}

function ReservationPreview({
  reservation,
  busy,
  error,
  onClose,
  onCheckIn,
  onOpenOrder,
  onCancel,
}) {
  const { t } = useTranslation()
  const panelRef = useModalKeyboard({ isOpen: Boolean(reservation), onEscape: onClose, primaryActionMode: 'never' })
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (!reservation) return null

  const canCheckIn = canCheckInReservation(reservation)
  const isSeated = reservation.status === SEATED_STATUS
  const statusMeta = isSeated
    ? { labelKey: 'statuses.seated' }
    : { labelKey: 'statuses.reserved' }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label={t('a11y.closeReservationPreview')} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reserved-table-title"
      >
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${
                isSeated ? 'text-emerald-700 dark:text-emerald-300' : 'text-violet-700 dark:text-violet-300'
              }`}>
                {t(statusMeta.labelKey)}
              </p>
              <h4 id="reserved-table-title" className="text-heading mt-1 text-lg font-semibold">
                {floorTableDisplayName(
                  {
                    id: reservation.table_id,
                    name: reservation.table_name,
                    section: String(reservation.table_name || '').startsWith('VIP') ? 'vip' : 'standard',
                  },
                  t,
                )}
              </h4>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-olive-50 dark:hover:bg-zinc-800"
              aria-label={t('a11y.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted text-xs uppercase tracking-wide">{t('tables.customerName')}</dt>
              <dd className="mt-0.5 font-medium">{reservation.customer_name}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs uppercase tracking-wide">{t('tables.time')}</dt>
              <dd className="mt-0.5 font-medium">
                {slotLabel(reservation.time_slot, reservation.time_slot_label, reservation.duration_minutes)}
              </dd>
            </div>
            <div className="flex gap-6">
              <div>
                <dt className="text-muted inline-flex items-center gap-1 text-xs uppercase tracking-wide">
                  <Users className="h-3 w-3" /> {t('tables.guestCount')}
                </dt>
                <dd className="mt-0.5 font-medium tabular-nums">{reservation.guest_count}</dd>
              </div>
              <div>
                <dt className="text-muted inline-flex items-center gap-1 text-xs uppercase tracking-wide">
                  <Phone className="h-3 w-3" /> {t('tables.contactNumber')}
                </dt>
                <dd className="mt-0.5 font-medium">{reservation.phone}</dd>
              </div>
            </div>
            {reservation.notes ? (
              <div>
                <dt className="text-muted text-xs uppercase tracking-wide">{t('common.notes')}</dt>
                <dd className="mt-0.5 text-sm">{reservation.notes}</dd>
              </div>
            ) : null}
          </dl>

          {error ? <p className="mt-4 text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="mt-5 space-y-2">
            {canCheckIn ? (
              <button
                type="button"
                disabled={busy}
                onClick={onCheckIn}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                {busy ? t('tables.checkingIn') : t('tables.checkInArrived')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={onOpenOrder}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-forest-300/70 bg-white py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-forest-700/50 dark:bg-obsidian-850 dark:text-mint-100 dark:hover:bg-forest-950/30"
            >
              <UtensilsCrossed className="h-4 w-4" />
              {t('tables.openOrderTicket')}
            </button>
            {confirmCancel ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmCancel(false)}
                  className="btn-secondary flex-1 py-2 text-sm"
                >
                  {t('tables.keepBooking')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancel}
                  className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {t('tables.confirmCancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancel(true)}
                className="w-full rounded-xl py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                {t('tables.cancelBooking')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TableCard({ bill, reservation, onSendToCheckout, onOpenReservation }) {
  const { t } = useTranslation()
  const floorStatus = getFloorStatus(bill, reservation)
  const meta = TABLE_STATUS_META[floorStatus]
  const isEmpty = floorStatus === 'empty'
  const isReserved = floorStatus === 'reserved'
  const hasItems = Array.isArray(bill.items) && bill.items.length > 0
  const { total } = isEmpty || isReserved || !hasItems ? { total: 0 } : calculateTotals(bill.items)
  const isActive = floorStatus === 'occupied'
  const isVip = bill.section === 'vip' || String(bill.name).startsWith('VIP')
  const canOpenPreview = Boolean(reservation) && (isReserved || (isActive && !hasItems))

  return (
    <div
      className={`flex select-none flex-col rounded-2xl border p-5 shadow-sm ${meta.card} ${
        canOpenPreview ? 'cursor-pointer' : 'cursor-default'
      }`}
      onClick={() => {
        if (canOpenPreview) onOpenReservation(reservation)
      }}
      onKeyDown={(event) => {
        if (!canOpenPreview) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenReservation(reservation)
        }
      }}
      role={canOpenPreview ? 'button' : undefined}
      tabIndex={canOpenPreview ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`flex items-center gap-1.5 text-lg font-bold ${isEmpty ? 'text-emerald-700 dark:text-emerald-400' : 'text-heading'}`}>
            {isVip ? <Crown className="h-4 w-4 text-violet-600 dark:text-violet-300" /> : null}
            {floorTableDisplayName(bill, t)}
          </p>
          {!isEmpty && !isReserved && bill.orderSummary && hasItems && (
            <p className="text-muted mt-1 line-clamp-2 text-xs">{bill.orderSummary}</p>
          )}
          {isReserved && (
            <p className="mt-1 line-clamp-2 text-xs text-violet-700 dark:text-violet-300">
              {reservation.customer_name} · {slotLabel(reservation.time_slot, reservation.time_slot_label, reservation.duration_minutes)}
            </p>
          )}
          {isActive && reservation && !hasItems && (
            <p className="mt-1 line-clamp-2 text-xs text-amber-800 dark:text-amber-200">
              {reservation.customer_name} · {t('statuses.seated')}
            </p>
          )}
        </div>
        <span className={`shrink-0 cursor-default select-none rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
          {t(meta.labelKey)}
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end">
        {isActive && hasItems && (
          <p className="text-2xl font-bold tabular-nums text-forest-700 dark:text-forest-400">
            ${total.toFixed(2)}
          </p>
        )}
        {isEmpty && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('statuses.available')}</p>
        )}
        {isReserved && (
          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">{t('tables.tapReservationDetails')}</p>
        )}
        {isActive && reservation && !hasItems && (
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t('tables.guestSeatedOpenTicket')}</p>
        )}

        {isActive && hasItems && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSendToCheckout(bill)
            }}
            className="mt-4 inline-flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-xl border border-forest-300/70 bg-white py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50 dark:border-forest-700/50 dark:bg-obsidian-850 dark:text-mint-100 dark:hover:bg-forest-950/30"
          >
            {t('tables.sendToCheckout')}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function TakeOutCard({ bill, onSendToCheckout }) {
  const { t } = useTranslation()
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
              <h4 className="text-heading text-xl font-bold">{t('tables.takeOut')}</h4>
              <span className={`cursor-default select-none rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
                {t(meta.labelKey)}
              </span>
            </div>
            <p className="text-muted mt-1 text-sm">
              {isEmpty
                ? t('tables.noTakeOutTickets')
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
              {t('tables.sendToCheckout')}
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
  const { tables, takeOut, openPaymentFor, openOrderFor } = usePOS()
  const { refresh: refreshAlerts } = useAlerts()
  const [floorReservations, setFloorReservations] = useState({})
  const [preview, setPreview] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const loadFloorReservations = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return

    try {
      const response = await apiFetch('/tables', { token })
      if (response.status === 401) return
      if (response.ok) {
        const data = await response.json()
        setFloorReservations(data?.reservations && typeof data.reservations === 'object' ? data.reservations : {})
        return
      }
      const fallback = await apiFetch('/reservations/floor', { token })
      if (!fallback.ok) return
      const data = await fallback.json()
      setFloorReservations(data?.tables && typeof data.tables === 'object' ? data.tables : {})
    } catch {
      setFloorReservations({})
    }
  }, [])

  useEffect(() => {
    loadFloorReservations()
    const interval = window.setInterval(loadFloorReservations, 30_000)
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') loadFloorReservations()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [loadFloorReservations])

  const standardTables = useMemo(
    () => tables.filter((table) => table.section !== 'vip' && !String(table.name).startsWith('VIP')),
    [tables],
  )
  const vipTables = useMemo(
    () => tables.filter((table) => table.section === 'vip' || String(table.name).startsWith('VIP')),
    [tables],
  )

  const reservedCount = Object.values(floorReservations).filter(
    (reservation) => reservation?.status && reservation.status !== SEATED_STATUS,
  ).length
  const activeCount =
    tables.filter((table) => table.status !== 'empty').length + (takeOut.status !== 'empty' ? 1 : 0)

  const handleSendToCheckout = (bill) => {
    openPaymentFor(bill.id)
  }

  const handleCheckIn = async () => {
    if (!preview?.id) return
    setPreviewBusy(true)
    setPreviewError('')
    try {
      const response = await apiFetch(`/reservations/${preview.id}/check-in`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('tables.errors.checkIn'))
      setPreview(data)
      await loadFloorReservations()
      refreshAlerts?.()
    } catch (err) {
      setPreviewError(err.message || t('tables.errors.checkIn'))
    } finally {
      setPreviewBusy(false)
    }
  }

  const handleOpenOrder = async () => {
    if (!preview) return
    setPreviewBusy(true)
    setPreviewError('')
    try {
      if (canCheckInReservation(preview)) {
        const response = await apiFetch(`/reservations/${preview.id}/check-in`, { method: 'POST' })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || t('tables.errors.checkIn'))
        refreshAlerts?.()
      }
      const tableId = preview.table_id
      setPreview(null)
      openOrderFor(tableId)
    } catch (err) {
      setPreviewError(err.message || t('tables.errors.openOrder'))
    } finally {
      setPreviewBusy(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!preview?.id) return
    setPreviewBusy(true)
    setPreviewError('')
    try {
      const response = await apiFetch(`/reservations/${preview.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Canceled' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('tables.errors.cancelBooking'))
      setPreview(null)
      await loadFloorReservations()
      refreshAlerts?.()
    } catch (err) {
      setPreviewError(err.message || t('tables.errors.cancelBooking'))
    } finally {
      setPreviewBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="page-title">{t('nav.table')}</h3>
          <p className="page-subtitle">{t('tables.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="badge-olive inline-flex items-center gap-2 self-start px-3 py-1.5 text-sm">
            <LayoutGrid className="h-4 w-4" />
            {t('tables.activeBills', { count: activeCount })}
          </div>
          {reservedCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800/50">
              {t('tables.reservedNow', { count: reservedCount })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <TakeOutCard bill={takeOut} onSendToCheckout={handleSendToCheckout} />
      </div>

      <div>
        <h4 className="text-heading mb-3 text-sm font-semibold uppercase tracking-wide">{t('tables.standardTables')}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {standardTables.map((table) => (
            <TableCard
              key={table.id}
              bill={table}
              reservation={floorReservations[table.id] || floorReservations[String(table.id)]}
              onSendToCheckout={handleSendToCheckout}
              onOpenReservation={setPreview}
            />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-heading mb-3 text-sm font-semibold uppercase tracking-wide">{t('tables.vipRooms')}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {vipTables.map((table) => (
            <TableCard
              key={table.id}
              bill={table}
              reservation={floorReservations[table.id] || floorReservations[String(table.id)]}
              onSendToCheckout={handleSendToCheckout}
              onOpenReservation={setPreview}
            />
          ))}
        </div>
      </div>

      <div className="surface-inset flex flex-wrap items-center gap-4 px-5 py-4">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">{t('tables.statusLegend')}</p>
        {FLOOR_STATUS_KEYS.map((key) => {
          const meta = TABLE_STATUS_META[key]
          return (
            <span key={key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
              {t(meta.labelKey)}
            </span>
          )
        })}
      </div>

      <ReservationPreview
        key={preview?.id || 'closed'}
        reservation={preview}
        busy={previewBusy}
        error={previewError}
        onClose={() => {
          if (previewBusy) return
          setPreview(null)
          setPreviewError('')
        }}
        onCheckIn={handleCheckIn}
        onOpenOrder={handleOpenOrder}
        onCancel={handleCancelBooking}
      />
    </div>
  )
}
