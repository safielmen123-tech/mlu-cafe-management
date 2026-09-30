const ExcelJS = require('exceljs')
const {
  actorLabel,
  formatMoney,
  parseReportMonth,
  parseReportSections,
  reportFilename,
  roundMoney,
} = require('./exportParams')
const {
  drawDocumentHeader,
  drawNote,
  drawSectionTitle,
  drawTable,
  renderPdf,
} = require('./pdfLayout')

const HISTORY_DAYS = 730
const MONTH_LOOKBACK = 16
const COMPLETED = `UPPER(status) IN ('COMPLETED', 'PAID')`
const TOTAL_SQL = `COALESCE(total, total_amount, 0)`
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-')
  const name = MONTH_NAMES[Number(month) - 1]
  return name ? `${name} ${year}` : String(monthKey || '')
}

function lastMonthKeys(count, now = new Date()) {
  const keys = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function daysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

async function sumOrders(db, whereSql, params) {
  const [[row]] = await db.execute(
    `
    SELECT COUNT(*) AS orders, COALESCE(SUM(${TOTAL_SQL}), 0) AS revenue
    FROM orders
    WHERE ${COMPLETED} AND ${whereSql}
    `,
    params,
  )
  return {
    orders: Number(row?.orders) || 0,
    revenue: roundMoney(row?.revenue),
  }
}

async function orderBuckets(db, whereSql, params, grain) {
  const format = grain === 'day' ? '%Y-%m-%d' : '%Y-%m'
  const [rows] = await db.execute(
    `
    SELECT
      DATE_FORMAT(updated_at, '${format}') AS bucket,
      COUNT(*) AS orders,
      COALESCE(SUM(${TOTAL_SQL}), 0) AS revenue
    FROM orders
    WHERE ${COMPLETED} AND ${whereSql}
    GROUP BY DATE_FORMAT(updated_at, '${format}')
    `,
    params,
  )
  return new Map(rows.map((row) => [row.bucket, {
    orders: Number(row.orders) || 0,
    revenue: roundMoney(row.revenue),
  }]))
}

function expenseMap(expenses, grain) {
  const map = new Map()
  for (const expense of expenses) {
    const key = String(expense.expense_date || '').slice(0, grain === 'day' ? 10 : 7)
    if (!key) continue
    const current = map.get(key) || { amount: 0 }
    current.amount = roundMoney(current.amount + Number(expense.amount || 0))
    map.set(key, current)
  }
  return map
}

function categoryTotals(expenses) {
  const totals = new Map()
  for (const expense of expenses) {
    const category = expense.category || 'Others'
    totals.set(category, roundMoney((totals.get(category) || 0) + Number(expense.amount || 0)))
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
}

async function loadExpensesInScope(db, period) {
  const { listExpenses } = require('./expenses')
  const expenses = await listExpenses(db, { days: HISTORY_DAYS })
  if (period.scope !== 'month') return expenses
  return expenses.filter((expense) => String(expense.expense_date || '').startsWith(period.fileKey))
}

async function loadReportData(db, period) {
  if (period.scope === 'month') {
    const whereSql = 'updated_at >= ? AND updated_at < ?'
    const params = [period.startDate, period.endDate]
    const summary = await sumOrders(db, whereSql, params)
    const expenses = await loadExpensesInScope(db, period)
    const spending = roundMoney(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))
    const salesByDay = await orderBuckets(db, whereSql, params, 'day')
    const spendByDay = expenseMap(expenses, 'day')
    const breakdown = Array.from({ length: daysInMonth(period.fileKey) }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      const key = `${period.fileKey}-${day}`
      const sales = salesByDay.get(key) || { orders: 0, revenue: 0 }
      const expensesTotal = spendByDay.get(key)?.amount || 0
      return {
        label: key,
        orders: sales.orders,
        revenue: sales.revenue,
        expenses: expensesTotal,
        profit: roundMoney(sales.revenue - expensesTotal),
      }
    })
    return {
      period,
      summary: {
        revenue: summary.revenue,
        expenses: spending,
        profit: roundMoney(summary.revenue - spending),
        orders: summary.orders,
      },
      breakdown,
      breakdownLabel: 'Daily breakdown',
      spending: categoryTotals(expenses),
    }
  }

  const whereSql = 'updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
  const summary = await sumOrders(db, whereSql, [HISTORY_DAYS])
  const expenses = await loadExpensesInScope(db, period)
  const spending = roundMoney(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))
  const salesByMonth = await orderBuckets(db, whereSql, [HISTORY_DAYS], 'month')
  const spendByMonth = expenseMap(expenses, 'month')
  const breakdown = lastMonthKeys(MONTH_LOOKBACK)
    .map((key) => {
      const sales = salesByMonth.get(key) || { orders: 0, revenue: 0 }
      const expensesTotal = spendByMonth.get(key)?.amount || 0
      return {
        label: monthLabel(key),
        orders: sales.orders,
        revenue: sales.revenue,
        expenses: expensesTotal,
        profit: roundMoney(sales.revenue - expensesTotal),
      }
    })
    .filter((row) => row.revenue > 0 || row.expenses > 0)

  return {
    period,
    summary: {
      revenue: summary.revenue,
      expenses: spending,
      profit: roundMoney(summary.revenue - spending),
      orders: summary.orders,
    },
    breakdown,
    breakdownLabel: 'Monthly breakdown',
    spending: categoryTotals(expenses),
  }
}

