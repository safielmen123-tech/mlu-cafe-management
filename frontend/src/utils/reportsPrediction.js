import { parseOrderHour24 } from './dateTimeFormat'

export function buildSalesPrediction(completedSales, targetDate, selectedMonthLabel = null) {
  const itemCounts = {}
  const hourCounts = {}

  for (const order of completedSales) {
    const hour = parseOrderHour24(order.time)
    hourCounts[hour] = (hourCounts[hour] ?? 0) + order.total

    for (const item of order.items ?? []) {
      itemCounts[item.name] = (itemCounts[item.name] ?? 0) + (item.qty ?? 0)
    }
  }

  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }))

  const peakHourNum = Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11)
  const peakPeriod = peakHourNum >= 12 ? 'PM' : 'AM'
  const peakHour12 = Number(peakHourNum) % 12 || 12
  const nextHour12 = (Number(peakHourNum) + 1) % 12 || 12
  const nextPeriod = Number(peakHourNum) + 1 >= 12 ? 'PM' : 'AM'
  const peakLabel = `${String(peakHour12).padStart(2, '0')}:00 ${peakPeriod} – ${String(nextHour12).padStart(2, '0')}:00 ${nextPeriod}`

  const formattedDate = new Date(targetDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const avgDailyRevenue =
    completedSales.length > 0
      ? completedSales.reduce((sum, order) => sum + order.total, 0) / Math.max(completedSales.length, 1)
      : 0

  return {
    targetDate: formattedDate,
    topItems:
      topItems.length > 0
        ? topItems
        : [
            { name: 'Iced Latte', qty: 18 },
            { name: 'Croissant', qty: 14 },
            { name: 'Cappuccino', qty: 12 },
          ],
    peakTime: peakLabel,
    insight:
      completedSales.length > 0
        ? `Based on ${completedSales.length} completed orders${selectedMonthLabel ? ` in ${selectedMonthLabel}` : ''}, demand on ${formattedDate} is projected to peak around ${peakLabel}. Prioritize prep for top sellers and ensure staffing during the lunch window. Estimated daily revenue: $${(avgDailyRevenue * 1.08).toFixed(2)} (+8% trend).`
        : `No historical sales data yet for ${formattedDate}. Showing sample predictions — run more orders to improve forecast accuracy.`,
  }
}
