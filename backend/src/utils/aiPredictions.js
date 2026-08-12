const path = require('path');
const { spawn } = require('child_process');
const { env } = require('../config/env');
const {
    attachInventoryAiToPredictionPayload,
    computeInventoryAiRecommendations,
    mergeInventoryAiFlags,
} = require('./inventoryAiLinkage');
const {
    fetchExternalSignals,
    applyMacroAdjustmentsToPayload,
} = require('./externalSignals');

const ALLOWED_DAY_RANGES = [30, 60, 90, 365];
const DEFAULT_ANALYSIS_DAYS = 365;
const FORECASTABLE_PERIODS = [
    { month: 8, year: 2026, label: 'August 2026' },
    { month: 9, year: 2026, label: 'September 2026' },
    { month: 10, year: 2026, label: 'October 2026' },
    { month: 11, year: 2026, label: 'November 2026' },
    { month: 12, year: 2026, label: 'December 2026' },
    { month: 1, year: 2027, label: 'January 2027' },
    { month: 2, year: 2027, label: 'February 2027' },
    { month: 3, year: 2027, label: 'March 2027' },
];
const PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'predict.py');
const PYTHON_COMMAND = process.env.PYTHON_PATH || env.pythonPath || 'python';
const PYTHON_TIMEOUT_MS = Number.parseInt(process.env.PYTHON_ML_TIMEOUT_MS, 10) || 30000;

function parseDaysParam(rawDays) {
    const parsed = Number.parseInt(rawDays, 10);
    return ALLOWED_DAY_RANGES.includes(parsed) ? parsed : DEFAULT_ANALYSIS_DAYS;
}

function parseTargetPeriod(rawMonth, rawYear) {
    const month = Number.parseInt(rawMonth, 10);
    const year = Number.parseInt(rawYear, 10);

    const matched = FORECASTABLE_PERIODS.find(
        (period) => period.month === month && period.year === year,
    );
    if (matched) return matched;

    const fallback = FORECASTABLE_PERIODS[0];
    return fallback;
}

function monthLabel(year, month) {
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });
}

function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function seasonalMultiplier(month) {
    if ([11, 12, 1, 2].includes(month)) return 1.35;
    if ([3, 4, 5].includes(month)) return month === 4 ? 1.28 : 1.18;
    return 1.0;
}

