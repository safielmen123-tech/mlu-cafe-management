const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ExcelJS = require('exceljs')
const db = require('../db')
const { requireAdmin } = require('../src/middleware/auth')
const { beginMaintenance, endMaintenance, isUnderMaintenance, maintenanceMessage } = require('../src/utils/maintenance')
const { parseBackupPeriod } = require('../src/utils/backupPeriod')
const { exportBusinessDataFile } = require('../src/utils/backupExport')
const { createSalesPdf } = require('../src/utils/salesPdf')
const {
  createDownloadDump,
  validateSqlFile,
  restoreDatabaseFromFile,
  MAX_SQL_BYTES,
} = require('../src/utils/backupSql')

const TEST_DB = 'mlu_kitchen_cafe_db_test'
const COMPLETED = `UPPER(status) IN ('COMPLETED', 'PAID')`

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

async function salesTotals(whereSql, params) {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS orders, ROUND(COALESCE(SUM(COALESCE(total, total_amount, 0)), 0), 2) AS revenue
     FROM orders WHERE ${COMPLETED} ${whereSql}`,
    params,
  )
  return { orders: Number(row.orders), revenue: Number(row.revenue) }
}

async function columnSum(filePath, sheetName, columnNumber) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.getWorksheet(sheetName)
  assert.ok(sheet, sheetName)
  assert.ok(sheet.getColumn(columnNumber).width >= 10)
  let sum = 0
  let rows = 0
  sheet.eachRow((row, index) => {
    if (index === 1) return
    const value = row.getCell(columnNumber).value
    assert.equal(typeof value, 'number')
    sum += value
    rows += 1
  })
  return { rows, sum: Math.round(sum * 100) / 100, names: workbook.worksheets.map((item) => item.name) }
}

test('staff role is refused by the admin check', () => {
  const res = mockRes()
  let called = false
  requireAdmin({ user: { role: 'Staff', permissions: ['backup_recovery'] } }, res, () => {
    called = true
  })
  assert.equal(called, false)
  assert.equal(res.statusCode, 403)
  assert.match(res.body.message, /Administrator/)
})

test('maintenance blocks and then clears', () => {
  assert.equal(isUnderMaintenance(), false)
  beginMaintenance()
  assert.equal(isUnderMaintenance(), true)
  assert.match(maintenanceMessage(), /paused/)
  endMaintenance()
  assert.equal(isUnderMaintenance(), false)
})

test('restore rejects an empty file, a renamed text file, a non-system dump, and a huge file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlu-backup-'))
  const empty = path.join(dir, 'empty.sql')
  fs.writeFileSync(empty, '')
  await assert.rejects(validateSqlFile(empty), /empty/)

  const text = path.join(dir, 'notes.sql')
  fs.writeFileSync(text, 'this is a plain text note, not a database dump')
  await assert.rejects(validateSqlFile(text), /not a backup from Mlu/)

  const foreign = path.join(dir, 'other.sql')
  fs.writeFileSync(foreign, 'CREATE TABLE orders (id INT);\nINSERT INTO orders VALUES (1);')
  await assert.rejects(validateSqlFile(foreign), /not a backup from Mlu/)

  const huge = path.join(dir, 'huge.sql')
  const handle = await fs.promises.open(huge, 'w')
  await handle.truncate(MAX_SQL_BYTES + 1)
  await handle.close()
  await assert.rejects(validateSqlFile(huge), /100 MB/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('excel and pdf totals match completed sales for all time and September 2026', async () => {
  const all = await salesTotals('', [])
  const month = await salesTotals('AND updated_at >= ? AND updated_at < ?', ['2026-09-01', '2026-10-01'])
  const allFile = path.join(os.tmpdir(), `mlu-excel-all-${Date.now()}.xlsx`)
  const monthFile = path.join(os.tmpdir(), `mlu-excel-month-${Date.now()}.xlsx`)
  await exportBusinessDataFile(db, parseBackupPeriod({}), allFile)
  await exportBusinessDataFile(db, parseBackupPeriod({ month: '9', year: '2026' }), monthFile)
  const allSales = await columnSum(allFile, 'Sales', 7)
  const monthSales = await columnSum(monthFile, 'Sales', 7)
  assert.deepEqual(allSales.names, ['Sales', 'Expenses', 'Stock', 'Stock Movements'])
  assert.equal(allSales.rows, all.orders)
  assert.equal(allSales.sum, all.revenue)
  assert.equal(monthSales.rows, month.orders)
  assert.equal(monthSales.sum, month.revenue)

  const [[expenseCount]] = await db.execute('SELECT COUNT(*) AS n FROM expenses')
  const expenses = await columnSum(allFile, 'Expenses', 4)
  assert.equal(expenses.rows, Number(expenseCount.n))
  const [[stockCount]] = await db.execute('SELECT COUNT(*) AS n FROM inventory')
  const stock = await columnSum(allFile, 'Stock', 5)
  assert.equal(stock.rows, Number(stockCount.n))
  const [[movementCount]] = await db.execute('SELECT COUNT(*) AS n FROM stock_movements')
  const movements = await columnSum(allFile, 'Stock Movements', 3)
  assert.equal(movements.rows, Number(movementCount.n))

  const pdfAll = await createSalesPdf(db, {}, { display_name: 'Audit', username: 'audit' })
  const pdfMonth = await createSalesPdf(db, { month: '9', year: '2026' }, { display_name: 'Audit', username: 'audit' })
  assert.equal(pdfAll.buffer.subarray(0, 5).toString(), '%PDF-')
  assert.equal(pdfMonth.buffer.subarray(0, 5).toString(), '%PDF-')
  assert.equal(pdfAll.totals.orders, all.orders)
  assert.equal(pdfAll.totals.gross, all.revenue)
  assert.equal(pdfMonth.totals.orders, month.orders)
  assert.equal(pdfMonth.totals.gross, month.revenue)
  fs.rmSync(allFile, { force: true })
  fs.rmSync(monthFile, { force: true })
})

test('full backup restores into the test database with matching row counts', async () => {
  const dump = await createDownloadDump(db)
  assert.match(dump.filename, /^Mlu_Backup_\d{4}-\d{2}-\d{2}_\d{4}(?:\d{2})?\.sql$/)
  const head = fs.readFileSync(dump.filePath, 'utf8').slice(0, 500)
  assert.match(head, /Mlu Kitchen & Cafe Siem Reap System Database Backup/)
  const body = fs.readFileSync(dump.filePath)
  assert.ok(body.includes(Buffer.from('menu_item_stock_links')))
  assert.ok(body.includes(Buffer.from('stock_movements')))
  assert.ok(body.length < 80 * 1024 * 1024)

  await restoreDatabaseFromFile(db, dump.filePath, { database: TEST_DB })
  const [tables] = await db.execute(
    `SELECT TABLE_NAME AS name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
  )
  const mismatches = []
  for (const table of tables) {
    const [[live]] = await db.execute(`SELECT COUNT(*) AS n FROM \`${table.name}\``)
    const [[copy]] = await db.execute(`SELECT COUNT(*) AS n FROM \`${TEST_DB}\`.\`${table.name}\``)
    if (Number(live.n) !== Number(copy.n)) {
      mismatches.push({ table: table.name, live: Number(live.n), test: Number(copy.n) })
    }
  }
  assert.deepEqual(mismatches, [])
  fs.rmSync(dump.filePath, { force: true })
})

test.after(async () => {
  endMaintenance()
  await db.end()
})
