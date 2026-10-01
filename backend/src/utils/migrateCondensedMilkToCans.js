/**
 * One-time, re-runnable migration: Condensed Milk kg → cans.
 * Pack size estimate: KG_PER_CAN (editable). Placeholder max: MAX_CANS.
 * No pack-size column exists, so recipe links store cans = grams / (KG_PER_CAN * 1000).
 */
const { resolveStockStatus } = require('./inventorySchema')
const { writeAuditLog } = require('./auditLog')
const { clearAlertsCache } = require('./alertEngine')

/** Editable estimate: 1 can = 300 g = 0.3 kg */
const KG_PER_CAN = 0.3
const GRAMS_PER_CAN = KG_PER_CAN * 1000
/** Placeholder maximum after conversion */
const MAX_CANS = 48

const ITEM_NAME = 'Condensed Milk'

/** Menu name → grams of condensed milk per serving (must stay identical in real mass). */
const LINK_GRAMS = {
  'Red Milk Tea': 30,
  'Green Milk Tea': 30,
  'Butterfly Milk Tea': 25,
  'Khmer Coffee': 35,
  'Sero Milk': 25,
}

function round6(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.round((num + Number.EPSILON) * 1e6) / 1e6
}

function cansFromKg(kg) {
  return round6(Number(kg) / KG_PER_CAN)
}

function cansFromGrams(grams) {
  return round6(Number(grams) / GRAMS_PER_CAN)
}

function defaultThresholds(max) {
  return {
    low: Math.round(Number(max) * 0.2 * 1000) / 1000,
    critical: Math.round(Number(max) * 0.1 * 1000) / 1000,
  }
}

async function widenPrecisionColumns(conn) {
  await conn.execute(
    'ALTER TABLE inventory MODIFY COLUMN stock_quantity DECIMAL(14,6) NOT NULL DEFAULT 0',
  )
  await conn.execute(
    'ALTER TABLE menu_item_stock_links MODIFY COLUMN quantity_per_unit DECIMAL(18,6) NOT NULL',
  )
  await conn.execute(
    'ALTER TABLE stock_movements MODIFY COLUMN change_amount DECIMAL(14,6) NOT NULL',
  )
  await conn.execute(
    'ALTER TABLE stock_movements MODIFY COLUMN quantity_after DECIMAL(14,6) NOT NULL',
  )
}

