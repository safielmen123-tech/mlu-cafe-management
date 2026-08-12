const { STORE } = require('../config/store');
const { fetchExternalSignals } = require('./externalSignals');
const {
  buildInventoryAiInsights,
  fetchInventoryForAlerts,
} = require('./aiPredictions');

const MARGIN_COST_INCREASE_THRESHOLD_PCT = Number.parseFloat(
  process.env.MARGIN_ALERT_THRESHOLD_PCT || '2.5',
);

/** Estimated supplier cost baselines (USD) for margin pressure alerts. */
const RAW_MATERIAL_COST_WATCHLIST = [
  {
    key: 'coffee',
    name: 'Coffee Beans',
    baselineUsd: 8.5,
    sensitivity: 1.25,
    match: /coffee/i,
  },
  {
    key: 'dairy',
    name: 'Whole Milk / Dairy',
    baselineUsd: 3.2,
    sensitivity: 1.1,
    match: /milk|dairy/i,
  },
  {
    key: 'sugar',
    name: 'Sugar & Sweeteners',
    baselineUsd: 1.4,
    sensitivity: 0.9,
    match: /sugar/i,
  },
  {
    key: 'packaging',
    name: 'Paper Cups & Packaging',
    baselineUsd: 2.1,
    sensitivity: 0.85,
    match: /cup|packag|box/i,
  },
];

const CACHE_TTL_MS = Number.parseInt(process.env.ALERTS_CACHE_TTL_MS, 10) || 20_000;
let alertsCache = { expiresAt: 0, payload: null };

function severityRank(severity) {
  return { critical: 0, warning: 1, ai_suggestion: 2 }[severity] ?? 9;
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

function buildStockAlerts(inventory, demandInsights = []) {
  const alerts = [];
  const demandById = new Map((demandInsights || []).map((row) => [row.id, row]));

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
    const demand = demandById.get(item.id);

    const atOrBelowReorder =
      reorderPoint > 0 && stock <= reorderPoint;
    const statusFlag = item.stock_status || item.stockStatus;
    const flaggedLowStock = statusFlag === 'LOW_STOCK' || statusFlag === 'OUT_OF_STOCK';
    const criticallyLow =
      stock === 0 || (criticalPoint != null && stock <= criticalPoint);
    const demandExceedsStock =
      demand &&
      (demand.projectedStockRemaining <= 0 ||
        (demand.projectedUsage14Day > 0 && demand.projectedUsage14Day > stock));

    if (!atOrBelowReorder && !criticallyLow && !demandExceedsStock && !flaggedLowStock) continue;

    const severity = criticallyLow || stock === 0 ? 'critical' : 'warning';
    let message;
    if (stock === 0) {
      message = `${name} is out of stock (0 ${unit} remaining).`;
    } else if (demandExceedsStock) {
      message = `${name}: predicted demand (${demand.projectedUsage14Day} ${unit} / 14d) exceeds current stock (${stock} ${unit}).`;
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
          predictedDemand: demand?.projectedUsage14Day ?? null,
        },
      }),
    );
  }

  return alerts;
}

function buildAiSuggestionAlerts(externalSignals) {
  const alerts = [];
  if (!externalSignals) return alerts;

  const { weather, calendar, fx, modifiers } = externalSignals;
  const location = STORE.location;

  if (weather?.condition === 'rain' || (weather?.rainProbability ?? 0) >= 55) {
    alerts.push(
      makeAlert({
        id: 'ai-weather-rain',
        category: 'ai_suggestion',
        severity: 'ai_suggestion',
        title: 'Rain boost: cold drinks & delivery',
        message: `${weather.label || 'Wet weather'} in ${weather.city || location} (${weather.rainProbability ?? 0}% rain). Expect higher takeout/delivery and iced drink demand.`,
        actionLabel: 'Prep cold drinks & takeout packaging',
        navigateTo: 'inventory',
        meta: {
          rainProbability: weather.rainProbability,
          takeoutBoostPercent: Math.round((modifiers?.takeoutRatioBoost || 0) * 100),
        },
      }),
    );
  } else if (weather?.condition === 'hot') {
    alerts.push(
      makeAlert({
        id: 'ai-weather-hot',
        category: 'ai_suggestion',
        severity: 'ai_suggestion',
        title: 'Heat wave: iced menu uplift',
        message: `Elevated temperatures (${weather.temperatureC}°C) in ${weather.city || location}. Stock iced coffee, smoothies, and cold dairy.`,
        actionLabel: 'Adjust iced drink stock targets',
        navigateTo: 'inventory',
        meta: { temperatureC: weather.temperatureC },
      }),
    );
  }

  if (calendar?.isHighTourismMonth || (calendar?.touristBoostPercent ?? 0) >= 10) {
    alerts.push(
      makeAlert({
        id: 'ai-tourism-surge',
        category: 'ai_suggestion',
        severity: 'ai_suggestion',
        title: `Tourist surge: ${calendar.seasonLabel || 'Peak season'}`,
        message: `+${calendar.touristBoostPercent}% visitor boost expected for ${STORE.officialName}. Early-morning coffee and midday food orders typically spike.`,
        actionLabel: 'Adjust Stock Target',
        navigateTo: 'inventory',
        meta: {
          touristBoostPercent: calendar.touristBoostPercent,
          holidays: calendar.holidays || [],
        },
      }),
    );
  }

  const holidays = calendar?.holidays || [];
  if (holidays.length > 0) {
    const names = holidays.map((h) => h.name).join(', ');
    const holidayKey = holidays.map((h) => `${h.month}-${h.day}`).join('_');
    alerts.push(
      makeAlert({
        id: `ai-holiday-${holidayKey}`,
        category: 'ai_suggestion',
        severity: 'ai_suggestion',
        title: 'Upcoming holiday / festival demand',
        message: `${names} falls in the target window — prep coffee beans, dairy, and bakery for tourist & local mix in ${location}.`,
        actionLabel: 'Open AI Prediction plan',
        navigateTo: 'reports_prediction',
        meta: { holidays },
      }),
    );
  }

  if (fx?.inflationRisk || (fx?.volatilityPercent ?? 0) >= Number(process.env.USD_KHR_VOLATILITY_THRESHOLD || 2.5)) {
    alerts.push(
      makeAlert({
        id: 'ai-fx-variance',
        category: 'ai_suggestion',
        severity: 'ai_suggestion',
        title: 'USD/KHR exchange rate variance',
        message: `USD/KHR at ${fx.usdToKhr?.toLocaleString?.() ?? fx.usdToKhr} (${fx.volatilityPercent}% vs baseline). Import costs may shift for coffee and dairy.`,
        actionLabel: 'Review FX impact on costs',
        navigateTo: 'reports_prediction',
        meta: {
          usdToKhr: fx.usdToKhr,
          volatilityPercent: fx.volatilityPercent,
        },
      }),
    );
  }

  return alerts;
}

