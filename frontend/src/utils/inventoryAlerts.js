export function normalizeInventoryItem(item) {
  const stock = Number(item.stock_quantity ?? item.stock ?? 0)
  const maxStock = Number(item.max_stock ?? item.maxStock ?? 1)
  const lowThreshold = Number(
    item.low_threshold ?? item.low_stock_threshold ?? item.lowThreshold ?? 0,
  )
  const criticalThreshold =
    item.critical_threshold != null
      ? Number(item.critical_threshold)
      : item.criticalThreshold != null
        ? Number(item.criticalThreshold)
        : null

  return {
    id: item.id,
    name: item.item_name ?? item.name,
    stock,
    maxStock: maxStock > 0 ? maxStock : 1,
    lowThreshold,
    criticalThreshold,
    unitLabel: item.unit_label ?? item.unitLabel ?? item.unit ?? 'units',
  }
}

export function getInventoryStatus(item) {
  const normalized = normalizeInventoryItem(item)
  if (normalized.stock === 0) return 'Out of Stock'
  if (
    normalized.criticalThreshold != null &&
    normalized.stock <= normalized.criticalThreshold
  ) {
    return 'Very Low Stock'
  }
  if (normalized.lowThreshold > 0 && normalized.stock <= normalized.lowThreshold) {
    return 'Low Stock'
  }
  return 'In Stock'
}

export function getRemainingPercent(item) {
  const normalized = normalizeInventoryItem(item)
  return Math.round((normalized.stock / normalized.maxStock) * 100)
}

export function isLowStockAlert(item) {
  const status = getInventoryStatus(item)
  return status !== 'In Stock'
}

export function buildAlertMessage(item) {
  const normalized = normalizeInventoryItem(item)
  const status = getInventoryStatus(item)
  const percent = getRemainingPercent(item)

  if (status === 'Out of Stock') {
    return `⚠️ Alert: ${normalized.name} is out of stock (0% remaining)`
  }
  if (status === 'Very Low Stock') {
    return `⚠️ Alert: ${normalized.name} is critically low (${percent}% remaining)`
  }
  return `⚠️ Alert: ${normalized.name} is running low (${percent}% remaining)`
}

export function getLowStockAlerts(items) {
  return items
    .filter(isLowStockAlert)
    .map((item) => ({
      id: normalizeInventoryItem(item).id,
      message: buildAlertMessage(item),
      status: getInventoryStatus(item),
      percent: getRemainingPercent(item),
      name: normalizeInventoryItem(item).name,
    }))
    .sort((a, b) => a.percent - b.percent)
}
