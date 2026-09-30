const { parseBackupPeriod } = require('./backupPeriod')
const {
  actorLabel,
  formatMoney,
  pdfSafe,
  roundMoney,
  salesPdfFilename,
} = require('./exportParams')
const { drawDocumentHeader, drawNote, drawTable, renderPdf } = require('./pdfLayout')

const COMPLETED = `UPPER(status) IN ('COMPLETED', 'PAID')`
const PAYMENT_SQL = `COALESCE(NULLIF(payment_method, ''), NULLIF(payment_type, ''), 'Cash')`
const TOTAL_SQL = `COALESCE(total, total_amount, 0)`

const FLOOR_LABELS = {
  1: 'Table 1',
  2: 'Table 2',
  3: 'Table 3',
  4: 'Table 4',
  5: 'Table 5',
  6: 'Table 6',
  7: 'Table 7',
  8: 'Table 8',
  9: 'VIP Room 1',
  10: 'VIP Room 2',
}

function paymentBucket(method) {
  const value = String(method || 'Cash').trim().toLowerCase()
  if (value === 'bank scan') return 'bank'
  if (value === 'cash') return 'cash'
  return 'other'
}

function sourceLabel(row) {
  const target = row.target_id == null ? '' : String(row.target_id)
  if (!target || target === 'takeout' || row.source_type === 'Take Out') return 'Take Out'
  return FLOOR_LABELS[target] || `Table ${target}`
}

function orderLabel(row) {
  const invoice = String(row.invoice_id || '').trim()
  return invoice || String(row.id)
}

function statusLabel(status) {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'paid') return 'Paid'
  if (value === 'completed') return 'Completed'
  return pdfSafe(status)
}

async function loadMonthSales(db, period) {
  const [rows] = await db.execute(
    `
    SELECT
      id,
      invoice_id,
      target_id,
      source_type,
      ${PAYMENT_SQL} AS payment,
      ${TOTAL_SQL} AS total,
      status,
      DATE_FORMAT(updated_at, '%Y-%m-%d %h:%i %p') AS sold_at
    FROM orders
    WHERE ${COMPLETED}
      AND updated_at >= ? AND updated_at < ?
    ORDER BY updated_at ASC, id ASC
    `,
    [period.startDate, period.endDate],
  )

  const totals = { orders: rows.length, gross: 0, cash: 0, bank: 0, other: 0 }
  const lines = rows.map((row) => {
    const amount = roundMoney(row.total)
    totals.gross = roundMoney(totals.gross + amount)
    const bucket = paymentBucket(row.payment)
    totals[bucket] = roundMoney(totals[bucket] + amount)
    return {
      orderId: orderLabel(row),
      source: sourceLabel(row),
      soldAt: row.sold_at || '',
      payment: row.payment || 'Cash',
      total: amount,
      status: statusLabel(row.status),
    }
  })
  return { lines, totals }
}

async function loadAllTimeSummary(db) {
  const [rows] = await db.execute(
    `
    SELECT
      DATE_FORMAT(updated_at, '%Y-%m') AS month_key,
      COUNT(*) AS orders,
      COALESCE(SUM(${TOTAL_SQL}), 0) AS gross,
      COALESCE(SUM(CASE WHEN LOWER(${PAYMENT_SQL}) = 'cash' THEN ${TOTAL_SQL} ELSE 0 END), 0) AS cash_total,
      COALESCE(SUM(CASE WHEN LOWER(${PAYMENT_SQL}) = 'bank scan' THEN ${TOTAL_SQL} ELSE 0 END), 0) AS bank_total,
      COALESCE(SUM(CASE
        WHEN LOWER(${PAYMENT_SQL}) NOT IN ('cash', 'bank scan') THEN ${TOTAL_SQL}
        ELSE 0
      END), 0) AS other_total
    FROM orders
    WHERE ${COMPLETED}
    GROUP BY DATE_FORMAT(updated_at, '%Y-%m')
    ORDER BY month_key ASC
    `,
  )

  const months = rows.map((row) => ({
    monthKey: row.month_key,
    orders: Number(row.orders) || 0,
    gross: roundMoney(row.gross),
    cash: roundMoney(row.cash_total),
    bank: roundMoney(row.bank_total),
    other: roundMoney(row.other_total),
  }))
  const totals = months.reduce((sum, month) => ({
    orders: sum.orders + month.orders,
    gross: roundMoney(sum.gross + month.gross),
    cash: roundMoney(sum.cash + month.cash),
    bank: roundMoney(sum.bank + month.bank),
    other: roundMoney(sum.other + month.other),
  }), { orders: 0, gross: 0, cash: 0, bank: 0, other: 0 })
  return { months, totals }
}

