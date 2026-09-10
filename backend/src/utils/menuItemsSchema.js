let menuItemsSchemaReadyPromise = null

const MENU_CATEGORIES = ['Coffee', 'Tea', 'Cold Drinks', 'Beer', 'Starters', 'Mains', 'Soup', 'Vegetable', 'Dessert']
// ENUM storage order must stay stable. New values are appended only.
const MENU_ENUM_VALUES = ['Coffee', 'Tea', 'Starters', 'Mains', 'Soup', 'Vegetable', 'Dessert', 'Bakery', 'Food', 'Cold Drinks', 'Beer']
const MENU_CATEGORIES_WITH_LEGACY = MENU_ENUM_VALUES
const DRINK_CATEGORIES = new Set(['Coffee', 'Tea'])

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

function parseOptionalMoney(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function normalizeMenuCategory(raw) {
  const category = String(raw || '').trim()
  if (MENU_CATEGORIES_WITH_LEGACY.includes(category)) return category
  return null
}

function isFoodCategory(category) {
  return !DRINK_CATEGORIES.has(category)
}

function normalizeMenuPrices(body, category) {
  if (isFoodCategory(category)) {
    const price = parseOptionalMoney(body?.price)
    if (price == null) {
      return { error: 'Please fill in all fields (Name, Category, Price)' }
    }
    return { price, hot_price: null, iced_price: null }
  }

  const hot = parseOptionalMoney(body?.hot_price)
  const iced = parseOptionalMoney(body?.iced_price)
  if (hot == null && iced == null) {
    const price = parseOptionalMoney(body?.price)
    if (price == null) {
      return { error: 'Enter a Hot price, an Iced price, or both' }
    }
    return { price, hot_price: null, iced_price: null }
  }

  const offered = [hot, iced].filter((value) => value != null)
  return {
    price: Math.min(...offered),
    hot_price: hot,
    iced_price: iced,
  }
}

function serializeMenuItem(row) {
  const price = Number.parseFloat(row?.price)
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number.isFinite(price) ? price : 0,
    hot_price: parseOptionalMoney(row?.hot_price),
    iced_price: parseOptionalMoney(row?.iced_price),
    image_url: normalizeMenuImageUrl(row.image_url),
    is_available: row.is_available === 0 || row.is_available === false ? false : true,
  }
}

async function ensureMenuItemsSchema(db) {
  if (!menuItemsSchemaReadyPromise) {
    menuItemsSchemaReadyPromise = (async () => {
      const hasImageUrl = await columnExists(db, 'menu_items', 'image_url')
      if (!hasImageUrl) {
        await db.execute(
          'ALTER TABLE menu_items ADD COLUMN image_url VARCHAR(512) NULL AFTER price',
        )
      }

      const hasHotPrice = await columnExists(db, 'menu_items', 'hot_price')
      if (!hasHotPrice) {
        await db.execute(
          'ALTER TABLE menu_items ADD COLUMN hot_price DECIMAL(10,2) NULL AFTER price',
        )
      }

      const hasIcedPrice = await columnExists(db, 'menu_items', 'iced_price')
      if (!hasIcedPrice) {
        await db.execute(
          'ALTER TABLE menu_items ADD COLUMN iced_price DECIMAL(10,2) NULL AFTER hot_price',
        )
      }

      const enumValues = MENU_ENUM_VALUES.map((value) => `'${value}'`).join(',')
      await db.execute(`ALTER TABLE menu_items MODIFY category ENUM(${enumValues}) NOT NULL`)
    })().catch((error) => {
      menuItemsSchemaReadyPromise = null
      throw error
    })
  }

  return menuItemsSchemaReadyPromise
}

function menuCategoryFieldSql(column = 'category') {
  return `FIELD(${column}, ${MENU_CATEGORIES.map((value) => `'${value}'`).join(', ')})`
}

module.exports = {
  MENU_CATEGORIES,
  MENU_CATEGORIES_WITH_LEGACY,
  menuCategoryFieldSql,
  ensureMenuItemsSchema,
  ensureMenuItemsImageSchema: ensureMenuItemsSchema,
  normalizeMenuImageUrl,
  normalizeMenuCategory,
  normalizeMenuPrices,
  parseOptionalMoney,
  serializeMenuItem,
}
