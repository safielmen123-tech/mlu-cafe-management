let menuItemsImageSchemaReadyPromise = null

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
    `,
    [table, column],
  )
  return rows.length > 0
}

function normalizeMenuImageUrl(raw) {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  return trimmed === '' ? null : trimmed.slice(0, 512)
}

function serializeMenuItem(row) {
  const price = Number.parseFloat(row?.price)
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number.isFinite(price) ? price : 0,
    image_url: normalizeMenuImageUrl(row.image_url),
    is_available: row.is_available === 0 || row.is_available === false ? false : true,
  }
}

async function ensureMenuItemsImageSchema(db) {
  if (!menuItemsImageSchemaReadyPromise) {
    menuItemsImageSchemaReadyPromise = (async () => {
      const hasImageUrl = await columnExists(db, 'menu_items', 'image_url')
      if (!hasImageUrl) {
        await db.execute(
          'ALTER TABLE menu_items ADD COLUMN image_url VARCHAR(512) NULL AFTER price',
        )
      }
    })().catch((error) => {
      menuItemsImageSchemaReadyPromise = null
      throw error
    })
  }

  return menuItemsImageSchemaReadyPromise
}

module.exports = {
  ensureMenuItemsImageSchema,
  normalizeMenuImageUrl,
  serializeMenuItem,
}
