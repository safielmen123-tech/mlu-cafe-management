const CLOSED_WEEKDAY = 1
const HIGH_SEASON_MONTHS = [11, 12, 1, 2, 3]

const STORE_SCHEDULE = {
  lowSeason: {
    openHour: 9,
    closeHour: 21,
    lastReservationStartHour: 20,
  },
  highSeason: {
    openHour: 7,
    closeHour: 21,
    lastReservationStartHour: 20,
  },
}

const OPERATING_HOURS_NOTICE =
  'Operating Hours: Low Season (9:00 AM - 9:00 PM) | High Season (7:00 AM - 9:00 PM) | Closed Mondays'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toHHmm(hour, minute = 0) {
  return `${pad2(hour)}:${pad2(minute)}`
}

function formatTime12Hour(hhmm) {
  const match = String(hhmm).match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return String(hhmm)
  const date = new Date(2000, 0, 1, Number.parseInt(match[1], 10), Number.parseInt(match[2], 10))
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatTimeRange12Hour(start, end) {
  return `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`
}

function parseIsoDate(value) {
  const raw = String(value || '').slice(0, 10)
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

function isMonday(dateInput) {
  return parseIsoDate(dateInput).getDay() === CLOSED_WEEKDAY
}

function isHighSeasonMonth(dateInput) {
  const month = parseIsoDate(dateInput).getMonth() + 1
  return HIGH_SEASON_MONTHS.includes(month)
}

function generateTimeSlots(isHighSeason) {
  const season = isHighSeason ? STORE_SCHEDULE.highSeason : STORE_SCHEDULE.lowSeason
  const slots = []
  const seen = new Set()

  for (let hour = season.openHour; hour + 2 <= season.closeHour; hour += 2) {
    const start = toHHmm(hour)
    const end = toHHmm(hour + 2)
    seen.add(start)
    slots.push({
      value: start,
      label: formatTimeRange12Hour(start, end),
      durationMinutes: 120,
    })
  }

  const lastStart = toHHmm(season.lastReservationStartHour)
  const lastEnd = toHHmm(season.closeHour)
  if (!seen.has(lastStart)) {
    slots.push({
      value: lastStart,
      label: formatTimeRange12Hour(lastStart, lastEnd),
      durationMinutes: 60,
    })
  }

  return slots
}

function getTimeSlotsForDate(dateInput) {
  if (isMonday(dateInput)) return []
  return generateTimeSlots(isHighSeasonMonth(dateInput))
}

const TIME_SLOTS = [
  ...generateTimeSlots(true),
  ...generateTimeSlots(false).filter((slot) => !generateTimeSlots(true).some((entry) => entry.value === slot.value)),
]

module.exports = {
  CLOSED_WEEKDAY,
  HIGH_SEASON_MONTHS,
  STORE_SCHEDULE,
  OPERATING_HOURS_NOTICE,
  isMonday,
  isHighSeasonMonth,
  generateTimeSlots,
  getTimeSlotsForDate,
  TIME_SLOTS,
  formatTime12Hour,
  formatTimeRange12Hour,
}
