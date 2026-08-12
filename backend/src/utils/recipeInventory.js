const { clearAlertsCache } = require('./alertEngine');

let schemaReadyPromise = null;

/** Inventory rows use unit_label (schemas may not have a `unit` column). */
function inventoryUnitSql(alias) {
  return `COALESCE(NULLIF(TRIM(${alias}.unit_label), ''), NULLIF(TRIM(${alias}.unit_singular), ''), 'pcs')`;
}

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
  );
  return rows.length > 0;
}

async function ensureRecipeSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS menu_item_ingredients (
          id INT AUTO_INCREMENT PRIMARY KEY,
          menu_item_id INT NOT NULL,
          inventory_item_id INT NOT NULL,
          quantity_required DECIMAL(12, 4) NOT NULL,
          unit VARCHAR(16) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_menu_inventory (menu_item_id, inventory_item_id),
          CONSTRAINT fk_mii_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
          CONSTRAINT fk_mii_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE
        )
      `);

      const hasDeductedCol = await columnExists(db, 'order_items', 'inventory_deducted');
      if (!hasDeductedCol) {
        await db.execute(
          'ALTER TABLE order_items ADD COLUMN inventory_deducted TINYINT(1) NOT NULL DEFAULT 0',
        );
      }

      const hasStockStatus = await columnExists(db, 'inventory', 'stock_status');
      if (!hasStockStatus) {
        await db.execute(
          "ALTER TABLE inventory ADD COLUMN stock_status VARCHAR(32) NOT NULL DEFAULT 'IN_STOCK'",
        );
      }

      const hasUnitCost = await columnExists(db, 'inventory', 'unit_cost');
      if (!hasUnitCost) {
        await db.execute(
          'ALTER TABLE inventory ADD COLUMN unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0',
        );
      }
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
}

function roundMoney(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function computeLineIngredientCost(quantityRequired, recipeUnit, inventoryUnit, unitCost) {
  const normalized = normalizeQuantityToInventoryUnit(
    quantityRequired,
    recipeUnit,
    inventoryUnit,
  );
  return roundMoney(normalized * Number(unitCost || 0));
}

function normalizeQuantityToInventoryUnit(amount, recipeUnit, inventoryUnit) {
  const qty = Number(amount);
  if (!Number.isFinite(qty) || qty <= 0) return 0;

  const rUnit = String(recipeUnit || '').trim().toLowerCase();
  const iUnit = String(inventoryUnit || '').trim().toLowerCase();

  if (rUnit === iUnit || !rUnit || !iUnit) return qty;

  if (rUnit === 'g' && iUnit === 'kg') return qty / 1000;
  if (rUnit === 'kg' && iUnit === 'g') return qty * 1000;
  if (rUnit === 'ml' && (iUnit === 'l' || iUnit === 'liter' || iUnit === 'litre')) return qty / 1000;
  if ((rUnit === 'l' || rUnit === 'liter' || rUnit === 'litre') && iUnit === 'ml') return qty * 1000;

  return qty;
}

function resolveStockStatus(stock, lowThreshold, criticalThreshold) {
  const qty = Number(stock);
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (criticalThreshold != null && qty <= Number(criticalThreshold)) return 'LOW_STOCK';
  if (lowThreshold != null && lowThreshold > 0 && qty <= Number(lowThreshold)) return 'LOW_STOCK';
  return 'IN_STOCK';
}

async function fetchRecipeRowsForMenuItem(dbOrConn, menuItemId) {
  const [rows] = await dbOrConn.execute(
    `
    SELECT
      id,
      menu_item_id,
      inventory_item_id,
      quantity_required,
      unit
    FROM menu_item_ingredients
    WHERE menu_item_id = ?
    `,
    [menuItemId],
  );
  return rows;
}

async function getMenuItemRecipe(db, menuItemId) {
  await ensureRecipeSchema(db);

  const [menuRows] = await db.execute('SELECT id, name, price FROM menu_items WHERE id = ? LIMIT 1', [
    menuItemId,
  ]);
  if (!menuRows.length) return null;

  const [ingredientRows] = await db.execute(
    `
    SELECT
      mii.id,
      mii.menu_item_id,
      mii.inventory_item_id,
      mii.quantity_required,
      mii.unit,
      i.item_name,
      ${inventoryUnitSql('i')} AS inventory_unit,
      i.stock_quantity,
      i.unit_cost
    FROM menu_item_ingredients mii
    JOIN inventory i ON i.id = mii.inventory_item_id
    WHERE mii.menu_item_id = ?
    ORDER BY i.item_name ASC
    `,
    [menuItemId],
  );

  const ingredients = ingredientRows.map((row) => {
    const unitCost = Number(row.unit_cost || 0);
    const lineCost = computeLineIngredientCost(
      row.quantity_required,
      row.unit,
      row.inventory_unit,
      unitCost,
    );
    return {
      id: row.id,
      inventory_item_id: row.inventory_item_id,
      inventoryItemName: row.item_name,
      quantity_required: Number(row.quantity_required),
      unit: row.unit,
      inventory_unit: row.inventory_unit,
      unit_cost: unitCost,
      line_cost: lineCost,
      current_stock: Number(row.stock_quantity),
    };
  });

  const estimatedCostPerServing = roundMoney(
    ingredients.reduce((sum, row) => sum + row.line_cost, 0),
  );
  const menuPrice = Number(menuRows[0].price || 0);
  const estimatedMargin = roundMoney(menuPrice - estimatedCostPerServing);
  const foodCostPercent =
    menuPrice > 0 ? roundMoney((estimatedCostPerServing / menuPrice) * 100) : 0;

  return {
    menuItemId: menuRows[0].id,
    menuItemName: menuRows[0].name,
    menuPrice,
    estimatedCostPerServing,
    estimatedMargin,
    foodCostPercent,
    ingredients,
  };
}

async function saveMenuItemRecipe(db, menuItemId, ingredients) {
  await ensureRecipeSchema(db);

  const [menuRows] = await db.execute('SELECT id FROM menu_items WHERE id = ? LIMIT 1', [menuItemId]);
  if (!menuRows.length) {
    throw new Error('Menu item not found');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [menuItemId]);

    for (const row of ingredients) {
      const inventoryId = Number(row.inventory_item_id);
      const quantity = Number(row.quantity_required);
      const unit = String(row.unit || '').trim();

      if (!inventoryId || !Number.isFinite(quantity) || quantity <= 0 || !unit) continue;

      await connection.execute(
        `
        INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, quantity_required, unit)
        VALUES (?, ?, ?, ?)
        `,
        [menuItemId, inventoryId, quantity, unit],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getMenuItemRecipe(db, menuItemId);
}

async function applyInventoryDeductionForLine(dbOrConn, menuItemId, orderQty, connection = dbOrConn) {
  const recipes = await fetchRecipeRowsForMenuItem(connection, menuItemId);
  if (!recipes.length) return { deducted: [], skipped: true };

  const deducted = [];

  for (const recipe of recipes) {
    const [invRows] = await connection.execute(
      `
      SELECT id, item_name, stock_quantity, ${inventoryUnitSql('inv')} AS unit,
             low_threshold,
             critical_threshold, stock_status
      FROM inventory inv
      WHERE id = ?
      FOR UPDATE
      `,
      [recipe.inventory_item_id],
    );

    if (!invRows.length) continue;

    const inv = invRows[0];
    const perServing = normalizeQuantityToInventoryUnit(
      recipe.quantity_required,
      recipe.unit,
      inv.unit,
    );
    const totalUse = perServing * Number(orderQty);
    if (totalUse <= 0) continue;

    const currentStock = Number(inv.stock_quantity ?? 0);
    const newStock = Math.max(0, Math.round((currentStock - totalUse) * 10000) / 10000);
    const lowThreshold = Number(inv.low_threshold ?? 0);
    const criticalThreshold =
      inv.critical_threshold != null ? Number(inv.critical_threshold) : null;
    const stockStatus = resolveStockStatus(newStock, lowThreshold, criticalThreshold);

    await connection.execute(
      `
      UPDATE inventory
      SET stock_quantity = ?, stock_status = ?
      WHERE id = ?
      `,
      [newStock, stockStatus, inv.id],
    );

    deducted.push({
      inventory_item_id: inv.id,
      item_name: inv.item_name,
      used: totalUse,
      remaining: newStock,
      stock_status: stockStatus,
    });
  }

  return { deducted, skipped: deducted.length === 0 };
}

async function applyInventoryRestockForLine(dbOrConn, menuItemId, orderQty, connection = dbOrConn) {
  const recipes = await fetchRecipeRowsForMenuItem(connection, menuItemId);
  if (!recipes.length) return { restored: [] };

  const restored = [];

  for (const recipe of recipes) {
    const [invRows] = await connection.execute(
      `
      SELECT id, item_name, stock_quantity, ${inventoryUnitSql('inv')} AS unit,
             low_threshold,
             critical_threshold, stock_status
      FROM inventory inv
      WHERE id = ?
      FOR UPDATE
      `,
      [recipe.inventory_item_id],
    );

    if (!invRows.length) continue;

    const inv = invRows[0];
    const perServing = normalizeQuantityToInventoryUnit(
      recipe.quantity_required,
      recipe.unit,
      inv.unit,
    );
    const totalReturn = perServing * Number(orderQty);
    if (totalReturn <= 0) continue;

    const currentStock = Number(inv.stock_quantity ?? 0);
    const newStock = Math.round((currentStock + totalReturn) * 10000) / 10000;
    const lowThreshold = Number(inv.low_threshold ?? 0);
    const criticalThreshold =
      inv.critical_threshold != null ? Number(inv.critical_threshold) : null;
    const stockStatus = resolveStockStatus(newStock, lowThreshold, criticalThreshold);

    await connection.execute(
      `UPDATE inventory SET stock_quantity = ?, stock_status = ? WHERE id = ?`,
      [newStock, stockStatus, inv.id],
    );

    restored.push({
      inventory_item_id: inv.id,
      item_name: inv.item_name,
      returned: totalReturn,
      remaining: newStock,
      stock_status: stockStatus,
    });
  }

  return { restored };
}

async function restoreInventoryForOrderId(db, orderId) {
  await ensureRecipeSchema(db);

  const [rows] = await db.execute(
    `
    SELECT id, menu_item_id, quantity
    FROM order_items
    WHERE order_id = ? AND inventory_deducted = 1
    `,
    [orderId],
  );

  if (!rows.length) return { restored: [] };

  const connection = await db.getConnection();
  const allRestored = [];

  try {
    await connection.beginTransaction();

    for (const row of rows) {
      const result = await applyInventoryRestockForLine(
        connection,
        row.menu_item_id,
        row.quantity,
        connection,
      );
      if (result.restored.length) {
        allRestored.push(...result.restored);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (allRestored.length) {
    clearAlertsCache();
  }

  return { restored: allRestored };
}

/**
 * Deduct inventory for order lines. Each line: { order_item_id?, menu_item_id, quantity }
 */
async function deductInventoryForOrderLines(db, lines, { markOrderItemIds = true } = {}) {
  if (!lines?.length) return { deductions: [], updatedInventory: [] };

  await ensureRecipeSchema(db);

  const connection = await db.getConnection();
  const allDeductions = [];

  try {
    await connection.beginTransaction();

    for (const line of lines) {
      const menuItemId = Number(line.menu_item_id);
      const orderQty = Number(line.quantity);
      if (!menuItemId || !Number.isFinite(orderQty) || orderQty <= 0) continue;

      const result = await applyInventoryDeductionForLine(db, menuItemId, orderQty, connection);
      if (result.deducted.length) {
        allDeductions.push(...result.deducted);
      }

      if (markOrderItemIds && line.order_item_id) {
        await connection.execute(
          'UPDATE order_items SET inventory_deducted = 1 WHERE id = ?',
          [line.order_item_id],
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (allDeductions.length) {
    clearAlertsCache();
  }

  return {
    deductions: allDeductions,
    updatedInventory: allDeductions.length,
  };
}

async function deductInventoryForOrderId(db, orderId) {
  await ensureRecipeSchema(db);

  const [rows] = await db.execute(
    `
    SELECT id, menu_item_id, quantity
    FROM order_items
    WHERE order_id = ? AND inventory_deducted = 0
    `,
    [orderId],
  );

  const lines = rows.map((row) => ({
    order_item_id: row.id,
    menu_item_id: row.menu_item_id,
    quantity: row.quantity,
  }));

  return deductInventoryForOrderLines(db, lines, { markOrderItemIds: true });
}

async function deductInventoryForConfirmedItems(db, items) {
  const lines = (items || []).map((item) => ({
    menu_item_id: item.menu_item_id ?? item.id,
    quantity: item.quantity ?? item.qty,
  }));

  return deductInventoryForOrderLines(db, lines, { markOrderItemIds: false });
}

module.exports = {
  ensureRecipeSchema,
  getMenuItemRecipe,
  saveMenuItemRecipe,
  deductInventoryForOrderId,
  deductInventoryForConfirmedItems,
  deductInventoryForOrderLines,
  restoreInventoryForOrderId,
  normalizeQuantityToInventoryUnit,
  resolveStockStatus,
  computeLineIngredientCost,
  roundMoney,
};
