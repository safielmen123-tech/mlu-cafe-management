const test = require('node:test')
const assert = require('node:assert/strict')
const { planStockDeltas } = require('../src/utils/stockLedger')

const beer = { menu_item_id: 125, inventory_id: 12, quantity_per_unit: 1 }

test('one sale deducts one bottle', () => {
  const deltas = planStockDeltas(
    [{ menu_item_id: 125, quantity: 1 }],
    [beer],
    new Map(),
  )
  assert.deepEqual(deltas, [{ inventoryId: 12, delta: 1 }])
})

test('quantity 3 deducts 3, and a second pass does not deduct again', () => {
  const first = planStockDeltas(
    [{ menu_item_id: 125, quantity: 3 }],
    [beer],
    new Map(),
  )
  assert.deepEqual(first, [{ inventoryId: 12, delta: 3 }])

  const second = planStockDeltas(
    [{ menu_item_id: 125, quantity: 3 }],
    [beer],
    new Map([[12, 3]]),
  )
  assert.deepEqual(second, [])
})

test('removing a line and lowering quantity return only the difference', () => {
  const reduced = planStockDeltas(
    [{ menu_item_id: 125, quantity: 1 }],
    [beer],
    new Map([[12, 3]]),
  )
  assert.deepEqual(reduced, [{ inventoryId: 12, delta: -2 }])

  const cleared = planStockDeltas([], [beer], new Map([[12, 3]]))
  assert.deepEqual(cleared, [{ inventoryId: 12, delta: -3 }])
})

test('an unlinked item does not move stock', () => {
  const deltas = planStockDeltas(
    [{ menu_item_id: 999, quantity: 4 }],
    [beer],
    new Map(),
  )
  assert.deepEqual(deltas, [])
})

test('5 grams stays 0.005 kg', () => {
  const deltas = planStockDeltas(
    [{ menu_item_id: 149, quantity: 1 }],
    [{ menu_item_id: 149, inventory_id: 31, quantity_per_unit: 0.005 }],
    new Map(),
  )
  assert.deepEqual(deltas, [{ inventoryId: 31, delta: 0.005 }])
  const triple = planStockDeltas(
    [{ menu_item_id: 149, quantity: 3 }],
    [{ menu_item_id: 149, inventory_id: 31, quantity_per_unit: 0.005 }],
    new Map(),
  )
  assert.equal(triple[0].delta, 0.015)
})

test('9 grams stays 0.009 kg and is not rounded to 0.01', () => {
  const deltas = planStockDeltas(
    [{ menu_item_id: 153, quantity: 1 }],
    [{ menu_item_id: 153, inventory_id: 22, quantity_per_unit: 0.009 }],
    new Map(),
  )
  assert.deepEqual(deltas, [{ inventoryId: 22, delta: 0.009 }])
})

test('one dessert deducts every ingredient, and quantity 3 triples', () => {
  const links = [
    { menu_item_id: 153, inventory_id: 21, quantity_per_unit: 0.086 },
    { menu_item_id: 153, inventory_id: 22, quantity_per_unit: 0.009 },
    { menu_item_id: 153, inventory_id: 23, quantity_per_unit: 0.013 },
    { menu_item_id: 153, inventory_id: 24, quantity_per_unit: 0.071 },
  ]
  const one = planStockDeltas([{ menu_item_id: 153, quantity: 1 }], links, new Map())
  assert.deepEqual(one, [
    { inventoryId: 21, delta: 0.086 },
    { inventoryId: 22, delta: 0.009 },
    { inventoryId: 23, delta: 0.013 },
    { inventoryId: 24, delta: 0.071 },
  ])

  const three = planStockDeltas([{ menu_item_id: 153, quantity: 3 }], links, new Map())
  assert.equal(three.find((row) => row.inventoryId === 22).delta, 0.027)
  assert.equal(three.find((row) => row.inventoryId === 21).delta, 0.258)

  const returned = planStockDeltas([], links, new Map(one.map((row) => [row.inventoryId, row.delta])))
  assert.equal(returned.find((row) => row.inventoryId === 22).delta, -0.009)
})

test('shared coconut milk and sago add across desserts', () => {
  const links = [
    { menu_item_id: 153, inventory_id: 24, quantity_per_unit: 0.071 },
    { menu_item_id: 154, inventory_id: 24, quantity_per_unit: 0.107 },
    { menu_item_id: 155, inventory_id: 24, quantity_per_unit: 0.071 },
    { menu_item_id: 153, inventory_id: 22, quantity_per_unit: 0.009 },
    { menu_item_id: 154, inventory_id: 22, quantity_per_unit: 0.006 },
    { menu_item_id: 155, inventory_id: 22, quantity_per_unit: 0.009 },
  ]
  const deltas = planStockDeltas(
    [
      { menu_item_id: 153, quantity: 1 },
      { menu_item_id: 154, quantity: 1 },
      { menu_item_id: 155, quantity: 1 },
    ],
    links,
    new Map(),
  )
  assert.equal(deltas.find((row) => row.inventoryId === 24).delta, 0.249)
  assert.equal(deltas.find((row) => row.inventoryId === 22).delta, 0.024)
})

test('two inventory rows are ordered so locks cannot deadlock', () => {
  const deltas = planStockDeltas(
    [
      { menu_item_id: 2, quantity: 1 },
      { menu_item_id: 1, quantity: 2 },
    ],
    [
      { menu_item_id: 1, inventory_id: 20, quantity_per_unit: 1 },
      { menu_item_id: 2, inventory_id: 5, quantity_per_unit: 1 },
    ],
    new Map(),
  )
  assert.deepEqual(deltas, [
    { inventoryId: 5, delta: 1 },
    { inventoryId: 20, delta: 2 },
  ])
})
