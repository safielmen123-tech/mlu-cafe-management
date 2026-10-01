/**
 * One-time migration:
 *  A) Lower fish fillet max stocks (Salmon 4, Boneless 5; recompute thresholds only when they were 20%/10% defaults)
 *  B) Split "Fish or Chicken Sour Soup" into Fish Sour Soup + Chicken Sour Soup
 *     - Rename inventory "Fish or Chicken (soup protein)" → "Fish (soup)"
 *     - Chicken soup uses existing "Chicken Breast" at 0.2 kg/serving
 *     - Soft-disable the combined menu item
 *
 * Re-runnable / idempotent. Call after createSafetyBackup.
 */
const { resolveStockStatus } = require('./inventorySchema')
const { writeAuditLog } = require('./auditLog')
const { clearAlertsCache } = require('./alertEngine')

const COMBINED_MENU = 'Fish or Chicken Sour Soup'
const FISH_MENU = 'Fish Sour Soup'
const CHICKEN_MENU = 'Chicken Sour Soup'
const COMBINED_STOCK = 'Fish or Chicken (soup protein)'
const FISH_STOCK = 'Fish (soup)'
const CHICKEN_STOCK = 'Chicken Breast'
const PROTEIN_KG = 0.2

function pct(max, fraction) {
  return Math.round(Number(max) * fraction * 1000) / 1000
}

function looksDefaultThresholds(max, low, critical) {
  const expectedLow = pct(max, 0.2)
  const expectedCritical = pct(max, 0.1)
  const lowN = Number(low)
  const critN = critical == null ? null : Number(critical)
  const lowMatches = Math.abs(lowN - expectedLow) < 0.001
  const criticalMatches = critN == null ? false : Math.abs(critN - expectedCritical) < 0.001
  return lowMatches && criticalMatches
}

async function applyFishMax(conn, name, newMax) {
  const [rows] = await conn.execute(
    `SELECT id, item_name, stock_quantity, max_stock, low_threshold, critical_threshold, stock_status
     FROM inventory WHERE item_name = ? LIMIT 1`,
    [name],
  )
  if (!rows.length) return { name, skipped: true, reason: 'not_found' }
  const row = rows[0]
  const oldMax = Number(row.max_stock)
  if (Math.abs(oldMax - newMax) < 0.001) {
    return { name, skipped: true, reason: 'already_applied', id: row.id, max: oldMax }
  }

  let low = Number(row.low_threshold)
  let critical = row.critical_threshold == null ? null : Number(row.critical_threshold)
  const recompute = looksDefaultThresholds(oldMax, row.low_threshold, row.critical_threshold)
  if (recompute) {
    low = pct(newMax, 0.2)
    critical = pct(newMax, 0.1)
  }

  const stock = Number(row.stock_quantity)
  const status = resolveStockStatus(stock, low, critical)
  await conn.execute(
    `UPDATE inventory
     SET max_stock = ?, low_threshold = ?, critical_threshold = ?, stock_status = ?
     WHERE id = ?`,
    [newMax, low, critical, status, row.id],
  )
  return {
    name,
    skipped: false,
    id: row.id,
    oldMax,
    newMax,
    low,
    critical,
    stock,
    status,
    thresholdsRecomputed: recompute,
  }
}

async function ensureMenuItem(conn, { name, category, price, imageUrl }) {
  const [existing] = await conn.execute(
    'SELECT id, name, is_available FROM menu_items WHERE name = ? LIMIT 1',
    [name],
  )
  if (existing.length) return { id: existing[0].id, created: false, row: existing[0] }

  const [result] = await conn.execute(
    `INSERT INTO menu_items (name, category, price, hot_price, iced_price, image_url, is_available)
     VALUES (?, ?, ?, NULL, NULL, ?, 1)`,
    [name, category, price, imageUrl],
  )
  return { id: result.insertId, created: true }
}

