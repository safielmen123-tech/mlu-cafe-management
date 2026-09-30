const { STORE } = require('../config/store');

const CACHE_TTL_MS = Number.parseInt(process.env.ALERTS_CACHE_TTL_MS, 10) || 20_000;
let alertsCache = { expiresAt: 0, payload: null };

function severityRank(severity) {
  return { critical: 0, warning: 1, info: 2 }[severity] ?? 9;
}

function nowIso() {
  return new Date().toISOString();
}

function makeAlert({
  id,
  category,
  severity,
  title,
  message,
  actionLabel,
  navigateTo,
  meta = {},
}) {
  return {
    id,
    category,
    severity,
    title,
    message,
    timestamp: nowIso(),
    action: {
      label: actionLabel,
      navigateTo,
    },
    meta,
  };
}

async function fetchInventoryForAlerts(db) {
  const [rows] = await db.execute(
    `
    SELECT
      id,
      item_name,
      category,
      stock_quantity,
      stock_status,
      max_stock,
      low_threshold,
      critical_threshold,
      unit_label
    FROM inventory
    ORDER BY item_name ASC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    itemName: row.item_name,
    item_name: row.item_name,
    category: row.category,
    stock: Number(row.stock_quantity ?? 0),
    stock_quantity: Number(row.stock_quantity ?? 0),
    stock_status: row.stock_status,
    stockStatus: row.stock_status,
    lowThreshold: Number(row.low_threshold ?? 0),
    low_threshold: Number(row.low_threshold ?? 0),
    criticalThreshold: row.critical_threshold != null ? Number(row.critical_threshold) : null,
    critical_threshold: row.critical_threshold != null ? Number(row.critical_threshold) : null,
    unitLabel: row.unit_label || 'units',
    unit_label: row.unit_label || 'units',
  }));
}

function buildStockAlerts(inventory) {
  const alerts = [];

  for (const item of inventory) {
    const stock = Number(item.stock ?? item.stock_quantity ?? 0);
    const reorderPoint = Number(item.lowThreshold ?? item.low_threshold ?? 0);
    const criticalPoint =
      item.criticalThreshold != null
        ? Number(item.criticalThreshold)
        : item.critical_threshold != null
          ? Number(item.critical_threshold)
          : null;
    const name = item.itemName || item.item_name;
    const unit = item.unitLabel || item.unit_label || item.unit || 'units';

    const atOrBelowReorder = reorderPoint > 0 && stock <= reorderPoint;
    const statusFlag = item.stock_status || item.stockStatus;
    const flaggedLowStock = statusFlag === 'LOW_STOCK' || statusFlag === 'OUT_OF_STOCK';
    const criticallyLow = stock <= 0 || (criticalPoint != null && stock <= criticalPoint);

    if (!atOrBelowReorder && !criticallyLow && !flaggedLowStock) continue;

    const severity = criticallyLow || stock <= 0 ? 'critical' : 'warning';
    let message;
    if (stock <= 0) {
      message = `${name} is out of stock (${stock} ${unit} on hand).`;
    } else {
      message = `${name} is at ${stock} ${unit} — at or below reorder point (${reorderPoint} ${unit}).`;
    }

    alerts.push(
      makeAlert({
        id: `stock-${item.id}`,
        category: 'stock',
        severity,
        title: severity === 'critical' ? `Critical stock: ${name}` : `Low stock: ${name}`,
        message,
        actionLabel: `Add ${name} to Purchase Order`,
        navigateTo: 'inventory',
        meta: {
          inventoryId: item.id,
          stock,
          reorderPoint,
        },
      }),
    );
  }

  return alerts;
}

function summarize(alerts) {
  const counts = {
    total: alerts.length,
    critical: 0,
    warning: 0,
    info: 0,
    stock: 0,
    reservation: 0,
  };

  for (const alert of alerts) {
    if (alert.severity === 'critical') counts.critical += 1;
    else if (alert.severity === 'warning') counts.warning += 1;
    else if (alert.severity === 'info') counts.info += 1;

    if (alert.category === 'stock') counts.stock += 1;
    else if (alert.category === 'reservation') counts.reservation += 1;
  }

  return counts;
}

async function buildActiveAlerts(db, { bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && alertsCache.payload && alertsCache.expiresAt > now) {
    return alertsCache.payload;
  }

  const inventory = await fetchInventoryForAlerts(db);
  const alerts = buildStockAlerts(inventory).sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  const payload = {
    generatedAt: nowIso(),
    store: {
      officialName: STORE.officialName,
      location: STORE.location,
    },
    counts: summarize(alerts),
    alerts,
  };

  alertsCache = { expiresAt: now + CACHE_TTL_MS, payload };
  return payload;
}

function clearAlertsCache() {
  alertsCache = { expiresAt: 0, payload: null };
}

module.exports = {
  buildActiveAlerts,
  clearAlertsCache,
  buildStockAlerts,
};