function buildMarginAlerts(externalSignals, inventory = []) {
  const alerts = [];
  if (!externalSignals?.fx) return alerts;

  const volatility = Number(externalSignals.fx.volatilityPercent || 0);
  if (volatility < MARGIN_COST_INCREASE_THRESHOLD_PCT) return alerts;

  for (const material of RAW_MATERIAL_COST_WATCHLIST) {
    const estimatedIncreasePct = Math.round(volatility * material.sensitivity * 10) / 10;
    if (estimatedIncreasePct < MARGIN_COST_INCREASE_THRESHOLD_PCT) continue;

    const relatedStock = inventory.find((item) =>
      material.match.test(item.itemName || item.item_name || ''),
    );
    const estimatedNewCost =
      Math.round(material.baselineUsd * (1 + estimatedIncreasePct / 100) * 100) / 100;

    alerts.push(
      makeAlert({
        id: `margin-${material.key}`,
        category: 'margin',
        severity: estimatedIncreasePct >= MARGIN_COST_INCREASE_THRESHOLD_PCT * 1.5
          ? 'critical'
          : 'warning',
        title: `Margin pressure: ${material.name}`,
        message: `Estimated raw material cost up ~${estimatedIncreasePct}% (≈$${estimatedNewCost} vs $${material.baselineUsd} baseline) due to FX movement${
          relatedStock ? ` — linked to ${relatedStock.itemName || relatedStock.item_name}` : ''
        }.`,
        actionLabel: `Review ${material.name} supplier pricing`,
        navigateTo: 'inventory',
        meta: {
          materialKey: material.key,
          estimatedIncreasePct,
          baselineUsd: material.baselineUsd,
          estimatedNewCost,
          inventoryId: relatedStock?.id ?? null,
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
    ai_suggestion: 0,
    stock: 0,
    ai_suggestion_category: 0,
    margin: 0,
  };

  for (const alert of alerts) {
    if (alert.severity === 'critical') counts.critical += 1;
    else if (alert.severity === 'warning') counts.warning += 1;
    else if (alert.severity === 'ai_suggestion') counts.ai_suggestion += 1;

    if (alert.category === 'stock') counts.stock += 1;
    else if (alert.category === 'ai_suggestion') counts.ai_suggestion_category += 1;
    else if (alert.category === 'margin') counts.margin += 1;
  }

  return counts;
}

async function collectDemandInsights(db) {
  try {
    const insights = await buildInventoryAiInsights(db, {});
    return insights.items || [];
  } catch (error) {
    console.warn('⚠️ Alert demand insights unavailable:', error.message);
    return [];
  }
}

async function buildActiveAlerts(db, { bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && alertsCache.payload && alertsCache.expiresAt > now) {
    return alertsCache.payload;
  }

  const targetMonth = new Date().getMonth() + 1;
  const targetYear = new Date().getFullYear();

  const [inventory, externalSignals, demandInsights] = await Promise.all([
    typeof fetchInventoryForAlerts === 'function'
      ? fetchInventoryForAlerts(db)
      : Promise.resolve([]),
    fetchExternalSignals(targetMonth, targetYear),
    collectDemandInsights(db),
  ]);

  const alerts = [
    ...buildStockAlerts(inventory, demandInsights),
    ...buildAiSuggestionAlerts(externalSignals),
    ...buildMarginAlerts(externalSignals, inventory),
  ].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const payload = {
    generatedAt: nowIso(),
    store: {
      officialName: STORE.officialName,
      location: STORE.location,
    },
    counts: summarize(alerts),
    alerts,
    signals: {
      weather: externalSignals?.weather
        ? {
            condition: externalSignals.weather.condition,
            label: externalSignals.weather.label,
            city: externalSignals.weather.city,
            rainProbability: externalSignals.weather.rainProbability,
          }
        : null,
      fx: externalSignals?.fx
        ? {
            usdToKhr: externalSignals.fx.usdToKhr,
            volatilityPercent: externalSignals.fx.volatilityPercent,
            inflationRisk: externalSignals.fx.inflationRisk,
          }
        : null,
      calendar: externalSignals?.calendar
        ? {
            seasonLabel: externalSignals.calendar.seasonLabel,
            touristBoostPercent: externalSignals.calendar.touristBoostPercent,
            isHighTourismMonth: externalSignals.calendar.isHighTourismMonth,
          }
        : null,
    },
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
  buildAiSuggestionAlerts,
  buildMarginAlerts,
  MARGIN_COST_INCREASE_THRESHOLD_PCT,
};