function roundMoney(value) {
    return Math.round(Number(value) * 100) / 100;
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

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function toDateKey(date) {
    return date.toISOString().slice(0, 10);
}

function toDayLabel(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchDailyRevenue(db, days) {
    const [rows] = await db.execute(
        `
        SELECT
            DATE(updated_at) AS sale_date,
            COUNT(*) AS orders,
            COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE status = 'Completed'
          AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(updated_at)
        ORDER BY sale_date ASC
        `,
        [days],
    );

    return rows.map((row) => ({
        date: row.sale_date instanceof Date ? toDateKey(row.sale_date) : String(row.sale_date),
        orders: Number(row.orders),
        revenue: roundMoney(row.revenue),
    }));
}

async function fetchHourlySales(db, days) {
    const [rows] = await db.execute(
        `
        SELECT
            HOUR(updated_at) AS hour,
            COUNT(*) AS orders,
            COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE status = 'Completed'
          AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY HOUR(updated_at)
        ORDER BY hour ASC
        `,
        [days],
    );

    return rows.map((row) => ({
        hour: Number(row.hour),
        label: formatHourLabel(row.hour),
        orders: Number(row.orders),
        revenue: roundMoney(row.revenue),
    }));
}

async function fetchTopItems(db, days, limit = 8) {
    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
    const [rows] = await db.execute(
        `
        SELECT
            m.name,
            m.category,
            SUM(oi.quantity) AS units_sold,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS line_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN menu_items m ON m.id = oi.menu_item_id
        WHERE o.status = 'Completed'
          AND o.updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY m.id, m.name, m.category
        ORDER BY units_sold DESC
        LIMIT ${safeLimit}
        `,
        [days],
    );

    return rows.map((row) => ({
        name: row.name,
        category: row.category,
        unitsSold: Number(row.units_sold),
        revenue: roundMoney(row.line_revenue),
    }));
}

async function fetchCategorySalesByMonth(db, days) {
    const [rows] = await db.execute(
        `
        SELECT
            month_key,
            category,
            SUM(units_sold) AS units_sold,
            SUM(revenue) AS revenue
        FROM (
            SELECT
                DATE_FORMAT(o.updated_at, '%Y-%m') AS month_key,
                CASE
                    WHEN m.name LIKE '%Smoothie%' THEN 'Smoothie'
                    WHEN m.name LIKE 'Iced%' THEN 'Iced Coffee'
                    WHEN m.name LIKE '%Iced%' THEN 'Iced Tea'
                    WHEN m.name LIKE '%Tea%' THEN 'Hot Tea'
                    WHEN m.category = 'Bakery' THEN 'Bakery'
                    ELSE 'Hot Coffee'
                END AS category,
                oi.quantity AS units_sold,
                (oi.quantity * oi.price) AS revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN menu_items m ON m.id = oi.menu_item_id
            WHERE o.status = 'Completed'
              AND o.updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ) AS category_rows
        GROUP BY month_key, category
        ORDER BY month_key ASC, units_sold DESC
        `,
        [days],
    );

    return rows.map((row) => ({
        monthKey: row.month_key,
        category: row.category,
        unitsSold: Number(row.units_sold),
        revenue: roundMoney(row.revenue),
    }));
}

async function fetchInventorySnapshot(db) {
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

    return rows.map((row) => {
        const stock = Number(row.stock_quantity ?? 0);
        const maxStock = Number(row.max_stock ?? 1) || 1;
        const lowThreshold = Number(row.low_threshold ?? 0);
        const criticalThreshold =
            row.critical_threshold != null ? Number(row.critical_threshold) : null;
        const percentRemaining = Math.round((stock / maxStock) * 100);

        let status = 'In Stock';
        if (stock === 0) status = 'Out of Stock';
        else if (criticalThreshold != null && stock <= criticalThreshold) status = 'Very Low Stock';
        else if (lowThreshold > 0 && stock <= lowThreshold) status = 'Low Stock';

        return {
            id: row.id,
            itemName: row.item_name,
            category: row.category,
            stock,
            maxStock,
            lowThreshold,
            criticalThreshold,
            unitLabel: row.unit_label || 'units',
            percentRemaining,
            status,
        };
    });
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
    const rawFactor = recentAvg / previousAvg;
    return Math.min(Math.max(rawFactor, 0.85), 1.25);
}

function buildDailyForecast(dailyRevenue, daysAhead = 7) {
    const recentWindow = dailyRevenue.slice(-14);
    const baseAvg =
        recentWindow.length > 0
            ? recentWindow.reduce((sum, day) => sum + day.revenue, 0) / recentWindow.length
            : 0;

    const trendFactor = computeTrendFactor(dailyRevenue);
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const forecast = [];
    for (let offset = 1; offset <= daysAhead; offset += 1) {
        const date = addDays(today, offset);
        const dateKey = toDateKey(date);
        const weekdayBoost = [0, 6].includes(date.getDay()) ? 1.08 : 1;
        const predictedRevenue = roundMoney(baseAvg * trendFactor * weekdayBoost);

        forecast.push({
            date: dateKey,
            dayLabel: toDayLabel(dateKey),
            predictedRevenue,
        });
    }

    return { forecast, trendFactor, baseAvg: roundMoney(baseAvg) };
}

function buildTargetMonthForecast(dailyRevenue, targetYear, targetMonth) {
    const recentWindow = dailyRevenue.slice(-30);
    const baseAvg =
        recentWindow.length > 0
            ? recentWindow.reduce((sum, day) => sum + day.revenue, 0) / recentWindow.length
            : 0;

    const sameMonthDays = dailyRevenue.filter((day) => {
        const parsed = new Date(`${day.date}T12:00:00`);
        return parsed.getMonth() + 1 === targetMonth;
    });
    const seasonalBase =
        sameMonthDays.length > 0
            ? sameMonthDays.reduce((sum, day) => sum + day.revenue, 0) / sameMonthDays.length
            : baseAvg;

    const trendFactor = computeTrendFactor(dailyRevenue);
    const monthFactor = seasonalMultiplier(targetMonth);
    const totalDays = daysInMonth(targetYear, targetMonth);
    const forecast = [];

    for (let dayNum = 1; dayNum <= totalDays; dayNum += 1) {
        const date = new Date(targetYear, targetMonth - 1, dayNum, 12, 0, 0, 0);
        const dateKey = toDateKey(date);
        const weekendBoost = [0, 6].includes(date.getDay()) ? 1.1 : 1;
        const predictedRevenue = roundMoney(seasonalBase * trendFactor * monthFactor * weekendBoost);
        const predictedOrders = Math.max(1, Math.round(predictedRevenue / Math.max(seasonalBase / 3, 8)));

        forecast.push({
            date: dateKey,
            dayLabel: toDayLabel(dateKey),
            predictedRevenue,
            predictedOrders,
        });
    }

    return {
        forecast,
        trendFactor,
        baseAvg: roundMoney(seasonalBase || baseAvg),
    };
}

function buildCategoryForecast(categorySales, targetMonth, targetYear, predictedMonthRevenue, predictedMonthOrders) {
    if (!categorySales.length) return [];

    const sameMonthRows = categorySales.filter((row) => Number(row.monthKey.split('-')[1]) === targetMonth);
    const sourceRows = sameMonthRows.length ? sameMonthRows : categorySales;

    const grouped = sourceRows.reduce((acc, row) => {
        if (!acc[row.category]) {
            acc[row.category] = { category: row.category, unitsSold: 0, revenue: 0 };
        }
        acc[row.category].unitsSold += row.unitsSold;
        acc[row.category].revenue += row.revenue;
        return acc;
    }, {});

    const categories = Object.values(grouped);
    const historicalRevenue = categories.reduce((sum, row) => sum + row.revenue, 0) || 1;
    const historicalUnits = categories.reduce((sum, row) => sum + row.unitsSold, 0) || 1;
    const revenueScale = predictedMonthRevenue / historicalRevenue;
    const unitScale = predictedMonthOrders / historicalUnits;

    return categories
        .map((row) => ({
            category: row.category,
            predictedUnits: Math.round(row.unitsSold * unitScale),
            predictedRevenue: roundMoney(row.revenue * revenueScale),
            sharePercent: roundMoney(((row.revenue * revenueScale) / Math.max(predictedMonthRevenue, 1)) * 100),
        }))
        .sort((a, b) => b.predictedUnits - a.predictedUnits);
}

function buildStockRequirements(topCategories, inventory, topItems) {
    const categoryUnits = Object.fromEntries(
        topCategories.slice(0, 6).map((row) => [row.category, row.predictedUnits]),
    );

    return inventory
        .map((stockItem) => {
            let predictedDemand = categoryUnits[stockItem.category] || 0;
            if (!predictedDemand) {
                const relatedItem = topItems.find((item) => item.category === stockItem.category);
                predictedDemand = relatedItem ? Math.round(relatedItem.unitsSold / 12) : 0;
            }

            const bufferUnits = Math.max(10, Math.round(predictedDemand * 0.15));
            const requiredUnits = predictedDemand + bufferUnits;
            const reorderQty = Math.max(0, Math.round(requiredUnits - stockItem.stock));

            let urgency = 'low';
            if (reorderQty > 0 && stockItem.status !== 'In Stock') {
                urgency = stockItem.status === 'Out of Stock' ? 'critical' : 'high';
            } else if (reorderQty > requiredUnits * 0.25) {
                urgency = 'medium';
            }

            if (reorderQty <= 0 && stockItem.status === 'In Stock') return null;

            return {
                itemName: stockItem.itemName,
                category: stockItem.category,
                requiredUnits: Math.round(requiredUnits),
                currentStock: Math.round(stockItem.stock),
                reorderQty,
                urgency,
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            const rank = { critical: 0, high: 1, medium: 2, low: 3 };
            return rank[a.urgency] - rank[b.urgency];
        })
        .slice(0, 8);
}

function buildPeakHours(hourlySales) {
    if (!hourlySales.length) {
        return [
            { hour: 12, label: '12:00 PM – 01:00 PM', orders: 0, confidence: 'sample' },
            { hour: 17, label: '05:00 PM – 06:00 PM', orders: 0, confidence: 'sample' },
        ];
    }

    const maxOrders = Math.max(...hourlySales.map((entry) => entry.orders), 1);

    return [...hourlySales]
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 3)
        .map((entry) => ({
            hour: entry.hour,
            label: entry.label,
            orders: entry.orders,
            revenue: entry.revenue,
            confidence: entry.orders / maxOrders >= 0.6 ? 'high' : 'moderate',
        }));
}

function buildInventoryWarnings(inventory, topItems) {
    const topItemNames = new Set(topItems.slice(0, 5).map((item) => item.name.toLowerCase()));

    return inventory
        .filter((item) => item.status !== 'In Stock')
        .map((item) => {
            const isHighDemand = topItemNames.has(item.itemName.toLowerCase());
            let urgency = 'medium';
            if (item.status === 'Out of Stock') urgency = 'critical';
            else if (item.status === 'Very Low Stock') urgency = 'high';
            else if (isHighDemand) urgency = 'high';

            return {
                id: item.id,
                itemName: item.itemName,
                category: item.category,
                stock: item.stock,
                unitLabel: item.unitLabel,
                percentRemaining: item.percentRemaining,
                status: item.status,
                urgency,
                reason: isHighDemand
                    ? 'High menu demand + low inventory'
                    : 'Stock below reorder threshold',
            };
        })
        .sort((a, b) => {
            const urgencyRank = { critical: 0, high: 1, medium: 2 };
            return urgencyRank[a.urgency] - urgencyRank[b.urgency];
        });
}

function buildHighDemandAlerts(topItems, inventory) {
    const inventoryByName = new Map(
        inventory.map((item) => [item.itemName.toLowerCase(), item]),
    );

    return topItems.slice(0, 5).flatMap((item) => {
        const stockItem = inventoryByName.get(item.name.toLowerCase());
        if (!stockItem || stockItem.status === 'In Stock') return [];

        return [
            {
                menuItem: item.name,
                unitsSold: item.unitsSold,
                inventoryItem: stockItem.itemName,
                status: stockItem.status,
                urgency: stockItem.status === 'Out of Stock' ? 'critical' : 'high',
                message: `${item.name} is a top seller (${item.unitsSold} units) but ${stockItem.itemName} is ${stockItem.status.toLowerCase()}.`,
            },
        ];
    });
}

function buildRecommendations({
    dailyRevenue,
    peakHours,
    inventoryWarnings,
    highDemandAlerts,
    trendFactor,
    next7DaysRevenue,
}) {
    const recommendations = [];

    if (peakHours.length) {
        const primaryPeak = peakHours[0];
        recommendations.push({
            type: 'staffing',
            title: 'Staff for peak hours',
            message: `Schedule an extra barista during ${primaryPeak.label}. Historical data shows ${primaryPeak.orders} orders in this window.`,
            priority: 'high',
        });
    }

    if (inventoryWarnings.length) {
        const critical = inventoryWarnings.filter((item) => item.urgency === 'critical');
        const reorderList = (critical.length ? critical : inventoryWarnings)
            .slice(0, 3)
            .map((item) => item.itemName)
            .join(', ');

        recommendations.push({
            type: 'inventory',
            title: 'Reorder inventory soon',
            message: `Prioritize restocking: ${reorderList}. Low supply may limit top-selling menu items.`,
            priority: critical.length ? 'critical' : 'high',
        });
    }

    if (highDemandAlerts.length) {
        recommendations.push({
            type: 'inventory',
            title: 'High-demand stock risk',
            message: highDemandAlerts[0].message,
            priority: 'high',
        });
    }

    const growthPercent = roundMoney((trendFactor - 1) * 100);
    if (growthPercent >= 5) {
        recommendations.push({
            type: 'revenue',
            title: 'Revenue momentum is rising',
            message: `Sales trend is up ${growthPercent}% vs the prior week. Prep for ~$${next7DaysRevenue.toFixed(2)} over the next 7 days.`,
            priority: 'medium',
        });
    } else if (growthPercent <= -3) {
        recommendations.push({
            type: 'operations',
            title: 'Softening demand detected',
            message: `Revenue is trending ${Math.abs(growthPercent)}% lower. Consider a limited-time combo or loyalty push during ${peakHours[0]?.label ?? 'peak hours'}.`,
            priority: 'medium',
        });
    }

    if (dailyRevenue.length >= 7) {
        const weekendDays = dailyRevenue.filter((day) => {
            const weekday = new Date(`${day.date}T12:00:00`).getDay();
            return weekday === 0 || weekday === 6;
        });
        const weekdayDays = dailyRevenue.filter((day) => {
            const weekday = new Date(`${day.date}T12:00:00`).getDay();
            return weekday >= 1 && weekday <= 5;
        });

        if (weekendDays.length && weekdayDays.length) {
            const weekendAvg =
                weekendDays.reduce((sum, day) => sum + day.revenue, 0) / weekendDays.length;
            const weekdayAvg =
                weekdayDays.reduce((sum, day) => sum + day.revenue, 0) / weekdayDays.length;

            if (weekendAvg > weekdayAvg * 1.15) {
                recommendations.push({
                    type: 'operations',
                    title: 'Weekend prep boost',
                    message: 'Weekend revenue runs higher than weekdays. Increase bakery prep and open-register coverage on Saturday and Sunday.',
                    priority: 'medium',
                });
            }
        }
    }

    if (!recommendations.length) {
        recommendations.push({
            type: 'operations',
            title: 'Keep collecting sales data',
            message: 'Run more completed orders to sharpen AI forecasts. Current insights use limited history.',
            priority: 'low',
        });
    }

    return recommendations.slice(0, 6);
}

function buildTrendChart(dailyRevenue, dailyForecast) {
    const actualWindow = dailyRevenue.slice(-14).map((day) => ({
        date: day.date,
        dayLabel: toDayLabel(day.date),
        actualRevenue: day.revenue,
        predictedRevenue: null,
    }));

    const predictedWindow = dailyForecast.map((day) => ({
        date: day.date,
        dayLabel: day.dayLabel,
        actualRevenue: null,
        predictedRevenue: day.predictedRevenue,
    }));

    if (!actualWindow.length && predictedWindow.length) {
        return predictedWindow.map((day) => ({
            ...day,
            actualRevenue: 0,
        }));
    }

    const lastActual = actualWindow[actualWindow.length - 1];
    if (lastActual && predictedWindow.length) {
        predictedWindow[0] = {
            ...predictedWindow[0],
            actualRevenue: lastActual.actualRevenue,
        };
    }

    return [...actualWindow, ...predictedWindow];
}

function buildHistoricalSummary(dailyRevenue, topItems, hourlySales) {
    const totalOrders = dailyRevenue.reduce((sum, day) => sum + day.orders, 0);
    const totalRevenue = roundMoney(dailyRevenue.reduce((sum, day) => sum + day.revenue, 0));
    const activeDays = dailyRevenue.length || 1;
    const avgDailyRevenue = roundMoney(totalRevenue / activeDays);

    return {
        totalOrders,
        totalRevenue,
        avgDailyRevenue,
        activeDays,
        topItems,
        dailyRevenue,
        hourlySales,
    };
}

function buildStatisticalPredictions(days, historicalData, targetPeriod, externalSignals = null) {
    const { dailyRevenue, hourlySales, topItems, inventory, categorySales } = historicalData;
    const historicalSummary = buildHistoricalSummary(dailyRevenue, topItems, hourlySales);

    const { forecast: dailyForecast, trendFactor, baseAvg } = buildTargetMonthForecast(
        dailyRevenue,
        targetPeriod.year,
        targetPeriod.month,
    );
    const targetMonthRevenue = roundMoney(
        dailyForecast.reduce((sum, day) => sum + day.predictedRevenue, 0),
    );
    const targetMonthOrders = dailyForecast.reduce((sum, day) => sum + day.predictedOrders, 0);
    const avgDailyRevenue = roundMoney(targetMonthRevenue / dailyForecast.length);
    const next7DaysRevenue = roundMoney(
        dailyForecast.slice(0, 7).reduce((sum, day) => sum + day.predictedRevenue, 0),
    );
    const avgDailyRevenueNext7Days = roundMoney(next7DaysRevenue / Math.min(7, dailyForecast.length));

    const peakHours = buildPeakHours(hourlySales);
    const topCategories = buildCategoryForecast(
        categorySales,
        targetPeriod.month,
        targetPeriod.year,
        targetMonthRevenue,
        targetMonthOrders,
    );
    const stockRequirements = buildStockRequirements(topCategories, inventory, topItems);
    const inventoryWarnings = buildInventoryWarnings(inventory, topItems);
    const highDemandAlerts = buildHighDemandAlerts(topItems, inventory);
    const recommendations = buildRecommendations({
        dailyRevenue,
        peakHours,
        inventoryWarnings,
        highDemandAlerts,
        trendFactor,
        next7DaysRevenue: targetMonthRevenue,
    });

    if (topCategories.length) {
        recommendations.unshift({
            type: 'operations',
            title: `Forecast for ${targetPeriod.label}`,
            message: `${topCategories[0].category} leads projected demand with ~${topCategories[0].predictedUnits} units in ${targetPeriod.label}.`,
            priority: 'high',
        });
    }

    const basePayload = {
        generatedAt: new Date().toISOString(),
        analysisPeriodDays: days,
        targetPeriod,
        historicalSummary,
        forecasts: {
            targetMonthRevenue,
            targetMonthOrders,
            next7DaysRevenue,
            avgDailyRevenueNext7Days: avgDailyRevenue,
            weeklyGrowthPercent: roundMoney((trendFactor - 1) * 100),
            dailyForecast,
            peakHours,
            expectedBusyHours: peakHours[0]?.label ?? '12:00 PM – 01:00 PM',
            topCategories,
            stockRequirements,
        },
        inventoryWarnings,
        highDemandAlerts,
        recommendations: recommendations.slice(0, 6),
        trendChart: buildTrendChart(dailyRevenue, dailyForecast),
        meta: {
            baselineDailyAverage: baseAvg,
            dataSource: 'javascript-statistical',
            engine: 'javascript',
            model: 'moving-average-trend',
            hasSalesHistory: historicalSummary.totalOrders > 0,
            fallback: false,
        },
    };

    const macroPayload = externalSignals
        ? applyMacroAdjustmentsToPayload(basePayload, externalSignals)
        : basePayload;

    return attachInventoryAiToPredictionPayload(
        macroPayload,
        inventory,
        topItems,
        topCategories,
        macroPayload.forecasts.dailyForecast,
    );
}

function assembleMlPredictions(days, historicalData, mlResult, targetPeriod, externalSignals = null) {
    const historicalSummary = buildHistoricalSummary(
        historicalData.dailyRevenue,
        historicalData.topItems,
        historicalData.hourlySales,
    );

    let payload = {
            generatedAt: new Date().toISOString(),
            analysisPeriodDays: days,
            targetPeriod: mlResult.targetPeriod || targetPeriod,
            historicalSummary,
            forecasts: mlResult.forecasts,
            inventoryWarnings: mlResult.inventoryWarnings,
            highDemandAlerts: mlResult.highDemandAlerts,
            recommendations: mlResult.recommendations,
            trendChart: mlResult.trendChart,
            macroMarketInsights: mlResult.macroMarketInsights,
            insightBanners: mlResult.insightBanners,
            externalSignals: mlResult.externalSignals,
            meta: {
                baselineDailyAverage: mlResult.meta?.baselineDailyAverage ?? historicalSummary.avgDailyRevenue,
                dataSource: 'ml-python',
                engine: 'python',
                model: mlResult.meta?.model ?? 'sklearn',
                trainingSamples: mlResult.meta?.trainingSamples ?? historicalSummary.activeDays,
                hasSalesHistory: historicalSummary.totalOrders > 0,
                fallback: false,
            },
        };

    if (externalSignals && !payload.macroMarketInsights?.length) {
        payload = applyMacroAdjustmentsToPayload(payload, externalSignals);
    }

    return attachInventoryAiToPredictionPayload(
        payload,
        historicalData.inventory,
        historicalData.topItems,
        payload.forecasts?.topCategories || [],
        payload.forecasts?.dailyForecast || [],
    );
}

function runPythonMlPredictions(inputPayload) {
    return new Promise((resolve, reject) => {
        const child = spawn(PYTHON_COMMAND, [PYTHON_SCRIPT_PATH, '--stdin'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill();
            reject(new Error(`Python ML script timed out after ${PYTHON_TIMEOUT_MS}ms`));
        }, PYTHON_TIMEOUT_MS);

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });

        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);

            if (code !== 0) {
                const detail = stderr.trim() || stdout.trim() || `exit code ${code}`;
                reject(new Error(`Python ML script failed: ${detail}`));
                return;
            }

            try {
                const parsed = JSON.parse(stdout.trim());
                if (!parsed.success) {
                    reject(new Error(parsed.error || 'Python ML script returned unsuccessful result'));
                    return;
                }
                resolve(parsed);
            } catch (parseError) {
                reject(new Error(`Failed to parse Python ML output: ${parseError.message}`));
            }
        });

        child.stdin.write(JSON.stringify(inputPayload));
        child.stdin.end();
    });
}

