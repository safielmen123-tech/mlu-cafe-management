let schemaReadyPromise = null

async function getUpdatedAtColumn(db) {
  const [rows] = await db.execute(
    `
    SELECT COLUMN_TYPE, COLUMN_DEFAULT, EXTRA, IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'updated_at'
    LIMIT 1
    `,
  )
  return rows[0] || null
}

/**
 * Sale history uses updated_at as the sale timestamp.
 * ON UPDATE CURRENT_TIMESTAMP rewrites every row during unrelated ALTER/UPDATE
 * (for example MODIFY tax), which made a full year of seeded sales look like
 * the current month. Strip that auto-update and restore overwritten dates.
 */
async function ensureOrdersSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const column = await getUpdatedAtColumn(db)
      if (column && String(column.EXTRA || '').toLowerCase().includes('on update')) {
        await db.execute(
          'ALTER TABLE orders MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
        )
      }

      const [result] = await db.execute(
        `
        UPDATE orders
        SET updated_at = created_at
        WHERE created_at IS NOT NULL
          AND updated_at IS NOT NULL
          AND updated_at > DATE_ADD(created_at, INTERVAL 1 DAY)
        `,
      )

      return Number(result.affectedRows || 0)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

module.exports = {
  ensureOrdersSchema,
}
