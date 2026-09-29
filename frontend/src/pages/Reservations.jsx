import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ConfirmationLetterModal from '../components/reservations/ConfirmationLetterModal'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import OperatingHoursNotice from '../components/common/OperatingHoursNotice'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { apiFetch } from '../services/apiClient'
import {
  canCheckInReservation,
  monthRange,
  parseISODate,
  BOOKING_STATUSES,
  RESERVATION_STATUS_META,
  RESERVATION_STATUSES,
  slotLabel,
  toLocalDateISO,
} from '../data/reservations'
import { getTimeSlotsForDate, isMonday, isValidReservationSlot, nextOpenDate } from '../config/siteData'
import { floorTables } from '../data/tables'
import { formatLongDate, formatMonthYear, formatTime12Hour } from '../utils/dateTimeFormat'
import { canIssueConfirmationLetter } from '../utils/reservationLetter'
import { useAlerts } from '../context/AlertsContext'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DEFAULT_OPEN_DATE = nextOpenDate()
const DEFAULT_SLOTS = getTimeSlotsForDate(DEFAULT_OPEN_DATE)

const EMPTY_FORM = {
  customer_name: '',
  phone: '',
  reservation_date: DEFAULT_OPEN_DATE,
  time_slot: DEFAULT_SLOTS[0]?.value || '09:00',
  table_id: '',
  guest_count: 2,
  status: 'Confirmed',
  notes: '',
}

function bookableTables() {
  return floorTables.filter((table) => !table.isTakeOut)
}

function fallbackAvailability() {
  return bookableTables().map((table) => ({
    id: table.id,
    name: table.name,
    section: table.section,
    capacity: table.capacity,
    available: true,
  }))
}

function floorTableLabel(table, t) {
  if (!table) return t('tables.table')
  if (table.section === 'vip' || String(table.name || '').startsWith('VIP')) {
    const match = String(table.name || '').match(/(\d+)/)
    return t('tables.vipRoomNumber', { number: match ? match[1] : table.id })
  }
  const match = String(table.name || '').match(/(\d+)/)
  return t('tables.tableNumber', { number: match ? match[1] : table.id })
}

function reservationTableLabel(reservation, t) {
  const table =
    floorTables.find((entry) => String(entry.id) === String(reservation.table_id)) ||
    (reservation.table_name
      ? { id: reservation.table_id, name: reservation.table_name, section: String(reservation.table_name).startsWith('VIP') ? 'vip' : 'standard' }
      : null)
  return floorTableLabel(table, t)
}