async function copyLinks(conn, fromMenuId, toMenuId, proteinInventoryId, proteinName) {
  const [links] = await conn.execute(
    `SELECT l.variant, l.option_key, l.option_value, l.quantity_per_unit,
            l.inventory_id, i.item_name
     FROM menu_item_stock_links l
     JOIN inventory i ON i.id = l.inventory_id
     WHERE l.menu_item_id = ?`,
    [fromMenuId],
  )

  const report = []
  for (const link of links) {
    const isProtein =
      link.item_name === COMBINED_STOCK
      || link.item_name === FISH_STOCK
      || link.item_name === 'Fish or Chicken (soup protein)'
    const inventoryId = isProtein ? proteinInventoryId : link.inventory_id
    const quantity = isProtein ? PROTEIN_KG : Number(link.quantity_per_unit)

    const [existing] = await conn.execute(
      `SELECT id FROM menu_item_stock_links
       WHERE menu_item_id = ? AND inventory_id = ?
         AND variant = ? AND option_key = ? AND option_value = ?
       LIMIT 1`,
      [toMenuId, inventoryId, link.variant || '', link.option_key || '', link.option_value || ''],
    )
    if (existing.length) {
      report.push({ inventoryId, item: isProtein ? proteinName : link.item_name, action: 'existed' })
      continue
    }
    await conn.execute(
      `INSERT INTO menu_item_stock_links
        (menu_item_id, variant, option_key, option_value, inventory_id, quantity_per_unit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [toMenuId, link.variant || '', link.option_key || '', link.option_value || '', inventoryId, quantity],
    )
    report.push({ inventoryId, item: isProtein ? proteinName : link.item_name, action: 'created', quantity })
  }
  return report
}

async function migrateSoupSplitAndFishMaxes(db, { actor = null } = {}) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const fishMaxReport = [
      await applyFishMax(conn, 'Boneless Fish Fillet', 5),
      await applyFishMax(conn, 'Salmon Fillet', 4),
    ]

    const [combinedMenuRows] = await conn.execute(
      'SELECT id, name, category, price, image_url, is_available FROM menu_items WHERE name = ? LIMIT 1',
      [COMBINED_MENU],
    )
    const [fishMenuRows] = await conn.execute(
      'SELECT id, name, is_available FROM menu_items WHERE name = ? LIMIT 1',
      [FISH_MENU],
    )
    const [chickenMenuRows] = await conn.execute(
      'SELECT id, name, is_available FROM menu_items WHERE name = ? LIMIT 1',
      [CHICKEN_MENU],
    )

    let soupReport = { skipped: false }

    if (fishMenuRows.length && chickenMenuRows.length) {
      soupReport = {
        skipped: true,
        reason: 'already_split',
        fishMenuId: fishMenuRows[0].id,
        chickenMenuId: chickenMenuRows[0].id,
      }
      if (combinedMenuRows.length && Number(combinedMenuRows[0].is_available) === 1) {
        await conn.execute('UPDATE menu_items SET is_available = 0 WHERE id = ?', [combinedMenuRows[0].id])
        soupReport.combinedDisabled = true
      }
    } else if (!combinedMenuRows.length) {
      soupReport = { skipped: true, reason: 'combined_menu_missing' }
    } else {
      const combined = combinedMenuRows[0]

      const [stockRows] = await conn.execute(
        `SELECT id, item_name, stock_quantity, max_stock, low_threshold, critical_threshold
         FROM inventory WHERE item_name IN (?, ?) LIMIT 2`,
        [COMBINED_STOCK, FISH_STOCK],
      )
      let fishStock = stockRows.find((row) => row.item_name === FISH_STOCK)
      const combinedStock = stockRows.find((row) => row.item_name === COMBINED_STOCK)
      if (!fishStock && combinedStock) {
        await conn.execute('UPDATE inventory SET item_name = ? WHERE id = ?', [FISH_STOCK, combinedStock.id])
        fishStock = { ...combinedStock, item_name: FISH_STOCK }
      }
      if (!fishStock) {
        const error = new Error(`Missing inventory row for ${COMBINED_STOCK} / ${FISH_STOCK}`)
        error.status = 500
        throw error
      }

      const [chickenStockRows] = await conn.execute(
        'SELECT id, item_name FROM inventory WHERE item_name = ? LIMIT 1',
        [CHICKEN_STOCK],
      )
      if (!chickenStockRows.length) {
        const error = new Error(`Missing inventory row for ${CHICKEN_STOCK}`)
        error.status = 500
        throw error
      }
      const chickenStock = chickenStockRows[0]

      const fishMenu = await ensureMenuItem(conn, {
        name: FISH_MENU,
        category: combined.category || 'Soup',
        price: Number(combined.price),
        imageUrl: combined.image_url || '/menu-images/fish-or-chicken-sour-soup.jpg',
      })
      const chickenMenu = await ensureMenuItem(conn, {
        name: CHICKEN_MENU,
        category: combined.category || 'Soup',
        price: Number(combined.price),
        imageUrl: combined.image_url || '/menu-images/fish-or-chicken-sour-soup.jpg',
      })

      const fishLinks = await copyLinks(conn, combined.id, fishMenu.id, fishStock.id, FISH_STOCK)
      const chickenLinks = await copyLinks(conn, combined.id, chickenMenu.id, chickenStock.id, CHICKEN_STOCK)

      await conn.execute('UPDATE menu_items SET is_available = 0 WHERE id = ?', [combined.id])

      soupReport = {
        skipped: false,
        combinedMenuId: combined.id,
        fishMenuId: fishMenu.id,
        fishMenuCreated: fishMenu.created,
        chickenMenuId: chickenMenu.id,
        chickenMenuCreated: chickenMenu.created,
        fishStockId: fishStock.id,
        chickenStockId: chickenStock.id,
        fishLinks,
        chickenLinks,
      }
    }

    await writeAuditLog(conn, {
      userId: actor?.id ?? null,
      userRole: actor?.role ?? 'system',
      username: actor?.username ?? 'migration',
      action: 'migrate_soup_split_fish_maxes',
      module: 'Inventory',
      description: 'Applied fish max adjustments and Fish/Chicken Sour Soup split',
    })

    await conn.commit()
    clearAlertsCache()
    return { fishMaxReport, soupReport }
  } catch (error) {
    try { await conn.rollback() } catch { /* ignore */ }
    throw error
  } finally {
    conn.release()
  }
}

module.exports = {
  migrateSoupSplitAndFishMaxes,
  COMBINED_MENU,
  FISH_MENU,
  CHICKEN_MENU,
  COMBINED_STOCK,
  FISH_STOCK,
  CHICKEN_STOCK,
  PROTEIN_KG,
}
