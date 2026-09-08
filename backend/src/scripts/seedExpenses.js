/**
 * Seeds cafe operating expenses that follow completed sales dates.
 * Target mix: ~24% inventory, ~28% payroll, ~8% daily overhead,
 * plus monthly utilities/maintenance — leaving a healthy cafe profit.
 * Run: npm run seed:expenses
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })

const db = require('../../db')
const { ensureExpensesSchema } = require('../utils/expenses')

const SEED_NAME = 'Demo Seed'

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseIsoDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomBetween(rand, min, max) {
  return min + (max - min) * rand()
}

function eachDate(start, end, visit) {
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= last) {
    visit(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
}

async function loadDailySales() {
  const [rows] = await db.execute(`
    SELECT
      DATE_FORMAT(updated_at, '%Y-%m-%d') AS sale_date,
      COALESCE(SUM(COALESCE(total, total_amount)), 0) AS revenue,
      COUNT(*) AS order_count
    FROM orders
    WHERE UPPER(status) IN ('COMPLETED', 'PAID')
    GROUP BY DATE_FORMAT(updated_at, '%Y-%m-%d')
    ORDER BY sale_date ASC
  `)
  return rows.map((row) => ({
    date: String(row.sale_date).slice(0, 10),
    revenue: Number.parseFloat(row.revenue) || 0,
    orders: Number.parseInt(row.order_count, 10) || 0,
  }))
}

function buildExpenses(dailySales, rand) {
  const revenueByDate = Object.fromEntries(dailySales.map((row) => [row.date, row.revenue]))
  const revenueByMonth = {}
  for (const row of dailySales) {
    const monthKey = row.date.slice(0, 7)
    revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + row.revenue
  }

  const start = parseIsoDate(dailySales[0].date)
  const end = parseIsoDate(dailySales[dailySales.length - 1].date)
  const rows = []

  const push = (expenseDate, category, description, amount) => {
    const value = roundMoney(amount)
    if (value <= 0) return
    rows.push([category, description, value, expenseDate, SEED_NAME])
  }

  eachDate(start, end, (day) => {
    const iso = toIsoDate(day)
    const monthKey = iso.slice(0, 7)
    const weekday = day.getDay()
    const dateNum = day.getDate()
    const month = day.getMonth() + 1
    const dayRevenue = revenueByDate[iso] || 0
    const monthRevenue = revenueByMonth[monthKey] || 0
    const isOperatingMonth = monthRevenue >= 500
    const isHotSeason = month >= 3 && month <= 5
    const isHighSeason = month === 11 || month === 12 || month <= 2

    if (dayRevenue > 0) {
      push(
        iso,
        'Daily Overhead',
        'Gas, packaging, napkins, and cleaning supplies',
        dayRevenue * 0.08 + randomBetween(rand, 4, 11),
      )
    }

    if (dayRevenue > 0 && (weekday === 2 || weekday === 4 || weekday === 6)) {
      const share = weekday === 4 ? 0.09 : weekday === 2 ? 0.08 : 0.07
      const labels = {
        2: 'Coffee beans, tea, and syrup restock',
        4: 'Fresh milk, dairy, and bakery ingredients',
        6: 'Produce, fruit, and dry goods restock',
      }
      push(iso, 'Inventory Restock', labels[weekday], dayRevenue * share * 6 + randomBetween(rand, 8, 22))
    }

    if (isOperatingMonth && (dateNum === 1 || (dateNum === 2 && weekday === 1))) {
      push(
        iso,
        'Staff / Payroll',
        'Kitchen and floor wages (1–15)',
        monthRevenue * 0.14 + randomBetween(rand, 20, 45),
      )
    }

    if (isOperatingMonth && (dateNum === 16 || (dateNum === 17 && weekday === 1))) {
      push(
        iso,
        'Staff / Payroll',
        'Kitchen and floor wages (16–end)',
        monthRevenue * 0.14 + randomBetween(rand, 20, 45),
      )
    }

    if (isOperatingMonth && (dateNum === 5 || (dateNum === 6 && weekday === 1))) {
      const utilities =
        165 +
        (isHotSeason ? 95 : 0) +
        (isHighSeason ? 35 : 0) +
        randomBetween(rand, 12, 40)
      push(iso, 'Utilities', 'Electricity, water, and internet', utilities)
    }

    if (isOperatingMonth && (dateNum === 12 || (dateNum === 13 && weekday === 1))) {
      push(
        iso,
        'Maintenance',
        'Espresso machine, fridge, and fixture service',
        randomBetween(rand, 38, 92) + (isHotSeason ? 18 : 0),
      )
    }

    if (isOperatingMonth && dateNum === 22 && rand() < 0.55) {
      push(
        iso,
        'Other',
        rand() < 0.5 ? 'Market herbs, flowers, and smallwares' : 'Printer paper, soap, and office supplies',
        randomBetween(rand, 14, 48),
      )
    }
  })

  return rows
}

async function insertExpenses(rows) {
  const chunkSize = 80
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    await db.query(
      `
      INSERT INTO expenses (category, description, amount, expense_date, created_by_name)
      VALUES ?
      `,
      [chunk],
    )
  }
}

async function seedExpenses() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Mlu Kitchen & Cafe Siem Reap — Expense Seed')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  await ensureExpensesSchema(db)

  const dailySales = await loadDailySales()
  if (!dailySales.length) {
    throw new Error('No completed orders found. Seed sales first, then run seed:expenses.')
  }

  const salesTotal = dailySales.reduce((sum, row) => sum + row.revenue, 0)
  console.log(`[1/3] Linked to ${dailySales.length} sale days · $${salesTotal.toFixed(2)} revenue`)
  console.log(`      ${dailySales[0].date} → ${dailySales[dailySales.length - 1].date}`)

  const [deleted] = await db.execute('DELETE FROM expenses WHERE created_by_name = ?', [SEED_NAME])
  console.log(`[2/3] Cleared ${deleted.affectedRows} previous demo expenses`)

  const rand = mulberry32(20260908)
  const rows = buildExpenses(dailySales, rand)
  await insertExpenses(rows)

  const expenseTotal = rows.reduce((sum, row) => sum + row[2], 0)
  const profit = salesTotal - expenseTotal
  const byCategory = {}
  for (const row of rows) {
    byCategory[row[0]] = (byCategory[row[0]] || 0) + row[2]
  }

  console.log(`[3/3] Inserted ${rows.length} expense rows`)
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SEED COMPLETE')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Income                 : $${salesTotal.toFixed(2)}`)
  console.log(`  Expenses               : $${expenseTotal.toFixed(2)}`)
  console.log(`  Net profit             : $${profit.toFixed(2)} (${((profit / salesTotal) * 100).toFixed(1)}%)`)
  console.log('')
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, amount]) => {
      console.log(`    ${category.padEnd(22)} $${amount.toFixed(2).padStart(10)}`)
    })
  console.log('═══════════════════════════════════════════════════════')
}

seedExpenses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('')
    console.error('❌ Expense seed failed:', error.message)
    process.exit(1)
  })