async function migrateCondensedMilkToCans(db, { actor = null } = {}) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await widenPrecisionColumns(conn)

    const [rows] = await conn.execute(
      `SELECT id, item_name, unit_label, section, is_weight, stock_quantity, max_stock,
              low_threshold, critical_threshold, stock_status
       FROM inventory WHERE item_name = ? FOR UPDATE`,
      [ITEM_NAME],
    )
    if (!rows.length) {
      throw Object.assign(new Error(`${ITEM_NAME} stock row not found`), { status: 404 })
    }
    const item = rows[0]
    const alreadyCans =
      String(item.unit_label).toLowerCase() === 'cans'
      && String(item.section) === 'countable'
      && Number(item.is_weight) === 0

    const before = {
      id: item.id,
      unit_label: item.unit_label,
      section: item.section,
      is_weight: Number(item.is_weight),
      stock_quantity: Number(item.stock_quantity),
      max_stock: Number(item.max_stock),
      low_threshold: Number(item.low_threshold),
      critical_threshold: item.critical_threshold == null ? null : Number(item.critical_threshold),
      stock_status: item.stock_status,
    }

    let stockCans
    let thresholds
    if (alreadyCans) {
      stockCans = round6(before.stock_quantity)
      thresholds = {
        low: before.low_threshold,
        critical: before.critical_threshold,
      }
    } else {
      if (String(item.unit_label).toLowerCase() !== 'kg') {
        throw Object.assign(
          new Error(`${ITEM_NAME} is neither kg nor cans (unit=${item.unit_label})`),
          { status: 409 },
        )
      }
      stockCans = cansFromKg(before.stock_quantity)
      thresholds = defaultThresholds(MAX_CANS)
    }

    const status = resolveStockStatus(stockCans, thresholds.low, thresholds.critical)
    await conn.execute(
      `UPDATE inventory
       SET section = 'countable', unit_label = 'cans', unit_singular = 'can', is_weight = 0,
           stock_quantity = ?, max_stock = ?, low_threshold = ?, critical_threshold = ?,
           stock_status = ?
       WHERE id = ?`,
      [stockCans, MAX_CANS, thresholds.low, thresholds.critical, status, item.id],
    )

    const [linkRows] = await conn.execute(
      `SELECT l.id, l.quantity_per_unit, m.name AS menu_name
       FROM menu_item_stock_links l
       JOIN menu_items m ON m.id = l.menu_item_id
       WHERE l.inventory_id = ?
       FOR UPDATE`,
      [item.id],
    )

    const linkReport = []
    for (const link of linkRows) {
      const grams = LINK_GRAMS[link.menu_name]
      if (grams == null) {
        throw Object.assign(
          new Error(`Unexpected Condensed Milk link: ${link.menu_name}`),
          { status: 409 },
        )
      }
      const exactCans = Number(grams) / GRAMS_PER_CAN
      const stored = cansFromGrams(grams)
      const reconstructedGrams = stored * GRAMS_PER_CAN
      await conn.execute(
        'UPDATE menu_item_stock_links SET quantity_per_unit = ? WHERE id = ?',
        [stored, link.id],
      )
      linkReport.push({
        menu_name: link.menu_name,
        grams,
        old_quantity_per_unit: Number(link.quantity_per_unit),
        new_quantity_per_unit: stored,
        exact_cans: exactCans,
        reconstructed_grams: reconstructedGrams,
        rounding_error_grams: reconstructedGrams - grams,
      })
    }

    const [moves] = await conn.execute(
      `SELECT id, change_amount, quantity_after
       FROM stock_movements WHERE inventory_id = ?
       FOR UPDATE`,
      [item.id],
    )
    let movementsConverted = 0
    if (!alreadyCans) {
      for (const move of moves) {
        await conn.execute(
          `UPDATE stock_movements
           SET change_amount = ?, quantity_after = ?
           WHERE id = ?`,
          [cansFromKg(move.change_amount), cansFromKg(move.quantity_after), move.id],
        )
        movementsConverted += 1
      }
    }

    if (!alreadyCans) {
      await writeAuditLog(conn, {
        userId: actor?.id ?? null,
        userRole: actor?.role ?? null,
        username: actor?.username || 'system',
        action: 'inventory_unit_change',
        module: 'Inventory',
        description:
          `Unit changed kg to cans at ${KG_PER_CAN} kg/can` +
          ` (item #${item.id} Condensed Milk).` +
          ` On-hand ${before.stock_quantity} kg → ${stockCans} cans;` +
          ` max ${before.max_stock} → ${MAX_CANS};` +
          ` low ${before.low_threshold} → ${thresholds.low};` +
          ` very-low ${before.critical_threshold ?? 'none'} → ${thresholds.critical}.`,
      })
    }

    await conn.commit()
    clearAlertsCache()

    const [afterRows] = await db.execute(
      `SELECT id, item_name, section, unit_label, unit_singular, is_weight,
              stock_quantity, max_stock, low_threshold, critical_threshold, stock_status
       FROM inventory WHERE id = ?`,
      [item.id],
    )

    return {
      skipped: alreadyCans,
      kgPerCan: KG_PER_CAN,
      gramsPerCan: GRAMS_PER_CAN,
      maxCans: MAX_CANS,
      before,
      after: afterRows[0],
      links: linkReport,
      movementsConverted,
      movementCount: moves.length,
      packSizeFeature: false,
    }
  } catch (error) {
    try { await conn.rollback() } catch { /* ignore */ }
    throw error
  } finally {
    conn.release()
  }
}

module.exports = {
  KG_PER_CAN,
  GRAMS_PER_CAN,
  MAX_CANS,
  ITEM_NAME,
  LINK_GRAMS,
  cansFromKg,
  cansFromGrams,
  round6,
  migrateCondensedMilkToCans,
}
