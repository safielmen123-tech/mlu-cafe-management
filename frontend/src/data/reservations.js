import { formatSlotRange12Hour } from '../utils/dateTimeFormat'
import {
  ALL_TIME_SLOTS,
  CLOSED_WEEKDAY,
  getTimeSlotsForDate,
  isMonday,
  LOW_SEASON_TIME_SLOTS,
  nextOpenDate,
} from '../config/siteData'

export const RESERVATION_STATUSES = ['Pending', 'Confirmed', 'Reserved', 'Seated', 'Completed', 'Canceled']
export const CHECK_IN_STATUSES = ['Pending', 'Confirmed', 'Reserved']
export const SEATED_STATUS = 'Seated'

/** Default bookable slots (low season). Prefer getTimeSlotsForDate(date) in the UI. */
export const TIME_SLOTS = LOW_SEASON_TIME_SLOTS

export { ALL_TIME_SLOTS, getTimeSlotsForDate, isMonday, nextOpenDate, CLOSED_WEEKDAY }

export const RESERVATION_STATUS_META = {
  Pending: {
    label: 'Pending',
    badge:
      'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
  },
  Confirmed: {
    label: 'Confirmed',
    badge:
      'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/50',
  },
  Reserved: {
    label: 'Reserved',
    badge:
      'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800/50',
  },
  Seated: {
    label: 'Seated',
    badge:
      'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
  },
  Completed: {
    label: 'Completed',
    badge:
      'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
  },
  Canceled: {
    label: 'Canceled',
    badge:
      'bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
  },
}

export function toLocalDateISO(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseISODate(value) {
  const raw = String(value || '').slice(0, 10)
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

export function monthRange(year, monthIndex) {
  const from = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const to = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export function canCheckInReservation(reservation, today = toLocalDateISO()) {
  if (!reservation?.id) return false
  if (!CHECK_IN_STATUSES.includes(reservation.status)) return false
  return reservation.reservation_date === today
}

export function slotLabel(timeSlot, fallbackLabel, durationMinutes = 120) {
  return formatSlotRange12Hour(timeSlot, durationMinutes, fallbackLabel)
}
