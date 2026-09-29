/**
 * Creates mlu_demo (schema copied from the current DB_NAME) and fills it with sample rows.
 * Writes only to mlu_demo. Refuses to change the database named in DB_NAME.
 *
 * Passwords are read from the environment and are not stored in this file:
 *   DEMO_ADMIN_PASSWORD
 *   DEMO_STAFF_PASSWORD
 *
 * From the backend folder, with DB_NAME still set to the real database:
 *   node scripts/seed-demo.js
 */
const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')
const { env } = require('../src/config/env')

const DEMO_DB = 'mlu_demo'
const BCRYPT_COST = 10

function assertDemo(name) {
  if (name !== DEMO_DB) {
    throw new Error(`Refusing to write because the connection is on ${name || 'no database'}`)
  }
}

async function main() {
  const adminPassword = String(process.env.DEMO_ADMIN_PASSWORD || '')
  const staffPassword = String(process.env.DEMO_STAFF_PASSWORD || '')
  if (adminPassword.length < 8 || staffPassword.length < 8) {
    console.error('Set DEMO_ADMIN_PASSWORD and DEMO_STAFF_PASSWORD (8+ characters, include a letter and a number).')
    process.exit(1)
  }

  const sourceName = env.db.database
  if (sourceName === DEMO_DB) {
    console.error('DB_NAME is already mlu_demo. Point it at the real database so the schema can be copied.')
    process.exit(1)
  }

  const base = {
    host: env.db.host === 'localhost' ? '127.0.0.1' : env.db.host,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: false,
  }

  const server = await mysql.createConnection(base)
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${DEMO_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await server.end()

  const source = await mysql.createConnection({ ...base, database: sourceName })
  const demo = await mysql.createConnection({ ...base, database: DEMO_DB })
  assertDemo(DEMO_DB)

  const [tableRows] = await source.query('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE'])
  const tableNames = tableRows.map((row) => Object.values(row)[0])

  await demo.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const name of tableNames) {
    const [existing] = await demo.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
      [DEMO_DB, name],
    )
    if (existing.length) continue
    const [createRows] = await source.query(`SHOW CREATE TABLE \`${name}\``)
    const createSql = Object.values(createRows[0])[1]
    await demo.query(createSql)
  }
  await demo.query('SET FOREIGN_KEY_CHECKS = 1')

  const [userCount] = await demo.query('SELECT COUNT(*) AS c FROM users')
  if (Number(userCount[0].c) > 0) {
    console.log('mlu_demo already has users. Left existing demo data unchanged.')
    await source.end()
    await demo.end()
    return
  }

  const adminHash = await bcrypt.hash(adminPassword, BCRYPT_COST)
  const staffHash = await bcrypt.hash(staffPassword, BCRYPT_COST)
  const staffPermissions = JSON.stringify([
    'dashboard',
    'order',
    'table',
    'reservations',
    'payment',
    'menu',
    'settings',
    'sales_history',
    'inventory_stock',
    'reports',
    'reports_analysis',
  ])
  const adminPermissions = JSON.stringify([
    'dashboard',
    'order',
    'table',
    'reservations',
    'payment',
    'menu',
    'settings',
    'backup_recovery',
    'sales_history',
    'inventory_stock',
    'reports',
    'reports_analysis',
  ])

  await demo.query(
    `INSERT INTO users (display_name, username, email, password_hash, role, permissions, must_change_password, is_active)
     VALUES (?, 'admin', NULL, ?, 'Admin', ?, 0, 1),
            (?, 'staff', NULL, ?, 'Staff', ?, 0, 1)`,
    ['Demo Admin', adminHash, adminPermissions, 'Demo Staff', staffHash, staffPermissions],
  )

  await demo.query(
    `INSERT INTO menu_items (name, category, price, hot_price, iced_price, is_available)
     VALUES
      ('Iced Latte', 'Coffee', 2.50, 2.25, 2.50, 1),
      ('Hot Americano', 'Coffee', 1.75, 1.75, 2.00, 1),
      ('Jasmine Tea', 'Tea', 1.50, 1.50, 1.75, 1),
      ('Chicken Rice', 'Mains', 4.50, NULL, NULL, 1),
      ('Spring Rolls', 'Starters', 3.00, NULL, NULL, 1),
      ('Mango Sticky Rice', 'Dessert', 3.25, NULL, NULL, 1)`,
  )

  await demo.query(
    `INSERT INTO tables (id, table_name, section, capacity, status)
     VALUES (1, 'Table 1', 'standard', 4, 'Occupied'),
            (2, 'Table 2', 'standard', 4, 'Empty'),
            (3, 'Table 3', 'standard', 4, 'Empty'),
            (4, 'Table 4', 'standard', 4, 'Empty'),
            (5, 'Table 5', 'standard', 4, 'Empty'),
            (6, 'Table 6', 'standard', 4, 'Empty'),
            (7, 'Table 7', 'standard', 4, 'Empty'),
            (8, 'Table 8', 'standard', 4, 'Empty'),
            (9, 'VIP Room 1', 'vip', 12, 'Empty'),
            (10, 'VIP Room 2', 'vip', 12, 'Empty')`,
  )

  await demo.query(
    `INSERT INTO inventory
      (item_name, category, section, stock_quantity, max_stock, unit_label, unit_singular,
       critical_threshold, low_threshold, is_weight, stock_status, unit_cost)
     VALUES
      ('Coffee beans', 'Ingredients', 'countable', 2, 20, 'bags', 'bag', 1, 5, 0, 'LOW', 12.0000),
      ('Milk', 'Ingredients', 'countable', 18, 30, 'liters', 'liter', 3, 6, 0, 'IN_STOCK', 1.5000),
      ('Jasmine tea', 'Ingredients', 'countable', 8, 15, 'tins', 'tin', 2, 4, 0, 'IN_STOCK', 4.0000)`,
  )

  const [menu] = await demo.query('SELECT id, name, price FROM menu_items ORDER BY id')
  const [tables] = await demo.query("SELECT id FROM tables WHERE table_name = 'T1' LIMIT 1")
  const tableId = tables[0].id
  const latte = menu[0]
  const rice = menu[3]

  const daysAgo = [1, 3, 6, 10, 20]
  for (let index = 0; index < daysAgo.length; index += 1) {
    const qty = index + 1
    const price = Number(latte.price)
    const lineTotal = Math.round(price * qty * 100) / 100
    const invoice = `DEMO-${1001 + index}`
    const [order] = await demo.query(
      `INSERT INTO orders
        (target_id, table_id, source_type, total_amount, payment_type, status,
         invoice_id, payment_method, subtotal, tax, total, created_at, updated_at, bill_requested)
       VALUES (?, NULL, 'Take Out', ?, 'Cash', 'Completed', ?, 'Cash', ?, 0, ?,
               DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY), 0)`,
      [null, lineTotal, invoice, lineTotal, lineTotal, daysAgo[index], daysAgo[index]],
    )
    await demo.query(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [order.insertId, latte.id, latte.name, qty, price, lineTotal],
    )
  }

  const ricePrice = Number(rice.price)
  const [openOrder] = await demo.query(
    `INSERT INTO orders
      (target_id, table_id, source_type, total_amount, payment_type, status, subtotal, tax, total, bill_requested)
     VALUES (?, ?, 'Table', ?, 'Cash', 'Pending', ?, 0, ?, 0)`,
    [tableId, tableId, ricePrice, ricePrice, ricePrice],
  )
  await demo.query(
    `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, subtotal)
     VALUES (?, ?, ?, 1, ?, ?)`,
    [openOrder.insertId, rice.id, rice.name, ricePrice, ricePrice],
  )

  await demo.query(
    `INSERT INTO expenses (category, description, amount, expense_date, created_by_name)
     VALUES ('Supplies', 'Demo coffee beans', 24.00, CURDATE(), 'Demo Admin'),
            ('Utilities', 'Demo electricity', 40.00, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Demo Admin')`,
  )

  console.log('Demo database mlu_demo is ready.')
  console.log('Usernames: admin, staff')
  console.log('Passwords were read from the environment and were not written into this file.')
  await source.end()
  await demo.end()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
