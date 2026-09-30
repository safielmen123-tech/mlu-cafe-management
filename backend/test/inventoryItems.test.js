const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../db')
const {
  matchInventoryName,
  nearInventoryNames,
  saveNewInventoryItem,
  updateInventoryItem,
} = require('../src/utils/inventoryItems')

const palm = { id: 22, item_name: 'Palm Sugar' }
const bags = { id: 7, item_name: 'Sugar' }

test('a close spelling suggests the existing item and does not count as new', () => {
  const typo = matchInventoryName([palm, bags], 'palm suger')
  assert.equal(typo.exact.length, 0)
  assert.equal(typo.suggestions[0].item_name, 'Palm Sugar')

  const exact = matchInventoryName([palm], '  palm   sugar ')
  assert.equal(exact.exact.length, 1)
  assert.equal(exact.suggestions.length, 0)
})

test('a shorter existing name is a near match, and a different bean row is not', () => {
  const garlic = nearInventoryNames([{ id: 1, item_name: 'Garlic' }], 'Fresh Garlic')
  assert.equal(garlic[0].item_name, 'Garlic')

  const beans = nearInventoryNames(
    [{ id: 26, item_name: 'Dried Beans (mixed)' }],
    'Fermented Yellow Bean Paste',
  )
  assert.deepEqual(beans, [])
})

test('a new item stores an initial adjustment and a duplicate is refused', async () => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const created = await saveNewInventoryItem(conn, {
      item_name: 'Test Pandan Leaf',
      category: 'Produce',
      section: 'uncountable',
      unit_label: 'kg',
      stock_quantity: 1.5,
      max_stock: 5,
      low_threshold: 1,
      critical_threshold: 0.5,
    }, null)
    assert.equal(Number(created.stock_quantity), 1.5)
    assert.equal(created.section, 'uncountable')

    const [moves] = await conn.execute(
      `SELECT change_amount, quantity_after, reason, note
       FROM stock_movements WHERE inventory_id = ?`,
      [created.id],
    )
    assert.equal(moves.length, 1)
    assert.equal(String(moves[0].change_amount), '1.500')
    assert.equal(moves[0].reason, 'adjustment')
    assert.equal(moves[0].note, 'Initial count')

    await assert.rejects(
      () => saveNewInventoryItem(conn, {
        item_name: 'test pandan leaf',
        category: 'Produce',
        section: 'uncountable',
        unit_label: 'kg',
        stock_quantity: 0,
        max_stock: 5,
        low_threshold: 1,
        critical_threshold: 0.5,
      }, null),
      (error) => error.status === 409 && error.code === 'duplicate',
    )

    await assert.rejects(
      () => saveNewInventoryItem(conn, {
        item_name: 'Test Pandan Leef',
        category: 'Produce',
        section: 'uncountable',
        unit_label: 'kg',
        stock_quantity: 0,
        max_stock: 5,
        low_threshold: 1,
        critical_threshold: 0.5,
      }, null),
      (error) => error.status === 409 && error.code === 'similar',
    )

    await assert.rejects(
      () => updateInventoryItem(conn, created.id, {
        item_name: created.item_name,
        category: created.category,
        section: 'countable',
        unit_label: 'bags',
        max_stock: 5,
        low_threshold: 1,
        critical_threshold: 0.5,
      }),
      (error) => error.status === 409 && error.code === 'unit_change',
    )

    await conn.rollback()
  } catch (error) {
    try { await conn.rollback() } catch { /* keep the original error */ }
    throw error
  } finally {
    conn.release()
  }
})

test.after(async () => {
  await db.end()
})
