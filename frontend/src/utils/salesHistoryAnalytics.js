export const DEFAULT_HISTORY_DAYS = 730

export function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function buildMonthFilterOptions(lookbackMonths = 6, referenceDate = new Date()) {
  const options = [{ value: 'all', label: 'All months in range' }]

  for (let i = 0; i < lookbackMonths; i += 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1)
    const value = getCurrentMonthKey(date)
    options.push({
      value,
      label: formatMonthLabel(value),
    })
  }

  return options
}

export function normalizeOrderDate(order) {
  if (!order?.date) return null
  const raw = String(order.date).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getOrderMonthKey(order) {
  const normalized = normalizeOrderDate(order)
  return normalized ? normalized.slice(0, 7) : null
}

export function filterOrdersByMonth(orders, monthKey) {
  if (!monthKey || monthKey === 'all') return orders
  return orders.filter((order) => getOrderMonthKey(order) === monthKey)
}

export function filterCompletedOrders(orders) {
  return orders.filter((order) => {
    const status = String(order.status || '').trim().toLowerCase()
    return status === 'completed' || status === 'paid'
  })
}

export function buildDailySalesForMonth(orders, monthKey) {
  if (!monthKey || monthKey === 'all') return []

  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const buckets = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const key = `${monthKey}-${String(day).padStart(2, '0')}`
    return {
      key,
      label: String(day),
      revenue: 0,
      orders: 0,
    }
  })

  const bucketMap = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket]))

  for (const order of orders) {
    const dateKey = normalizeOrderDate(order)
    if (!dateKey || !dateKey.startsWith(monthKey)) continue
    const bucket = bucketMap[dateKey]
    if (!bucket) continue
    bucket.revenue += Number.parseFloat(order.total || 0)
    bucket.orders += 1
  }

  return buckets.map((bucket) => ({
    ...bucket,
    revenue: Math.round(bucket.revenue * 100) / 100,
  }))
}

export function buildMonthlyTotalsChart(orders, monthOptions) {
  const monthKeys = monthOptions.filter((option) => option.value !== 'all').map((option) => option.value)

  return monthKeys
    .map((monthKey) => {
      const monthOrders = filterOrdersByMonth(orders, monthKey)
      const revenue = monthOrders.reduce(
        (sum, order) => sum + Number.parseFloat(order.total || 0),
        0,
      )
      return {
        monthKey,
        label: formatMonthLabel(monthKey).split(' ')[0],
        fullLabel: formatMonthLabel(monthKey),
        revenue: Math.round(revenue * 100) / 100,
        orders: monthOrders.length,
      }
    })
    .reverse()
}

export function summarizeSalesMetrics(orders) {
  const grossRevenue = orders.reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)
  const cashTotal = orders
    .filter((order) => order.payment === 'Cash')
    .reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)
  const bankScanTotal = orders
    .filter((order) => order.payment === 'Bank Scan')
    .reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    ordersFulfilled: orders.length,
    cashTotal: Math.round(cashTotal * 100) / 100,
    bankScanTotal: Math.round(bankScanTotal * 100) / 100,
  }
}