async function fetchHistoricalData(db, days) {
    const [dailyRevenue, hourlySales, topItems, inventory, categorySales] = await Promise.all([
        fetchDailyRevenue(db, days),
        fetchHourlySales(db, days),
        fetchTopItems(db, days),
        fetchInventorySnapshot(db),
        fetchCategorySalesByMonth(db, days),
    ]);

    return { dailyRevenue, hourlySales, topItems, inventory, categorySales };
}

async function buildInventoryAiInsights(db, query = {}) {
    const days = parseDaysParam(query.days);
    const targetPeriod = parseTargetPeriod(query.targetMonth, query.targetYear);
    const historicalData = await fetchHistoricalData(db, days);

    const { forecast: dailyForecast } = buildTargetMonthForecast(
        historicalData.dailyRevenue,
        targetPeriod.year,
        targetPeriod.month,
    );

    const targetMonthRevenue = roundMoney(
        dailyForecast.reduce((sum, day) => sum + day.predictedRevenue, 0),
    );
    const targetMonthOrders = dailyForecast.reduce((sum, day) => sum + day.predictedOrders, 0);

    const topCategories = buildCategoryForecast(
        historicalData.categorySales,
        targetPeriod.month,
        targetPeriod.year,
        targetMonthRevenue,
        targetMonthOrders,
    );

    const items = computeInventoryAiRecommendations({
        inventory: historicalData.inventory,
        topItems: historicalData.topItems,
        topCategories,
        dailyForecast,
        targetPeriod,
        analysisDays: days,
    });

    return {
        generatedAt: new Date().toISOString(),
        targetPeriod,
        horizonDays: 14,
        items,
    };
}