function monthName(monthKey) {
  const [year, month] = String(monthKey || '').split('-')
  const index = Number(month) - 1
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  if (!year || !names[index]) return monthKey
  return `${names[index]} ${year}`
}

function buildSalesPdfBuffer({ period, generatedBy, monthData, summary }) {
  return renderPdf((doc) => {
    doc.info.Title = 'Sales data'
    doc.info.Author = generatedBy
    let y = drawDocumentHeader(doc, {
      title: 'Sales data',
      periodLabel: period.label,
      generatedBy,
    })

    if (period.scope === 'month') {
      y = drawNote(doc, y, `Completed orders for ${period.label}.`)
      const rows = monthData.lines.map((line) => ({
        values: [
          line.orderId,
          line.source,
          line.soldAt,
          line.payment,
          formatMoney(line.total),
          line.status,
        ],
      }))
      rows.push({
        total: true,
        values: [
          'Total',
          '',
          '',
          `${monthData.totals.orders} orders`,
          formatMoney(monthData.totals.gross),
          '',
        ],
      })
      y = drawTable(doc, y, [
        { label: 'Order ID', width: 90 },
        { label: 'Source', width: 100 },
        { label: 'Date/Time', width: 120 },
        { label: 'Payment', width: 75 },
        { label: 'Total', width: 70, align: 'right' },
        { label: 'Status', width: 60 },
      ], rows)
      y = drawNote(doc, y, `Cash ${formatMoney(monthData.totals.cash)}    Bank ${formatMoney(monthData.totals.bank)}`)
      if (monthData.totals.other > 0) {
        drawNote(doc, y, `Other payments ${formatMoney(monthData.totals.other)}`)
      }
      return
    }

    y = drawNote(doc, y, 'Month-by-month summary. This file does not list every order.')
    const rows = summary.months.map((month) => ({
      values: [
        monthName(month.monthKey),
        String(month.orders),
        formatMoney(month.gross),
        formatMoney(month.cash),
        formatMoney(month.bank),
      ],
    }))
    rows.push({
      total: true,
      values: [
        'Grand total',
        String(summary.totals.orders),
        formatMoney(summary.totals.gross),
        formatMoney(summary.totals.cash),
        formatMoney(summary.totals.bank),
      ],
    })
    y = drawTable(doc, y, [
      { label: 'Month', width: 130 },
      { label: 'Orders', width: 70, align: 'right' },
      { label: 'Gross revenue', width: 110, align: 'right' },
      { label: 'Cash', width: 100, align: 'right' },
      { label: 'Bank', width: 100, align: 'right' },
    ], rows)
    if (summary.totals.other > 0) {
      drawNote(doc, y, `Other payments ${formatMoney(summary.totals.other)} are included in gross revenue only.`)
    }
  })
}

async function createSalesPdf(db, query, user) {
  const period = parseBackupPeriod(query)
  const generatedBy = actorLabel(user)
  const payload = period.scope === 'month'
    ? { monthData: await loadMonthSales(db, period), summary: null }
    : { monthData: null, summary: await loadAllTimeSummary(db) }
  const buffer = await buildSalesPdfBuffer({ period, generatedBy, ...payload })
  return {
    buffer,
    filename: salesPdfFilename(period),
    periodLabel: period.label,
  }
}

module.exports = {
  createSalesPdf,
  buildSalesPdfBuffer,
  paymentBucket,
  sourceLabel,
}
