const XLSX = require('xlsx')
const { appendWhere, buildOrderPeriodClause } = require('./backupPeriod')

const orderPeriod = buildOrderPeriodClause('updated_at')

function buildExportSheets(period) {
  const ordersFilter = orderPeriod(period)
  const paymentsFilter = appendWhere("status = 'Completed'", orderPeriod(period))
  const salesFilter = appendWhere("o.status = 'Completed'", orderPeriod(period))
  const orderItemsFilter = period.scope === 'month'
    ? {
        clause: `o.updated_at >= ? AND o.updated_at < ?`,
        params: [period.startDate, period.endDate],
      }
    : { clause: '', params: [] }

  return [
    {
      name: 'Orders',
      query: `
        SELECT
          id,
          invoice_id,
          target_id,
          table_id,
          source_type,
          status,
          bill_requested,
          subtotal,
          tax,
          total,
          total_amount,
          payment_method,
          payment_type,
          created_at,
          updated_at
        FROM orders
        ${ordersFilter.clause ? `WHERE ${ordersFilter.clause}` : ''}
        ORDER BY created_at DESC
      `,
      params: ordersFilter.params,
    },
    {
      name: 'Payments',
      query: `
        SELECT
          id AS order_id,
          invoice_id,
          payment_method,
          payment_type,
          subtotal,
          tax,
          total,
          total_amount,
          status,
          source_type,
          target_id,
          created_at,
          updated_at
        FROM orders
        ${paymentsFilter.clause ? `WHERE ${paymentsFilter.clause}` : ''}
        ORDER BY updated_at DESC
      `,
      params: paymentsFilter.params,
    },
    {
      name: 'Sales History',
      query: `
        SELECT
          o.id AS order_id,
          o.invoice_id,
          o.target_id,
          o.source_type,
          o.payment_method,
          o.payment_type,
          o.subtotal,
          o.tax,
          o.total,
          o.status,
          DATE_FORMAT(o.updated_at, '%Y-%m-%d') AS sale_date,
          DATE_FORMAT(o.updated_at, '%H:%i:%s') AS sale_time,
          GROUP_CONCAT(CONCAT(oi.quantity, 'x ', m.name) ORDER BY m.name SEPARATOR ', ') AS items_summary
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items m ON m.id = oi.menu_item_id
        ${salesFilter.clause ? `WHERE ${salesFilter.clause}` : ''}
        GROUP BY o.id
        ORDER BY o.updated_at DESC
      `,
      params: salesFilter.params,
    },
    {
      name: 'Order Items',
      query: `
        SELECT
          oi.id,
          oi.order_id,
          o.invoice_id,
          m.name AS menu_item,
          m.category,
          oi.notes,
          oi.quantity,
          oi.price,
          oi.subtotal,
          o.status AS order_status,
          o.updated_at AS order_updated_at
        FROM order_items oi
        JOIN menu_items m ON m.id = oi.menu_item_id
        JOIN orders o ON o.id = oi.order_id
        ${orderItemsFilter.clause ? `WHERE ${orderItemsFilter.clause}` : ''}
        ORDER BY o.updated_at DESC, oi.id ASC
      `,
      params: orderItemsFilter.params,
    },
    {
      name: 'Menu Items',
      query: `
        SELECT id, name, category, price, is_available
        FROM menu_items
        ORDER BY category, name
      `,
      params: [],
    },
    {
      name: 'User Accounts',
      query: `
        SELECT
          id,
          display_name,
          username,
          role,
          permissions
        FROM users
        ORDER BY display_name ASC
      `,
      params: [],
    },
    {
      name: 'Inventory',
      query: 'SELECT * FROM inventory ORDER BY section, category, item_name',
      params: [],
    },
    {
      name: 'Tables',
      query: `
        SELECT id, table_name, status
        FROM tables
        ORDER BY id
      `,
      params: [],
    },
    {
      name: 'Reservations',
      query: `
        SELECT
          r.id,
          r.customer_name,
          r.phone,
          r.reservation_date,
          r.time_slot,
          r.duration_minutes,
          r.table_id,
          t.table_name,
          r.guest_count,
          r.status,
          r.notes,
          r.created_at,
          r.updated_at
        FROM reservations r
        LEFT JOIN tables t ON t.id = r.table_id
        ORDER BY r.reservation_date DESC, r.time_slot ASC
      `,
      params: [],
    },
  ]
}

function serializeRow(row) {
  const serialized = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      serialized[key] = value.toISOString()
    } else if (typeof value === 'object' && value !== null) {
      serialized[key] = JSON.stringify(value)
    } else {
      serialized[key] = value
    }
  }
  return serialized
}

async function buildBusinessDataWorkbook(db, period) {
  const workbook = XLSX.utils.book_new()
  const sheets = buildExportSheets(period)

  for (const sheet of sheets) {
    try {
      const [rows] = await db.execute(sheet.query, sheet.params)
      const serializedRows = rows.map(serializeRow)
      const worksheet = XLSX.utils.json_to_sheet(serializedRows.length ? serializedRows : [{ note: 'No records found' }])
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        const worksheet = XLSX.utils.json_to_sheet([{ note: 'No records found' }])
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
        continue
      }
      throw error
    }
  }

  return workbook
}

async function exportBusinessDataBuffer(db, period) {
  const workbook = await buildBusinessDataWorkbook(db, period)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

module.exports = {
  buildExportSheets,
  exportBusinessDataBuffer,
}