async function buildAiPredictions(db, query = {}) {
    const days = parseDaysParam(query.days);
    const targetPeriod = parseTargetPeriod(query.targetMonth, query.targetYear);
    const historicalData = await fetchHistoricalData(db, days);
    const externalSignals = await fetchExternalSignals(targetPeriod.month, targetPeriod.year);

    try {
        const mlResult = await runPythonMlPredictions({
            analysisPeriodDays: days,
            targetMonth: targetPeriod.month,
            targetYear: targetPeriod.year,
            dailyRevenue: historicalData.dailyRevenue,
            hourlySales: historicalData.hourlySales,
            topItems: historicalData.topItems,
            inventory: historicalData.inventory,
            categorySales: historicalData.categorySales,
            externalSignals,
        });

        return assembleMlPredictions(days, historicalData, mlResult, targetPeriod, externalSignals);
    } catch (pythonError) {
        console.warn('⚠️ Python ML prediction fallback engaged:', pythonError.message);

        const fallbackResult = buildStatisticalPredictions(
            days,
            historicalData,
            targetPeriod,
            externalSignals,
        );
        return {
            ...fallbackResult,
            meta: {
                ...fallbackResult.meta,
                dataSource: 'javascript-statistical',
                engine: 'javascript',
                fallback: true,
                fallbackReason: pythonError.message,
            },
        };
    }
}

module.exports = {
    ALLOWED_DAY_RANGES,
    DEFAULT_ANALYSIS_DAYS,
    FORECASTABLE_PERIODS,
    buildAiPredictions,
    buildInventoryAiInsights,
    buildStatisticalPredictions,
    mergeInventoryAiFlags,
    parseDaysParam,
    parseTargetPeriod,
    runPythonMlPredictions,
    fetchInventoryForAlerts: fetchInventorySnapshot,
};
