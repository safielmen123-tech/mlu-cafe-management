let schemaReadyPromise = null

const KITCHEN_STATUSES = ['Pending', 'Preparing', 'Ready']

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [table, column],
  )
  return Number(rows[0]?.cnt) > 0
}

async function ensureKitchenSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const hasKitchenStatus = await columnExists(db, 'orders', 'kitchen_status')
      if (!hasKitchenStatus) {
        await db.execute(`
          ALTER TABLE orders
          ADD COLUMN kitchen_status VARCHAR(20) NOT NULL DEFAULT 'Pending'
          AFTER status
        `)
      }
      await db.execute(`
        UPDATE orders
        SET kitchen_status = 'Pending'
        WHERE kitchen_status IS NULL OR kitchen_status = ''
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }
  return schemaReadyPromise
}

function normalizeKitchenStatus(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'preparing') return 'Preparing'
  if (raw === 'ready') return 'Ready'
  if (raw === 'pending') return 'Pending'
  return null
}

async function listKitchenOrders(db) {
  await ensureKitchenSchema(db)
  const { targetIdSelectSql } = require('./orderTargets')
  const targetSelect = targetIdSelectSql('o')

  const [orderRows] = await db.execute(
    `
    SELECT
      o.id AS order_id,
      ${targetSelect} AS target_id,
      o.source_type,
      o.status,
      o.kitchen_status,
      o.created_at,
      o.updated_at
    FROM orders o
    WHERE o.status = 'Pending'
    ORDER BY o.created_at ASC
    `,
  )

  if (orderRows.length === 0) return []

  const orderIds = orderRows.map((row) => row.order_id)
  const placeholders = orderIds.map(() => '?').join(', ')
  const [itemRows] = await db.execute(
    `
    SELECT
      oi.order_id,
      COALESCE(m.name, oi.item_name, 'Custom item') AS name,
      oi.quantity AS qty,
      oi.price AS unitPrice
    FROM order_items oi
    LEFT JOIN menu_items m ON oi.menu_item_id = m.id
    WHERE oi.order_id IN (${placeholders})
    `,
    orderIds,
  )

  const itemsByOrder = itemRows.reduce((acc, row) => {
    if (!acc[row.order_id]) acc[row.order_id] = []
    acc[row.order_id].push({
      name: row.name,
      qty: Number(row.qty) || 0,
      unitPrice: Number.parseFloat(row.unitPrice) || 0,
    })
    return acc
  }, {})

  return orderRows.map((row) => {
    const items = itemsByOrder[row.order_id] || []
    const targetKey = row.target_id != null ? String(row.target_id) : 'takeout'
    const source =
      targetKey === 'takeout' || row.source_type === 'Take Out'
        ? 'Take Out'
        : `Table ${targetKey}`

    return {
      id: row.order_id,
      order_id: row.order_id,
      target_id: targetKey,
      source,
      kitchen_status: normalizeKitchenStatus(row.kitchen_status) || 'Pending',
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      summary: items.length
        ? items.map((item) => `${item.qty}× ${item.name}`).join(', ')
        : 'No items',
      items,
    }
  })
}

async function updateKitchenStatus(db, orderId, kitchenStatus) {
  await ensureKitchenSchema(db)
  const id = Number.parseInt(orderId, 10)
  const nextStatus = normalizeKitchenStatus(kitchenStatus)

  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Invalid order id'), { status: 400 })
  }
  if (!nextStatus || !KITCHEN_STATUSES.includes(nextStatus)) {
    throw Object.assign(new Error('kitchen_status must be Pending, Preparing, or Ready'), {
      status: 400,
    })
  }

  const [result] = await db.execute(
    `
    UPDATE orders
    SET kitchen_status = ?, updated_at = NOW()
    WHERE id = ? AND status = 'Pending'
    `,
    [nextStatus, id],
  )

  if (result.affectedRows === 0) {
    throw Object.assign(new Error('Active kitchen order not found'), { status: 404 })
  }

  return { order_id: id, kitchen_status: nextStatus }
}

module.exports = {
  KITCHEN_STATUSES,
  ensureKitchenSchema,
  normalizeKitchenStatus,
  listKitchenOrders,
  updateKitchenStatus,
}
