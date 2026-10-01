const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../db')
const { ensureStockSchema } = require('../src/utils/stockSchema')
const { applyStockChange, roundStock } = require('../src/utils/stockLedger')

const EXPECTED_TYPES = {
  'inventory.stock_quantity': 'decimal(14,6)',
  'stock_movements.change_amount': 'decimal(14,6)',
  'stock_movements.quantity_after': 'decimal(14,6)',
  'menu_item_stock_links.quantity_per_unit': 'decimal(18,6)',
}

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
      const key = `${column.TABLE_NAME}.${column.COLUMN_NAME}`
      assert.equal(String(column.COLUMN_TYPE).toLowerCase(), EXPECTED_TYPES[key], key)
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

    assert.equal(Number(moves[0].change_amount), -0.009)
    assert.equal(Number(stock[0].stock_quantity), roundStock(before - 0.009))
    assert.equal(Number(stock[0].stock_quantity), Number(moves[0].quantity_after))
    assert.notEqual(Number(moves[0].change_amount), -0.01)

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
