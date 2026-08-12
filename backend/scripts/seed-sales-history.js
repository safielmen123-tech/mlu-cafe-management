/**
 * Seeds realistic completed sales across the last 180 days,
 * with guaranteed coverage for February, March, and April 2026.
 * Run: npm run seed:sales
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const db = require('../db')

const TAX_RATE = 0.1
const ORDER_COUNT = 140
const TARGET_TABLES = [1, 2, 3, 4, 5, 6]
const PAYMENT_METHODS = ['Cash', 'Bank Scan']

const GUARANTEED_MONTHS = [
  { year: 2026, month: 2, orderCount: 28 },
  { year: 2026, month: 3, orderCount: 32 },
  { year: 2026, month: 4, orderCount: 30 },
]

const FALLBACK_MENU = [
  { name: 'Americano', category: 'Coffee', price: 3.25 },
  { name: 'Cappuccino', category: 'Coffee', price: 3.75 },
  { name: 'Iced Latte', category: 'Coffee', price: 4.25 },
  { name: 'Latte', category: 'Coffee', price: 4.0 },
  { name: 'Espresso', category: 'Coffee', price: 2.5 },
  { name: 'Mocha', category: 'Coffee', price: 4.5 },
  { name: 'Iced Coffee', category: 'Coffee', price: 3.5 },
  { name: 'Croissant', category: 'Bakery', price: 2.75 },
  { name: 'Chocolate Muffin', category: 'Bakery', price: 3.15 },
  { name: 'Blueberry Muffin', category: 'Bakery', price: 3.0 },
  { name: 'Chocolate Cake', category: 'Bakery', price: 4.25 },
  { name: 'Banana Bread', category: 'Bakery', price: 3.25 },
]

const MORNING_HOURS = [7, 8, 9, 10]
const AFTERNOON_HOURS = [13, 14, 15]
const OTHER_HOURS = [11, 12, 16, 17, 18, 19, 20, 21, 22, 23]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickWeighted(items, weightFn) {
  const weights = items.map(weightFn)
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * total
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

function pickOrderHour() {
  const bucket = Math.random()
  if (bucket < 0.45) return pickWeighted(MORNING_HOURS, () => 1)
  if (bucket < 0.8) return pickWeighted(AFTERNOON_HOURS, () => 1)
  return pickWeighted(OTHER_HOURS, () => 1)
}

function randomOrderDate(daysBack) {
  const now = new Date()
  const dayOffset = randomInt(0, daysBack)
  const date = new Date(now)
  date.setDate(now.getDate() - dayOffset)
  date.setHours(pickOrderHour(), randomInt(0, 59), randomInt(0, 59), 0)
  return date
}

function randomDateInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const day = randomInt(1, daysInMonth)
  const date = new Date(year, month - 1, day)
  date.setHours(pickOrderHour(), randomInt(0, 59), randomInt(0, 59), 0)
  return date
}

function formatInvoiceId(counter) {
  return `INV-${String(counter).padStart(5, '0')}`
}

function isCoffeeItem(item) {
  return item.category === 'Coffee'
}

async function ensureMenuItems() {
  const [rows] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id')

  if (rows.length === 0) {
    for (const item of FALLBACK_MENU) {
      await db.execute(
        'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, TRUE)',
        [item.name, item.category, item.price],
      )
    }
    const [inserted] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id')
    return inserted
  }

  const names = new Set(rows.map((row) => row.name.toLowerCase()))
  for (const item of FALLBACK_MENU) {
    if (!names.has(item.name.toLowerCase())) {
      await db.execute(
        'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, TRUE)',
        [item.name, item.category, item.price],
      )
    }
  }

  const [allRows] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id')
  return allRows
}

function buildOrderLines(menuItems, hour) {
  const lineCount = randomInt(1, 3)
  const lines = []
  const isPeakCoffee = MORNING_HOURS.includes(hour) || AFTERNOON_HOURS.includes(hour)

  for (let i = 0; i < lineCount; i += 1) {
    const item = pickWeighted(menuItems, (menuItem) => {
      if (isPeakCoffee && isCoffeeItem(menuItem)) return 4
      if (isPeakCoffee && !isCoffeeItem(menuItem)) return 1.2
      if (!isPeakCoffee && isCoffeeItem(menuItem)) return 1.5
      return 2
    })

    const quantity = randomInt(1, 2)
    const price = Number.parseFloat(item.price)
    lines.push({
      menu_item_id: item.id,
      name: item.name,
      quantity,
      price,
      lineTotal: quantity * price,
    })
  }

  return lines
}

async function wipeSalesData() {
  await db.execute('DELETE FROM order_items')
  await db.execute('DELETE FROM orders')
}

async function insertCompletedOrder(menuItems, orderDate, invoiceCounter) {
  const hour = orderDate.getHours()
  const lines = buildOrderLines(menuItems, hour)
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax
  const paymentMethod = PAYMENT_METHODS[Math.random() < 0.58 ? 0 : 1]
  const isTakeOut = Math.random() < 0.22
  const sourceType = isTakeOut ? 'Take Out' : 'Table'
  const tableTargetId = isTakeOut ? null : TARGET_TABLES[randomInt(0, TARGET_TABLES.length - 1)]
  const invoiceId = formatInvoiceId(invoiceCounter)
  const timestamp = orderDate.toISOString().slice(0, 19).replace('T', ' ')

  const [orderResult] = await db.execute(
    `INSERT INTO orders
      (target_id, table_id, source_type, total_amount, payment_type, status,
       invoice_id, payment_method, subtotal, tax, total, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, 'Completed', ?, ?, ?, ?, ?, ?, ?)`,
    [
      tableTargetId,
      sourceType,
      total,
      paymentMethod,
      invoiceId,
      paymentMethod,
      subtotal,
      tax,
      total,
      timestamp,
      timestamp,
    ],
  )

  const orderId = orderResult.insertId
  for (const line of lines) {
    await db.execute(
      `INSERT INTO order_items (order_id, menu_item_id, quantity, price, subtotal)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, line.menu_item_id, line.quantity, line.price, line.lineTotal],
    )
  }

  return {
    invoiceId,
    total,
    paymentMethod,
    orderDate,
  }
}

async function seedSalesHistory() {
  console.log('Ensuring menu catalog...')
  const menuItems = await ensureMenuItems()
  const coffeeCount = menuItems.filter(isCoffeeItem).length
  const bakeryCount = menuItems.length - coffeeCount

  console.log(`Loaded ${menuItems.length} menu items (${coffeeCount} coffee, ${bakeryCount} bakery).`)
  console.log('Wiping existing orders and order_items...')
  await wipeSalesData()

  let invoiceCounter = 1001
  let totalRevenue = 0
  let cashOrders = 0
  let bankScanOrders = 0

  console.log(`Inserting ${ORDER_COUNT} random completed orders across the last 180 days...`)

  for (let i = 0; i < ORDER_COUNT; i += 1) {
    const orderDate = randomOrderDate(180)
    const result = await insertCompletedOrder(menuItems, orderDate, invoiceCounter)
    invoiceCounter += 1
    totalRevenue += result.total
    if (result.paymentMethod === 'Cash') cashOrders += 1
    else bankScanOrders += 1
  }

  console.log('Seeding guaranteed February, March, and April 2026 transactions...')

  for (const { year, month, orderCount } of GUARANTEED_MONTHS) {
    for (let i = 0; i < orderCount; i += 1) {
      const orderDate = randomDateInMonth(year, month)
      const result = await insertCompletedOrder(menuItems, orderDate, invoiceCounter)
      invoiceCounter += 1
      totalRevenue += result.total
      if (result.paymentMethod === 'Cash') cashOrders += 1
      else bankScanOrders += 1
    }
    console.log(`  ${year}-${String(month).padStart(2, '0')}: ${orderCount} orders`)
  }

  const [summary] = await db.execute(`
    SELECT
      COUNT(*) AS order_count,
      MIN(updated_at) AS earliest_sale,
      MAX(updated_at) AS latest_sale,
      SUM(total) AS gross_revenue
    FROM orders
    WHERE status = 'Completed'
  `)

  const [monthSummary] = await db.execute(`
    SELECT DATE_FORMAT(updated_at, '%Y-%m') AS month_key, COUNT(*) AS orders, SUM(total) AS revenue
    FROM orders
    WHERE status = 'Completed'
      AND updated_at >= '2026-02-01'
      AND updated_at < '2026-05-01'
    GROUP BY month_key
    ORDER BY month_key
  `)

  const [itemSummary] = await db.execute(`
    SELECT m.name, SUM(oi.quantity) AS units_sold
    FROM order_items oi
    JOIN menu_items m ON m.id = oi.menu_item_id
    GROUP BY m.name
    ORDER BY units_sold DESC
    LIMIT 5
  `)

  console.log('')
  console.log('Sales seed completed successfully.')
  console.log(JSON.stringify(summary[0], null, 2))
  console.log('')
  console.log('Feb–Apr 2026 coverage:')
  monthSummary.forEach((row) => {
    console.log(`  ${row.month_key}: ${row.orders} orders, $${Number.parseFloat(row.revenue).toFixed(2)} revenue`)
  })
  console.log('')
  console.log('Top 5 items by units sold:')
  itemSummary.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.name} — ${row.units_sold} units`)
  })
  console.log('')
  console.log(`Payment mix: Cash ${cashOrders} | Bank Scan ${bankScanOrders}`)
  console.log(`Computed revenue while seeding: $${totalRevenue.toFixed(2)}`)
}

seedSalesHistory()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Sales seed failed:', err.message)
    process.exit(1)
  })
