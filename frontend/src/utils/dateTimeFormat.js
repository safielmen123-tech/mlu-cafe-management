const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24H_REGEX = /^(\d{1,2}):(\d{2})$/
const TIME_12H_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i

export function formatOrderDate(input) {
  if (!input) return '—'

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '—'
    const year = input.getFullYear()
    const month = String(input.getMonth() + 1).padStart(2, '0')
    const day = String(input.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const raw = String(input).trim()
  if (DATE_ISO_REGEX.test(raw)) return raw

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return formatOrderDate(parsed)
}

export function formatTime12Hour(input) {
  if (!input) return '—'

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '—'
    return input.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const raw = String(input).trim()
  const twelveHourMatch = raw.match(TIME_12H_REGEX)
  if (twelveHourMatch) {
    const hour = String(Number.parseInt(twelveHourMatch[1], 10)).padStart(2, '0')
    const minute = twelveHourMatch[2]
    const period = twelveHourMatch[3].toUpperCase()
    return `${hour}:${minute} ${period}`
  }

  const twentyFourHourMatch = raw.match(TIME_24H_REGEX)
  if (twentyFourHourMatch) {
    const hour24 = Number.parseInt(twentyFourHourMatch[1], 10)
    const minute = twentyFourHourMatch[2]
    const period = hour24 >= 12 ? 'PM' : 'AM'
    const hour12 = hour24 % 12 || 12
    return `${String(hour12).padStart(2, '0')}:${minute} ${period}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return formatTime12Hour(parsed)
  }

  return raw
}

export function formatDateTimeDisplay(dateInput, timeInput) {
  const date = formatOrderDate(dateInput)
  const time = formatTime12Hour(timeInput)
  if (date === '—' && time === '—') return '—'
  if (date === '—') return time
  if (time === '—') return date
  return `${date} ${time}`
}

export function parseOrderHour24(timeInput) {
  const raw = String(timeInput || '').trim()
  const twelveHourMatch = raw.match(TIME_12H_REGEX)
  if (twelveHourMatch) {
    let hour = Number.parseInt(twelveHourMatch[1], 10) % 12
    if (twelveHourMatch[3].toUpperCase() === 'PM') hour += 12
    return hour
  }

  const twentyFourHourMatch = raw.match(TIME_24H_REGEX)
  if (twentyFourHourMatch) {
    return Number.parseInt(twentyFourHourMatch[1], 10)
  }

  return 10
}

export function parseOrderTimestamp(order) {
  const date = formatOrderDate(order?.date)
  const hour = parseOrderHour24(order?.time)
  const minuteMatch = String(order?.time || '').match(/:(\d{2})/)
  const minute = minuteMatch ? Number.parseInt(minuteMatch[1], 10) : 0

  if (date === '—') return 0

  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0).getTime()
}

export function sortOrdersByDateTime(orders, direction = 'desc') {
  const sorted = [...orders].sort((a, b) => parseOrderTimestamp(a) - parseOrderTimestamp(b))
  return direction === 'desc' ? sorted.reverse() : sorted
}