function summaryRows(data, sections) {
  const rows = []
  if (sections.includes('income')) rows.push(['Income', data.summary.revenue])
  if (sections.includes('expenses')) rows.push(['Expenses', data.summary.expenses])
  if (sections.includes('profit')) rows.push(['Net profit', data.summary.profit])
  if (sections.includes('orders')) rows.push(['Orders fulfilled', data.summary.orders])
  return rows
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FF064E3B' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
  row.alignment = { vertical: 'middle' }
}

function fitColumns(sheet) {
  sheet.columns.forEach((column) => {
    let width = 12
    column.eachCell({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length + 2
      if (length > width) width = length
    })
    column.width = Math.min(width, 42)
  })
}

function addSheet(workbook, name, headers, rows, moneyIndexes) {
  const sheet = workbook.addWorksheet(name)
  styleHeader(sheet.addRow(headers))
  for (const values of rows) {
    const row = sheet.addRow(values)
    moneyIndexes.forEach((index) => {
      const cell = row.getCell(index)
      if (typeof cell.value === 'number') cell.numFmt = '$#,##0.00'
    })
  }
  fitColumns(sheet)
  return sheet
}

async function buildReportWorkbook(data, sections) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mlu Kitchen & Cafe Siem Reap'
  const summary = summaryRows(data, sections)
  if (summary.length) {
    const sheet = addSheet(workbook, 'Summary', ['Metric', 'Value'], summary, [])
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const metric = row.getCell(1).value
      const cell = row.getCell(2)
      if (metric === 'Orders fulfilled') {
        cell.numFmt = '#,##0'
      } else if (typeof cell.value === 'number') {
        cell.numFmt = '$#,##0.00'
      }
    })
  }
  if (sections.includes('monthly')) {
    addSheet(
      workbook,
      data.period.scope === 'month' ? 'Daily' : 'Monthly',
      ['Period', 'Orders', 'Income', 'Expenses', 'Net profit'],
      data.breakdown.map((row) => [row.label, row.orders, row.revenue, row.expenses, row.profit]),
      [3, 4, 5],
    )
  }
  if (sections.includes('spending')) {
    addSheet(
      workbook,
      'Spending by category',
      ['Category', 'Amount'],
      data.spending.map((row) => [row.category, row.amount]),
      [2],
    )
  }
  return workbook.xlsx.writeBuffer()
}

function buildReportPdfBuffer(data, sections, generatedBy) {
  return renderPdf((doc) => {
    doc.info.Title = 'Business report'
    doc.info.Author = generatedBy
    let y = drawDocumentHeader(doc, {
      title: 'Business report',
      periodLabel: data.period.label,
      generatedBy,
    })
    y = drawNote(doc, y, 'Figures follow the Reports page. The chart is shown as a table.')

    const summary = summaryRows(data, sections)
    if (summary.length) {
      y = drawSectionTitle(doc, y, 'Summary')
      y = drawTable(
        doc,
        y,
        [
          { label: 'Metric', width: 220 },
          { label: 'Value', width: 140, align: 'right' },
        ],
        summary.map(([metric, value]) => ({
          values: [metric, metric === 'Orders fulfilled' ? String(value) : formatMoney(value)],
        })),
      )
    }

    if (sections.includes('monthly')) {
      y = drawSectionTitle(doc, y, data.breakdownLabel)
      y = drawTable(
        doc,
        y,
        [
          { label: 'Period', width: 140 },
          { label: 'Orders', width: 70, align: 'right' },
          { label: 'Income', width: 100, align: 'right' },
          { label: 'Expenses', width: 100, align: 'right' },
          { label: 'Net profit', width: 100, align: 'right' },
        ],
        data.breakdown.map((row) => ({
          values: [
            row.label,
            String(row.orders),
            formatMoney(row.revenue),
            formatMoney(row.expenses),
            formatMoney(row.profit),
          ],
        })),
      )
    }

    if (sections.includes('spending')) {
      y = drawSectionTitle(doc, y, 'Spending by category')
      drawTable(
        doc,
        y,
        [
          { label: 'Category', width: 260 },
          { label: 'Amount', width: 120, align: 'right' },
        ],
        data.spending.map((row) => ({
          values: [row.category, formatMoney(row.amount)],
        })),
      )
    }
  })
}

async function createReportExport(db, query, user, kind) {
  const period = parseReportMonth(query.month)
  const sections = parseReportSections(query.sections)
  const data = await loadReportData(db, period)
  const generatedBy = actorLabel(user)
  if (kind === 'xlsx') {
    const buffer = await buildReportWorkbook(data, sections)
    return {
      buffer: Buffer.from(buffer),
      filename: reportFilename(period, 'xlsx'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      periodLabel: period.label,
      sections,
    }
  }
  const buffer = await buildReportPdfBuffer(data, sections, generatedBy)
  return {
    buffer,
    filename: reportFilename(period, 'pdf'),
    contentType: 'application/pdf',
    periodLabel: period.label,
    sections,
  }
}

module.exports = {
  createReportExport,
  buildReportWorkbook,
  buildReportPdfBuffer,
  loadReportData,
}
