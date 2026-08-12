export function normalizeQuantityToInventoryUnit(amount, recipeUnit, inventoryUnit) {
  const qty = Number(amount)
  if (!Number.isFinite(qty) || qty <= 0) return 0

  const rUnit = String(recipeUnit || '').trim().toLowerCase()
  const iUnit = String(inventoryUnit || '').trim().toLowerCase()

  if (rUnit === iUnit || !rUnit || !iUnit) return qty

  if (rUnit === 'g' && iUnit === 'kg') return qty / 1000
  if (rUnit === 'kg' && iUnit === 'g') return qty * 1000
  if (rUnit === 'ml' && (iUnit === 'l' || iUnit === 'liter' || iUnit === 'litre')) return qty / 1000
  if ((rUnit === 'l' || rUnit === 'liter' || rUnit === 'litre') && iUnit === 'ml') return qty * 1000

  return qty
}

export function computeRecipeCostSummary(recipeRows, inventoryStock, menuPrice) {
  let estimatedCost = 0

  for (const row of recipeRows) {
    if (!row.inventory_item_id || !row.quantity_required) continue
    const stock = inventoryStock.find(
      (item) => String(item.id) === String(row.inventory_item_id),
    )
    if (!stock) continue

    const inventoryUnit = stock.unit || stock.unit_label || 'unit'
    const unitCost = Number(stock.unit_cost ?? 0)
    const normalized = normalizeQuantityToInventoryUnit(
      row.quantity_required,
      row.unit,
      inventoryUnit,
    )
    estimatedCost += normalized * unitCost
  }

  const price = Number(menuPrice || 0)
  const cost = Math.round(estimatedCost * 10000) / 10000
  const margin = Math.round((price - cost) * 10000) / 10000
  const foodCostPercent = price > 0 ? Math.round((cost / price) * 10000) / 100 : 0

  return { estimatedCost, cost, margin, foodCostPercent }
}

export function getInventoryUnitCostLabel(stock) {
  const cost = Number(stock?.unit_cost ?? 0)
  const unit = stock?.unit || stock?.unit_label || 'unit'
  if (cost <= 0) return `no unit cost · ${unit}`
  return `$${cost.toFixed(4)} / ${unit}`
}