function ReservationCalendar({ monthDate, selectedDate, countsByDate, onSelectDate, onChangeMonth }) {
  const { t } = useTranslation()
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = toLocalDateISO()
  const cells = []

  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day)
  }

  return (
    <div className="surface-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-heading text-sm font-semibold">{t('reservations.calendar')}</p>
          <p className="text-muted text-xs">
            {formatMonthYear(monthDate, t)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-olive-50 dark:hover:bg-zinc-800"
            aria-label={t('reservations.previousMonth')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(0)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-forest-700 hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-forest-950/40"
          >
            {t('reservations.today')}
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-olive-50 dark:hover:bg-zinc-800"
            aria-label={t('reservations.nextMonth')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAY_KEYS.map((day) => (
          <div key={day} className="py-1">
            {t(`dates.weekdays.${day}`)}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="min-h-11" />
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const count = countsByDate[iso] || 0
          const isSelected = selectedDate === iso
          const isToday = today === iso
          const closed = isMonday(iso)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-sm transition ${
                isSelected
                  ? 'bg-forest-600 text-white shadow-sm'
                  : closed
                    ? 'text-muted-foreground/70 hover:bg-stone-100 dark:hover:bg-zinc-800/80'
                    : isToday
                      ? 'bg-forest-50 font-semibold text-forest-800 ring-1 ring-forest-200 dark:bg-forest-950/40 dark:text-forest-200 dark:ring-forest-800'
                      : 'text-foreground hover:bg-olive-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="block leading-none">{day}</span>
              {closed ? (
                <span className={`mt-1 text-[9px] font-semibold uppercase tracking-wide ${isSelected ? 'text-white/80' : 'text-rose-600 dark:text-rose-400'}`}>
                  {t('reservations.closed')}
                </span>
              ) : count > 0 ? (
                <span
                  className={`mt-1 inline-flex h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-violet-500'
                  }`}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BookingFormModal({ isOpen, mode, form, tables, error, saving, onChange, onClose, onSubmit }) {
  const { t } = useTranslation()
  const panelRef = useModalKeyboard({ isOpen, onEscape: onClose, primaryActionMode: 'never' })
  const tableOptions = tables.length ? tables : fallbackAvailability()
  const closedMonday = isMonday(form.reservation_date)
  const timeSlots = closedMonday ? [] : getTimeSlotsForDate(form.reservation_date)

  if (!isOpen) return null

  const handleFieldChange = (field) => (event) => {
    onChange(field, event.target.value)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label={t('a11y.closeBookingForm')} className="modal-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="modal-panel relative z-10 w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-form-title"
      >
        <div className="modal-panel-body p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 id="booking-form-title" className="text-heading text-lg font-semibold">
                {mode === 'edit' ? t('reservations.editReservation') : t('reservations.newReservation')}
              </h4>
              <p className="text-muted mt-1 text-sm">{t('reservations.formDescription')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-olive-50 dark:hover:bg-zinc-800"
              aria-label={t('a11y.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300" htmlFor="booking-customer-name">
                {t('reservations.customerName')}
                <input
                  id="booking-customer-name"
                  name="customer_name"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.customer_name}
                  onChange={handleFieldChange('customer_name')}
                  className="input-field mt-1 px-3 py-2 text-sm"
                  placeholder={t('reservations.guestNamePlaceholder')}
                />
              </label>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300" htmlFor="booking-phone">
                {t('reservations.phoneNumber')}
                <input
                  id="booking-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={form.phone}
                  onChange={handleFieldChange('phone')}
                  className="input-field mt-1 px-3 py-2 text-sm"
                  placeholder="012 345 678"
                />
              </label>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
                {t('reservations.date')}
                <input
                  type="date"
                  name="reservation_date"
                  required
                  value={form.reservation_date}
                  onChange={handleFieldChange('reservation_date')}
                  className="input-field mt-1 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
                {t('reservations.timeSlot')}
                <select
                  name="time_slot"
                  value={closedMonday ? '' : form.time_slot}
                  onChange={handleFieldChange('time_slot')}
                  disabled={closedMonday || timeSlots.length === 0}
                  className="input-field mt-1 bg-white px-3 py-2 text-sm dark:bg-obsidian-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {timeSlots.length === 0 ? (
                    <option value="">{t('reservations.closedMondayValidation')}</option>
                  ) : (
                    timeSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
                {t('reservations.assignedTable')}
                <select
                  name="table_id"
                  required
                  value={form.table_id}
                  onChange={handleFieldChange('table_id')}
                  className="input-field mt-1 bg-white px-3 py-2 text-sm dark:bg-obsidian-900"
                >
                  <option value="">{t('reservations.selectTable')}</option>
                  <optgroup label={t('reservations.standardTables')}>
                    {tableOptions
                      .filter((table) => table.section !== 'vip')
                      .map((table) => (
                        <option
                          key={table.id}
                          value={table.id}
                          disabled={!table.available && String(table.id) !== String(form.table_id)}
                        >
                          {floorTableLabel(table, t)}
                          {!table.available
                            ? ` ${t('reservations.bookedSuffix')}`
                            : ` · ${t('reservations.seatCount', { count: table.capacity })}`}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label={t('reservations.vipRooms')}>
                    {tableOptions
                      .filter((table) => table.section === 'vip')
                      .map((table) => (
                        <option
                          key={table.id}
                          value={table.id}
                          disabled={!table.available && String(table.id) !== String(form.table_id)}
                        >
                          {floorTableLabel(table, t)}
                          {!table.available
                            ? ` ${t('reservations.bookedSuffix')}`
                            : ` · ${t('reservations.seatCount', { count: table.capacity })}`}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
                {t('reservations.guestCount')}
                <input
                  type="number"
                  name="guest_count"
                  min="1"
                  step="1"
                  required
                  value={form.guest_count}
                  onChange={handleFieldChange('guest_count')}
                  className="input-field mt-1 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
              {t('common.status')}
              <select
                name="status"
                value={form.status}
                onChange={handleFieldChange('status')}
                className="input-field mt-1 bg-white px-3 py-2 text-sm dark:bg-obsidian-900"
              >
                {(BOOKING_STATUSES.includes(form.status)
                  ? BOOKING_STATUSES
                  : [...BOOKING_STATUSES, form.status]
                ).map((status) => {
                  const meta = RESERVATION_STATUS_META[status]
                  return (
                    <option key={status} value={status}>
                      {meta?.labelKey ? t(meta.labelKey) : status}
                    </option>
                  )
                })}
              </select>
            </label>

            <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
              {t('reservations.specialRequests')}
              <textarea
                id="booking-notes"
                name="notes"
                value={form.notes}
                onChange={handleFieldChange('notes')}
                rows={3}
                className="input-field mt-1 px-3 py-2 text-sm"
                placeholder={t('reservations.notesPlaceholder')}
              />
            </label>

            {closedMonday ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
                {t('reservations.closedMondayBooking')}
              </p>
            ) : (
              <OperatingHoursNotice />
            )}

            {error ? <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving || closedMonday || timeSlots.length === 0}
                className="btn-primary flex-1 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? t('common.saving')
                  : mode === 'edit'
                    ? t('common.saveChanges')
                    : t('reservations.createBooking')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function Reservations() {
  const { t } = useTranslation()
  const { refresh: refreshAlerts } = useAlerts()
  const today = toLocalDateISO()
  const [monthDate, setMonthDate] = useState(() => parseISODate(today))
  const [selectedDate, setSelectedDate] = useState(today)
  const [reservations, setReservations] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showMonth, setShowMonth] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalMode, setModalMode] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [availability, setAvailability] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [letterReservation, setLetterReservation] = useState(null)
  const [checkingInId, setCheckingInId] = useState(null)

  const range = useMemo(
    () => monthRange(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate],
  )

  const loadReservations = useCallback(async () => {
    try {
      const response = await apiFetch(`/reservations?from=${range.from}&to=${range.to}`)
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data.message || t('reservations.errors.load'))
      setReservations(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      setError(err.message || t('reservations.errors.load'))
      setReservations([])
    } finally {
      setIsLoading(false)
    }
  }, [range.from, range.to, t])

  useEffect(() => {
    setIsLoading(true)
    loadReservations()
  }, [loadReservations])

  const loadAvailability = useCallback(async (date, timeSlot, excludeId) => {
    if (!date || !timeSlot || isMonday(date)) {
      setAvailability(fallbackAvailability())
      return
    }
    try {
      const params = new URLSearchParams({ date, time_slot: timeSlot })
      if (excludeId) params.set('exclude_id', String(excludeId))
      const response = await apiFetch(`/reservations/availability?${params}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('reservations.errors.availability'))
      setAvailability(Array.isArray(data.tables) ? data.tables : [])
    } catch {
      setAvailability(fallbackAvailability())
    }
  }, [t])

  useEffect(() => {
    if (!modalMode) return undefined
    loadAvailability(form.reservation_date, form.time_slot, editing?.id)
    return undefined
  }, [modalMode, form.reservation_date, form.time_slot, editing?.id, loadAvailability])

  const countsByDate = useMemo(() => {
    const counts = {}
    for (const reservation of reservations) {
      if (reservation.status === 'Canceled') continue
      counts[reservation.reservation_date] = (counts[reservation.reservation_date] || 0) + 1
    }
    return counts
  }, [reservations])

  const sheetRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reservations.filter((reservation) => {
      if (!showMonth && reservation.reservation_date !== selectedDate) return false
      if (statusFilter !== 'all' && reservation.status !== statusFilter) return false
      if (!query) return true
      return [reservation.customer_name, reservation.phone, reservation.table_name, reservation.notes]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [reservations, selectedDate, showMonth, statusFilter, search])

  const selectedDayCount = countsByDate[selectedDate] || 0

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, reservation_date: selectedDate || today })
    setFormError('')
    setAvailability(fallbackAvailability())
    setModalMode('create')
  }

  const openEdit = (reservation) => {
    const date = reservation.reservation_date
    const slots = getTimeSlotsForDate(date)
    const currentSlot = String(reservation.time_slot).slice(0, 5)
    setEditing(reservation)
    setForm({
      customer_name: reservation.customer_name,
      phone: reservation.phone,
      reservation_date: date,
      time_slot: slots.some((slot) => slot.value === currentSlot) ? currentSlot : slots[0]?.value || currentSlot,
      table_id: String(reservation.table_id),
      guest_count: reservation.guest_count,
      status: reservation.status,
      notes: reservation.notes || '',
    })
    setFormError('')
    setAvailability(fallbackAvailability())
    setModalMode('edit')
  }

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => {
      if (field !== 'reservation_date') return { ...prev, [field]: value }
      const slots = getTimeSlotsForDate(value)
      const nextSlot = slots.some((slot) => slot.value === prev.time_slot)
        ? prev.time_slot
        : slots[0]?.value || ''
      return { ...prev, reservation_date: value, time_slot: nextSlot }
    })
  }, [])

  const closeBookingModal = useCallback(() => {
    setModalMode(null)
    setFormError('')
  }, [])

  const handleCheckIn = async (reservation) => {
    if (!canCheckInReservation(reservation)) return
    setCheckingInId(reservation.id)
    setError('')
    try {
      const response = await apiFetch(`/reservations/${reservation.id}/check-in`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('reservations.errors.checkIn'))
      setReservations((prev) => prev.map((row) => (row.id === data.id ? data : row)))
      refreshAlerts?.()
    } catch (err) {
      setError(err.message || t('reservations.errors.checkIn'))
    } finally {
      setCheckingInId(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isMonday(form.reservation_date)) {
      setFormError(t('reservations.closedMondayValidation'))
      return
    }
    if (!isValidReservationSlot(form.reservation_date, form.time_slot)) {
      setFormError(t('reservations.invalidTimeSlot'))
      return
    }
    setSaving(true)
    setFormError('')
    const payload = {
      ...form,
      table_id: Number.parseInt(form.table_id, 10),
      guest_count: Number.parseInt(form.guest_count, 10),
    }
    try {
      const path = modalMode === 'edit' && editing ? `/reservations/${editing.id}` : '/reservations'
      const response = await apiFetch(path, {
        method: modalMode === 'edit' ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('reservations.errors.save'))
      setModalMode(null)
      setEditing(null)
      await loadReservations()
    } catch (err) {
      setFormError(err.message || t('reservations.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const response = await apiFetch(`/reservations/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || t('reservations.errors.delete'))
      setDeleteTarget(null)
      await loadReservations()
    } catch (err) {
      setError(err.message || t('reservations.errors.delete'))
      setDeleteTarget(null)
    }
  }

  const handleChangeMonth = (direction) => {
    if (direction === 0) {
      const now = parseISODate(today)
      setMonthDate(now)
      setSelectedDate(today)
      setShowMonth(false)
      return
    }
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1)
    setMonthDate(next)
    const selected = parseISODate(selectedDate)
    if (selected.getMonth() !== next.getMonth() || selected.getFullYear() !== next.getFullYear()) {
      setSelectedDate(toLocalDateISO(next))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-heading text-lg">{t('nav.reservations')}</h3>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />
          {t('reservations.newBooking')}
        </button>
      </div>

      <OperatingHoursNotice />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <ReservationCalendar
          monthDate={monthDate}
          selectedDate={selectedDate}
          countsByDate={countsByDate}
          onSelectDate={(iso) => {
            setSelectedDate(iso)
            setShowMonth(false)
          }}
          onChangeMonth={handleChangeMonth}
        />

        <div className="surface-card flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-forest-600 dark:text-forest-400" />
              <p className="text-heading text-sm font-semibold">
                {formatLongDate(parseISODate(selectedDate), t)}
              </p>
            </div>
            <p className="text-muted mt-2 text-sm">
              {isMonday(selectedDate)
                ? t('reservations.unavailableOnDate')
                : selectedDayCount === 0
                  ? t('reservations.noneOnDate')
                  : t('reservations.bookingCount', { count: selectedDayCount })}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {BOOKING_STATUSES.map((status) => {
              const count = reservations.filter(
                (row) => row.reservation_date === selectedDate && row.status === status,
              ).length
              const meta = RESERVATION_STATUS_META[status]
              return (
                <div key={status} className="rounded-2xl border border-border px-3 py-3">
                  <p className="text-muted text-[11px] font-semibold uppercase tracking-wide">
                    {t(meta.labelKey)}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-heading text-sm font-semibold">{t('reservations.sheet')}</p>
            <p className="text-muted text-xs">
              {showMonth ? t('reservations.showingFullMonth') : t('reservations.filteredTo', { date: selectedDate })}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reservations.searchPlaceholder')}
                className="input-field w-full py-2 pl-9 pr-3 text-sm sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input-field bg-white px-3 py-2 text-sm dark:bg-obsidian-900"
            >
              <option value="all">{t('reservations.allStatuses')}</option>
              {RESERVATION_STATUSES.map((status) => {
                const meta = RESERVATION_STATUS_META[status]
                return (
                  <option key={status} value={status}>
                    {meta?.labelKey ? t(meta.labelKey) : status}
                  </option>
                )
              })}
            </select>
            <button
              type="button"
              onClick={() => setShowMonth((prev) => !prev)}
              className="btn-secondary px-3 py-2 text-xs font-semibold"
            >
              {showMonth ? t('reservations.showSelectedDay') : t('reservations.showFullMonth')}
            </button>
          </div>
        </div>

        {error ? <p className="px-5 py-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-olive-50/70 text-xs uppercase tracking-wide text-muted-foreground dark:bg-zinc-900/60">
              <tr>
                <th className="px-5 py-3 font-semibold">{t('reservations.date')}</th>
                <th className="px-5 py-3 font-semibold">{t('reservations.timeSlot')}</th>
                <th className="px-5 py-3 font-semibold">{t('reservations.customerName')}</th>
                <th className="px-5 py-3 font-semibold">{t('reservations.phoneNumber')}</th>
                <th className="px-5 py-3 font-semibold">{t('reservations.guestCount')}</th>
                <th className="px-5 py-3 font-semibold">{t('tables.table')}</th>
                <th className="px-5 py-3 font-semibold">{t('common.status')}</th>
                <th className="px-5 py-3 font-semibold">{t('common.notes')}</th>
                <th className="px-5 py-3 font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                    {t('reservations.loading')}
                  </td>
                </tr>
              ) : sheetRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                    {t('reservations.emptyFiltered')}
                  </td>
                </tr>
              ) : (
                sheetRows.map((reservation) => {
                  const meta = RESERVATION_STATUS_META[reservation.status] || RESERVATION_STATUS_META.Pending
                  return (
                    <tr key={reservation.id} className="align-top hover:bg-olive-50/40 dark:hover:bg-zinc-900/40">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums">{reservation.reservation_date}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {slotLabel(
                          reservation.time_slot,
                          reservation.time_slot_label,
                          reservation.duration_minutes,
                        )}
                      </td>
                      <td className="px-5 py-3 font-medium">{reservation.customer_name}</td>
                      <td className="whitespace-nowrap px-5 py-3">{reservation.phone}</td>
                      <td className="px-5 py-3 tabular-nums">{reservation.guest_count}</td>
                      <td className="px-5 py-3">{reservationTableLabel(reservation, t)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
                          {t(meta.labelKey)}
                        </span>
                        {reservation.status === 'Seated' && reservation.checked_in_at ? (
                          <span className="text-muted mt-1 block text-[11px]">
                            {t('reservations.checkedInAt', { time: formatTime12Hour(reservation.checked_in_at) })}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] px-5 py-3 text-xs text-muted-foreground">
                        {reservation.notes || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {canCheckInReservation(reservation) ? (
                            <button
                              type="button"
                              disabled={checkingInId === reservation.id}
                              onClick={() => handleCheckIn(reservation)}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={t('a11y.checkInGuest', { name: reservation.customer_name })}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              {checkingInId === reservation.id ? '…' : t('reservations.checkIn')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={!canIssueConfirmationLetter(reservation)}
                            onClick={() => setLetterReservation(reservation)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-forest-300 dark:hover:bg-forest-950/40"
                            aria-label={t('a11y.confirmationLetterFor', { name: reservation.customer_name })}
                            title={
                              canIssueConfirmationLetter(reservation)
                                ? t('reservations.confirmationLetter')
                                : t('reservations.confirmationUnavailableCanceled')
                            }
                          >
                            <ScrollText className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(reservation)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-forest-950/40"
                            aria-label={t('a11y.editGuest', { name: reservation.customer_name })}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(reservation)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            aria-label={t('a11y.deleteGuest', { name: reservation.customer_name })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BookingFormModal
        isOpen={Boolean(modalMode)}
        mode={modalMode}
        form={form}
        tables={availability}
        error={formError}
        saving={saving}
        onChange={handleFormChange}
        onClose={closeBookingModal}
        onSubmit={handleSubmit}
      />

      <ConfirmationLetterModal
        isOpen={Boolean(letterReservation)}
        reservation={letterReservation}
        onClose={() => setLetterReservation(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title={t('reservations.deleteTitle')}
        itemName={deleteTarget?.customer_name}
        message={t('reservations.deleteMessage')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
