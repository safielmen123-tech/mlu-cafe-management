const { STORE } = require('../config/store');
const { fetchExternalSignals } = require('./externalSignals');
const { fetchInventoryForAlerts } = require('./aiPredictions');
const { buildActiveAlerts } = require('./alertEngine');

const BRIEFING_CACHE_TTL_MS = Number.parseInt(process.env.BRIEFING_CACHE_TTL_MS, 10) || 60_000;
const AVG_TICKET_USD = Number.parseFloat(process.env.BRIEFING_AVG_TICKET_USD || '7.5');

let briefingCache = { expiresAt: 0, payload: null };

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHourLabel(hour24) {
  const hour = Number(hour24);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const nextHour = (hour + 1) % 24;
  const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
  const nextHour12 = nextHour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:00 ${period} – ${String(nextHour12).padStart(2, '0')}:00 ${nextPeriod}`;
}

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function weatherEmoji(condition) {
  if (condition === 'rain') return '🌧️';
  if (condition === 'hot') return '☀️';
  return '🌤️';
}

async function fetchRecentDailyRevenue(db, days = 30) {
  const [rows] = await db.execute(
    `
    SELECT
      DATE(updated_at) AS sale_date,
      COALESCE(SUM(total), 0) AS revenue,
      COUNT(*) AS order_count
    FROM orders
    WHERE status = 'Completed'
      AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(updated_at)
    ORDER BY sale_date ASC
    `,
    [days],
  );

  return rows.map((row) => ({
    date: toDateKey(new Date(row.sale_date)),
    revenue: Number(row.revenue) || 0,
    orders: Number(row.order_count) || 0,
  }));
}

async function fetchHourlySalesPattern(db, days = 60) {
  const [rows] = await db.execute(
    `
    SELECT
      HOUR(updated_at) AS hour_of_day,
      COUNT(*) AS orders,
      COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE status = 'Completed'
      AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY HOUR(updated_at)
    ORDER BY orders DESC
    `,
    [days],
  );

  return rows.map((row) => ({
    hour: Number(row.hour_of_day),
    label: formatHourLabel(row.hour_of_day),
    orders: Number(row.orders) || 0,
    revenue: Number(row.revenue) || 0,
  }));
}

function computeTrendFactor(dailyRevenue) {
  if (dailyRevenue.length < 7) return 1.05;
  const recent = dailyRevenue.slice(-7);
  const previous = dailyRevenue.slice(-14, -7);
  const recentAvg = recent.reduce((sum, day) => sum + day.revenue, 0) / recent.length;
  const previousAvg =
    previous.length > 0
      ? previous.reduce((sum, day) => sum + day.revenue, 0) / previous.length
      : recentAvg;
  if (previousAvg <= 0) return 1.05;
  return Math.min(Math.max(recentAvg / previousAvg, 0.85), 1.25);
}

function predictTodaySales(dailyRevenue, externalSignals) {
  const recent = dailyRevenue.slice(-14);
  const baseAvg =
    recent.length > 0
      ? recent.reduce((sum, day) => sum + day.revenue, 0) / recent.length
      : 0;
  const orderAvg =
    recent.length > 0
      ? recent.reduce((sum, day) => sum + day.orders, 0) / recent.length
      : 0;

  const today = new Date();
  const weekendBoost = [0, 6].includes(today.getDay()) ? 1.1 : 1;
  const trendFactor = computeTrendFactor(dailyRevenue);
  const revenueMultiplier = externalSignals?.modifiers?.revenueMultiplier || 1;

  const projectedRevenue = roundMoney(baseAvg * trendFactor * weekendBoost * revenueMultiplier);
  const projectedOrders = Math.max(
    1,
    Math.round(orderAvg * trendFactor * weekendBoost * revenueMultiplier) ||
      Math.round(projectedRevenue / Math.max(AVG_TICKET_USD, 1)),
  );

  return {
    projectedRevenue,
    projectedOrders,
    baselineDailyAverage: roundMoney(baseAvg),
    trendFactor: roundMoney(trendFactor),
    revenueMultiplier,
  };
}

function buildPeakTimeRange(hourlySales) {
  if (!hourlySales.length) {
    return {
      peakTimeRange: '07:00 AM – 12:00 PM',
      peakHours: [
        { hour: 7, label: formatHourLabel(7), orders: 0, confidence: 'sample' },
        { hour: 12, label: formatHourLabel(12), orders: 0, confidence: 'sample' },
      ],
      primaryPeakLabel: formatHourLabel(7),
    };
  }

  const top = [...hourlySales].sort((a, b) => b.orders - a.orders).slice(0, 3);
  const hours = top.map((entry) => entry.hour).sort((a, b) => a - b);
  const start = hours[0];
  const end = hours[hours.length - 1];

  const startPeriod = start >= 12 ? 'PM' : 'AM';
  const endNext = (end + 1) % 24;
  const endPeriod = endNext >= 12 ? 'PM' : 'AM';
  const start12 = start % 12 || 12;
  const end12 = endNext % 12 || 12;

  const peakTimeRange =
    hours.length === 1
      ? top[0].label
      : `${String(start12).padStart(2, '0')}:00 ${startPeriod} – ${String(end12).padStart(2, '0')}:00 ${endPeriod}`;

  return {
    peakTimeRange,
    peakHours: top.map((entry) => ({
      hour: entry.hour,
      label: entry.label,
      orders: entry.orders,
      revenue: entry.revenue,
      confidence: entry.orders >= (top[0]?.orders || 1) * 0.6 ? 'high' : 'moderate',
    })),
    primaryPeakLabel: top[0].label,
  };
}

function estimateVisitorCount(projectedOrders, calendar) {
  const touristBoost = Number(calendar?.touristBoostPercent || 0);
  // Footfall index: baseline 100 + seasonal tourist boost points
  const touristFootfallIndex = Math.round(100 + touristBoost);
  // Visitors ≈ orders with a small party-size factor for dine-in mix
  const partyFactor = 1.35;
  const estimatedVisitors = Math.max(
    1,
    Math.round(projectedOrders * partyFactor * (1 + touristBoost / 200)),
  );

  return {
    estimatedVisitors,
    touristFootfallIndex,
    touristBoostPercent: touristBoost,
    seasonLabel: calendar?.seasonLabel || 'Seasonal baseline',
    isHighTourismMonth: Boolean(calendar?.isHighTourismMonth),
  };
}

function buildFocusItems({
  inventory,
  externalSignals,
  peak,
  sales,
  alerts,
}) {
  const items = [];
  const weather = externalSignals?.weather;
  const calendar = externalSignals?.calendar;
  const fx = externalSignals?.fx;

  const criticalStock = inventory
    .filter((item) => item.status === 'Out of Stock' || item.status === 'Very Low Stock')
    .slice(0, 2);

  for (const item of criticalStock) {
    items.push({
      id: `stock-${item.id}`,
      type: 'stock',
      priority: item.status === 'Out of Stock' ? 'critical' : 'high',
      title: `Restock ${item.itemName}`,
      detail: `${item.itemName} is ${item.status.toLowerCase()} (${item.stock} ${item.unitLabel}).`,
      checked: false,
    });
  }

  if (weather?.condition === 'rain' || (weather?.rainProbability ?? 0) >= 55) {
    items.push({
      id: 'prep-rain',
      type: 'prep',
      priority: 'high',
      title: 'Prep cold drinks & takeout packaging',
      detail: `Rain likely (${weather.rainProbability ?? 0}%) — iced menu and delivery handoff usually rise.`,
      checked: false,
    });
  } else if (weather?.condition === 'hot') {
    items.push({
      id: 'prep-hot',
      type: 'prep',
      priority: 'medium',
      title: 'Chill iced coffee & smoothie stock',
      detail: `Hot day (${weather.temperatureC}°C) — boost cold beverage prep before the tourist morning rush.`,
      checked: false,
    });
  }

  if (peak?.primaryPeakLabel) {
    items.push({
      id: 'staff-peak',
      type: 'staffing',
      priority: 'high',
      title: `Staff for ${peak.primaryPeakLabel}`,
      detail: `Peak order window projected around ${peak.peakTimeRange}. Add barista coverage for tourist coffee + midday food.`,
      checked: false,
    });
  }

  if (calendar?.isHighTourismMonth || (calendar?.touristBoostPercent ?? 0) >= 10) {
    items.push({
      id: 'tourism-buffer',
      type: 'operations',
      priority: 'medium',
      title: 'Raise coffee & dairy reorder buffers',
      detail: `${calendar.seasonLabel}: +${calendar.touristBoostPercent}% footfall index for ${STORE.location}.`,
      checked: false,
    });
  }

  if (fx?.inflationRisk) {
    items.push({
      id: 'pricing-fx',
      type: 'pricing',
      priority: 'medium',
      title: 'Review supplier costs / menu margins',
      detail: `USD/KHR moved ${fx.volatilityPercent}% from baseline — check coffee and dairy landed costs.`,
      checked: false,
    });
  }

  // Prefer live alert actions when present
  for (const alert of (alerts || []).slice(0, 4)) {
    if (items.some((item) => item.title === alert.title)) continue;
    items.push({
      id: `alert-${alert.id}`,
      type: alert.category,
      priority: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'high' : 'medium',
      title: alert.action?.label || alert.title,
      detail: alert.message,
      checked: false,
    });
  }

  if (items.length < 3 && sales.projectedRevenue > 0) {
    items.push({
      id: 'ops-focus',
      type: 'operations',
      priority: 'low',
      title: 'Protect projected daily revenue',
      detail: `Target ~$${sales.projectedRevenue.toFixed(2)} today — keep peak windows fully staffed and menu items available.`,
      checked: false,
    });
  }

  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  return items
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 3)
    .map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

async function buildDailyBriefing(db, { bypassCache = false, displayName } = {}) {
  const now = Date.now();
  if (!bypassCache && briefingCache.payload && briefingCache.expiresAt > now) {
    const cached = briefingCache.payload;
    if (displayName && cached.greeting) {
      return {
        ...cached,
        greeting: {
          ...cached.greeting,
          headline: `${cached.greeting.salutation}, ${displayName}`,
        },
      };
    }
    return cached;
  }

  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const hour = today.getHours();
  const dateKey = toDateKey(today);

  const [dailyRevenue, hourlySales, inventory, externalSignals, alertPayload] = await Promise.all([
    fetchRecentDailyRevenue(db, 45),
    fetchHourlySalesPattern(db, 60),
    fetchInventoryForAlerts(db),
    fetchExternalSignals(month, year),
    buildActiveAlerts(db, { bypassCache }),
  ]);

  const sales = predictTodaySales(dailyRevenue, externalSignals);
  const peak = buildPeakTimeRange(hourlySales);
  const visitors = estimateVisitorCount(sales.projectedOrders, externalSignals.calendar);
  const weather = externalSignals.weather || {};
  const salutation = greetingForHour(hour);
  const managerName = displayName || 'Manager';

  const focusItems = buildFocusItems({
    inventory,
    externalSignals,
    peak,
    sales,
    alerts: alertPayload?.alerts || [],
  });

  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    store: {
      officialName: STORE.officialName,
      location: STORE.location,
    },
    greeting: {
      salutation,
      headline: `${salutation}, ${managerName}`,
      dateLabel,
      dateKey,
    },
    weather: {
      city: weather.city || STORE.weather.city,
      condition: weather.condition || 'clear',
      label: weather.label || 'Seasonal pattern',
      temperatureC: weather.temperatureC ?? null,
      rainProbability: weather.rainProbability ?? 0,
      badge: `${weatherEmoji(weather.condition)} ${weather.city || STORE.weather.city} · ${
        weather.temperatureC != null ? `${weather.temperatureC}°C` : weather.label || 'Siem Reap'
      }`,
      source: weather.source || 'seasonal-fallback',
    },
    kpis: {
      projectedRevenue: sales.projectedRevenue,
      projectedOrders: sales.projectedOrders,
      estimatedVisitors: visitors.estimatedVisitors,
      touristFootfallIndex: visitors.touristFootfallIndex,
      touristBoostPercent: visitors.touristBoostPercent,
      seasonLabel: visitors.seasonLabel,
      peakTimeRange: peak.peakTimeRange,
      primaryPeakLabel: peak.primaryPeakLabel,
    },
    peakHours: peak.peakHours,
    focusItems,
    market: {
      fx: externalSignals.fx
        ? {
            usdToKhr: externalSignals.fx.usdToKhr,
            volatilityPercent: externalSignals.fx.volatilityPercent,
            inflationRisk: externalSignals.fx.inflationRisk,
          }
        : null,
      calendar: {
        seasonLabel: visitors.seasonLabel,
        touristBoostPercent: visitors.touristBoostPercent,
        isHighTourismMonth: visitors.isHighTourismMonth,
        holidays: externalSignals.calendar?.holidays || [],
      },
    },
    meta: {
      baselineDailyAverage: sales.baselineDailyAverage,
      trendFactor: sales.trendFactor,
      revenueMultiplier: sales.revenueMultiplier,
      hasSalesHistory: dailyRevenue.length > 0,
      domainContext: STORE.domainContext,
    },
  };

  briefingCache = { expiresAt: now + BRIEFING_CACHE_TTL_MS, payload };
  return payload;
}

function clearDailyBriefingCache() {
  briefingCache = { expiresAt: 0, payload: null };
}

module.exports = {
  buildDailyBriefing,
  clearDailyBriefingCache,
};
