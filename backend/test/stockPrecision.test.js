const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../db')
const { ensureStockSchema } = require('../src/utils/stockSchema')
const { applyStockChange } = require('../src/utils/stockLedger')

test('a 9 g deduction is stored as 0.009 kg', async () => {
  await ensureStockSchema(db)
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [columns] = await conn.execute(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND (
           (TABLE_NAME = 'inventory' AND COLUMN_NAME = 'stock_quantity')
           OR (TABLE_NAME = 'stock_movements' AND COLUMN_NAME IN ('change_amount', 'quantity_after'))
           OR (TABLE_NAME = 'menu_item_stock_links' AND COLUMN_NAME = 'quantity_per_unit')
         )`,
    )
    for (const column of columns) {
      assert.equal(String(column.COLUMN_TYPE).toLowerCase(), 'decimal(12,3)', `${column.TABLE_NAME}.${column.COLUMN_NAME}`)
    }

    const [items] = await conn.execute(
      `SELECT id, stock_quantity FROM inventory WHERE item_name = 'Small Tapioca Pearls (Sago)' FOR UPDATE`,
    )
    assert.equal(items.length, 1)
    const before = Number(items[0].stock_quantity)

    await applyStockChange(conn, {
      inventoryId: items[0].id,
      change: -0.009,
      reason: 'sale',
      note: 'precision check',
    })

    const [moves] = await conn.execute(
      `SELECT change_amount, quantity_after
       FROM stock_movements WHERE inventory_id = ? ORDER BY id DESC LIMIT 1`,
      [items[0].id],
    )
    const [stock] = await conn.execute(
      'SELECT stock_quantity FROM inventory WHERE id = ?',
      [items[0].id],
    )

    assert.equal(String(moves[0].change_amount), '-0.009')
    assert.equal(Number(stock[0].stock_quantity), Math.round((before - 0.009) * 1000) / 1000)
    assert.equal(String(stock[0].stock_quantity), String(moves[0].quantity_after))
    assert.notEqual(String(moves[0].change_amount), '-0.010')
    assert.notEqual(String(moves[0].change_amount), '-0.01')

    await conn.rollback()
  } catch (error) {
    try { await conn.rollback() } catch { /* report the original error */ }
    throw error
  } finally {
    conn.release()
  }
})

test.after(async () => {
  await db.end()
})
