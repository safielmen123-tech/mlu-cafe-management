const { env } = require('../config/env');
const { STORE } = require('../config/store');

const FX_BASELINE_KHR = Number.parseFloat(process.env.USD_KHR_BASELINE || '4100');
const FX_VOLATILITY_THRESHOLD = Number.parseFloat(process.env.USD_KHR_VOLATILITY_THRESHOLD || '2.5');
const WEATHER_LAT = process.env.CAFE_WEATHER_LAT || STORE.weather.lat;
const WEATHER_LON = process.env.CAFE_WEATHER_LON || STORE.weather.lon;
const WEATHER_CITY = process.env.CAFE_WEATHER_CITY || STORE.weather.city;

const CAMBODIAN_HOLIDAYS = [
    { month: 1, day: 1, name: 'International New Year', touristBoost: 0.05 },
    { month: 4, day: 14, name: 'Khmer New Year (Day 1)', touristBoost: 0.22 },
    { month: 4, day: 15, name: 'Khmer New Year (Day 2)', touristBoost: 0.22 },
    { month: 4, day: 16, name: 'Khmer New Year (Day 3)', touristBoost: 0.18 },
    { month: 5, day: 1, name: 'Labour Day', touristBoost: 0.06 },
    { month: 9, day: 22, name: 'Pchum Ben (approx.)', touristBoost: 0.12 },
    { month: 10, day: 15, name: 'Commemoration Day of King Father', touristBoost: 0.08 },
    { month: 11, day: 9, name: 'Independence Day', touristBoost: 0.07 },
    { month: 12, day: 25, name: 'Christmas / Holiday Season', touristBoost: 0.1 },
];

const TOURIST_SEASON_MONTHS = {
    high: [11, 12, 1, 2],
    shoulder: [3, 7, 8],
    low: [4, 5, 6, 9, 10],
};

async function fetchJson(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchUsdKhrExchange() {
    try {
        const payload = await fetchJson('https://open.er-api.com/v6/latest/USD');
        const rate = Number(payload?.rates?.KHR);
        if (!rate || Number.isNaN(rate)) {
            throw new Error('KHR rate missing');
        }

        const volatilityPercent = Math.abs(((rate - FX_BASELINE_KHR) / FX_BASELINE_KHR) * 100);
        const inflationRisk = volatilityPercent >= FX_VOLATILITY_THRESHOLD;

        return {
            source: 'open.er-api.com',
            usdToKhr: Math.round(rate * 100) / 100,
            baselineKhr: FX_BASELINE_KHR,
            volatilityPercent: Math.round(volatilityPercent * 100) / 100,
            inflationRisk,
            direction: rate >= FX_BASELINE_KHR ? 'up' : 'down',
        };
    } catch (error) {
        return {
            source: 'fallback',
            usdToKhr: FX_BASELINE_KHR,
            baselineKhr: FX_BASELINE_KHR,
            volatilityPercent: 0,
            inflationRisk: false,
            direction: 'stable',
            fallbackReason: error.message,
        };
    }
}

function seasonalWeatherFallback(targetMonth) {
    if ([5, 6, 7, 8, 9, 10].includes(targetMonth)) {
        return {
            condition: 'rain',
            label: 'Monsoon / rainy season pattern',
            rainProbability: 68,
            temperatureC: 30,
            takeoutShiftPercent: 12,
        };
    }

    if ([3, 4, 5].includes(targetMonth)) {
        return {
            condition: 'hot',
            label: 'Hot dry season pattern',
            rainProbability: 22,
            temperatureC: 35,
            takeoutShiftPercent: 4,
        };
    }

    return {
        condition: 'clear',
        label: 'Cool high-season pattern',
        rainProbability: 18,
        temperatureC: 28,
        takeoutShiftPercent: 2,
    };
}

async function fetchWeatherSignals(targetMonth, targetYear) {
    const apiKey = process.env.OPENWEATHER_API_KEY || env.openWeatherApiKey;

    if (!apiKey) {
        return {
            ...seasonalWeatherFallback(targetMonth),
            source: 'seasonal-fallback',
            city: WEATHER_CITY,
        };
    }

    try {
        const forecastUrl =
            `https://api.openweathermap.org/data/2.5/forecast`
            + `?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&units=metric&appid=${apiKey}`;
        const currentUrl =
            `https://api.openweathermap.org/data/2.5/weather`
            + `?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&units=metric&appid=${apiKey}`;

        const [forecastPayload, currentPayload] = await Promise.all([
            fetchJson(forecastUrl),
            fetchJson(currentUrl),
        ]);

        const entries = forecastPayload?.list || [];
        const targetPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        const monthEntries = entries.filter((entry) => String(entry.dt_txt).startsWith(targetPrefix));
        const sample = monthEntries.length ? monthEntries : entries.slice(0, 8);

        const rainCount = sample.filter((entry) => {
            const weather = entry.weather?.[0]?.main?.toLowerCase() || '';
            return weather.includes('rain') || weather.includes('drizzle') || weather.includes('thunder');
        }).length;

        const rainProbability = Math.round((rainCount / Math.max(sample.length, 1)) * 100);
        const temperatureC = Math.round(currentPayload?.main?.temp || 30);
        const isHot = temperatureC >= 33;
        const isRainy = rainProbability >= 45;

        let condition = 'clear';
        if (isRainy) condition = 'rain';
        else if (isHot) condition = 'hot';

        return {
            source: 'openweathermap',
            city: WEATHER_CITY,
            condition,
            label: isRainy ? 'Rain-forward week ahead' : isHot ? 'Hot & sunny outlook' : 'Mostly clear conditions',
            rainProbability,
            temperatureC,
            takeoutShiftPercent: isRainy ? Math.min(18, 6 + rainProbability / 5) : isHot ? 5 : 2,
        };
    } catch (error) {
        return {
            ...seasonalWeatherFallback(targetMonth),
            source: 'seasonal-fallback',
            city: WEATHER_CITY,
            fallbackReason: error.message,
        };
    }
}

function buildCambodianCalendarSignals(targetMonth, targetYear) {
    const holidays = CAMBODIAN_HOLIDAYS.filter((holiday) => holiday.month === targetMonth).map(
        (holiday) => ({
            ...holiday,
            date: `${targetYear}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`,
        }),
    );

    let touristBoostPercent = 0;
    let seasonLabel = 'Shoulder tourism season';

    if (TOURIST_SEASON_MONTHS.high.includes(targetMonth)) {
        touristBoostPercent = 0.18;
        seasonLabel = 'High tourism season (cool weather)';
    } else if (TOURIST_SEASON_MONTHS.shoulder.includes(targetMonth)) {
        touristBoostPercent = 0.08;
        seasonLabel = 'Shoulder tourism season';
    } else {
        touristBoostPercent = 0.03;
        seasonLabel = 'Local-dominant season';
    }

    if (holidays.length) {
        touristBoostPercent += Math.max(...holidays.map((holiday) => holiday.touristBoost));
    }

    return {
        seasonLabel,
        touristBoostPercent: Math.round(touristBoostPercent * 1000) / 10,
        holidays,
        isHighTourismMonth: touristBoostPercent >= 0.15,
    };
}

function buildModifiers(fx, weather, calendar) {
    let revenueMultiplier = 1;
    let takeoutRatioBoost = (weather.takeoutShiftPercent || 0) / 100;
    let coffeeReorderBoost = 1;
    let dairyReorderBoost = 1;

    if (calendar.isHighTourismMonth) {
        revenueMultiplier += calendar.touristBoostPercent / 100;
        coffeeReorderBoost += 0.12;
        dairyReorderBoost += 0.1;
    }

    if (weather.condition === 'rain') {
        takeoutRatioBoost += 0.08;
        revenueMultiplier += 0.03;
    } else if (weather.condition === 'hot') {
        revenueMultiplier += 0.04;
        dairyReorderBoost += 0.06;
    }

    if (fx.inflationRisk) {
        revenueMultiplier -= 0.02;
    }

    return {
        revenueMultiplier: Math.round(revenueMultiplier * 1000) / 1000,
        takeoutRatioBoost: Math.round(takeoutRatioBoost * 1000) / 1000,
        coffeeReorderBoost: Math.round(coffeeReorderBoost * 1000) / 1000,
        dairyReorderBoost: Math.round(dairyReorderBoost * 1000) / 1000,
        tableOccupancyShiftToTakeout: weather.condition === 'rain',
    };
}

function buildMacroInsights(fx, weather, calendar, modifiers) {
    const insights = [
        {
            id: 'fx',
            type: 'exchange',
            title: 'USD / KHR Exchange Impact',
            value: `1 USD = ${fx.usdToKhr.toLocaleString()} KHR`,
            detail: `${fx.volatilityPercent}% vs baseline (${fx.baselineKhr} KHR)`,
            severity: fx.inflationRisk ? 'warning' : 'neutral',
        },
        {
            id: 'weather',
            type: 'weather',
            title: 'Seasonal Weather Modifier',
            value: weather.label,
            detail: `${weather.rainProbability}% rain probability · ${weather.temperatureC}°C avg (${weather.city})`,
            severity: weather.condition === 'rain' ? 'info' : weather.condition === 'hot' ? 'warning' : 'neutral',
        },
        {
            id: 'tourism',
            type: 'tourism',
            title: 'Expected Tourist Footfall',
            value: calendar.seasonLabel,
            detail: `+${calendar.touristBoostPercent}% visitor volume · ${STORE.domainContext}`,
            severity: calendar.isHighTourismMonth ? 'positive' : 'neutral',
        },
    ];

    const banners = [];

    if (fx.inflationRisk) {
        banners.push({
            type: 'inflation',
            title: 'Inflation / Cost Adjustment Risk',
            message:
                `USD/KHR moved ${fx.volatilityPercent}% from baseline. Review supplier costs and menu pricing before ${calendar.seasonLabel.toLowerCase()}.`,
            severity: 'warning',
        });
    }

    if (modifiers.tableOccupancyShiftToTakeout) {
        banners.push({
            type: 'operations',
            title: 'Rain shifts demand to Takeout',
            message:
                `Elevated rain probability (${weather.rainProbability}%) — prep packaging, delivery handoff, and takeout staffing.`,
            severity: 'info',
        });
    }

    if (calendar.isHighTourismMonth) {
        banners.push({
            type: 'inventory',
            title: 'Tourism boost on coffee & dairy',
            message:
                'High visitor months detected — increase coffee bean and fresh milk reorder buffers.',
            severity: 'positive',
        });
    }

    return { insights, banners };
}

async function fetchExternalSignals(targetMonth, targetYear) {
    const [fx, weather] = await Promise.all([
        fetchUsdKhrExchange(),
        fetchWeatherSignals(targetMonth, targetYear),
    ]);
    const calendar = buildCambodianCalendarSignals(targetMonth, targetYear);
    const modifiers = buildModifiers(fx, weather, calendar);
    const macro = buildMacroInsights(fx, weather, calendar, modifiers);

    return {
        fetchedAt: new Date().toISOString(),
        fx,
        weather,
        calendar,
        modifiers,
        macroMarketInsights: macro.insights,
        insightBanners: macro.banners,
    };
}

function roundMoney(value) {
    return Math.round(Number(value) * 100) / 100;
}

function applyMacroAdjustmentsToPayload(payload, externalSignals) {
    if (!payload || !externalSignals) return payload;

    const { modifiers, macroMarketInsights, insightBanners, fx, weather, calendar } = externalSignals;
    const revenueMultiplier = modifiers.revenueMultiplier || 1;

    const forecasts = payload.forecasts || {};
    const dailyForecast = (forecasts.dailyForecast || []).map((day) => ({
        ...day,
        predictedRevenue: roundMoney((day.predictedRevenue || 0) * revenueMultiplier),
        predictedOrders: Math.max(
            0,
            Math.round((day.predictedOrders || 0) * revenueMultiplier),
        ),
    }));

    const targetMonthRevenue = roundMoney(
        dailyForecast.reduce((sum, day) => sum + (day.predictedRevenue || 0), 0),
    );
    const targetMonthOrders = dailyForecast.reduce((sum, day) => sum + (day.predictedOrders || 0), 0);

    const stockRequirements = (forecasts.stockRequirements || []).map((item) => {
        const name = String(item.itemName || '').toLowerCase();
        let boost = 1;
        if (name.includes('coffee')) boost = modifiers.coffeeReorderBoost || 1;
        if (name.includes('milk')) boost = modifiers.dairyReorderBoost || 1;

        return {
            ...item,
            requiredUnits: Math.round((item.requiredUnits || 0) * boost),
            reorderQty: Math.round((item.reorderQty || 0) * boost),
            macroAdjusted: boost > 1,
        };
    });

    const takeoutInsight = {
        type: 'operations',
        title: 'Channel mix adjustment',
        message: `Live weather projects +${Math.round((modifiers.takeoutRatioBoost || 0) * 100)}% takeout/delivery mix vs dine-in for the target period.`,
        priority: 'medium',
    };

    const recommendations = [...(payload.recommendations || [])];
    if (modifiers.tableOccupancyShiftToTakeout) {
        recommendations.unshift(takeoutInsight);
    }
    if (fx.inflationRisk) {
        recommendations.unshift({
            type: 'revenue',
            title: 'Inflation / Cost Adjustment Risk',
            message: insightBanners.find((banner) => banner.type === 'inflation')?.message
                || 'Review ingredient costs due to FX volatility.',
            priority: 'high',
        });
    }

    return {
        ...payload,
        forecasts: {
            ...forecasts,
            dailyForecast,
            targetMonthRevenue,
            targetMonthOrders,
            next7DaysRevenue: roundMoney(
                dailyForecast.slice(0, 7).reduce((sum, day) => sum + (day.predictedRevenue || 0), 0),
            ),
            avgDailyRevenueNext7Days: roundMoney(
                dailyForecast.slice(0, 7).reduce((sum, day) => sum + (day.predictedRevenue || 0), 0)
                    / Math.min(7, dailyForecast.length || 1),
            ),
            stockRequirements,
            takeoutDemandBoostPercent: Math.round((modifiers.takeoutRatioBoost || 0) * 100),
            tableToTakeoutShift: modifiers.tableOccupancyShiftToTakeout,
        },
        recommendations: recommendations.slice(0, 8),
        macroMarketInsights,
        insightBanners,
        externalSignals: {
            fx,
            weather,
            calendar,
            modifiers,
            fetchedAt: externalSignals.fetchedAt,
        },
    };
}

module.exports = {
    fetchExternalSignals,
    applyMacroAdjustmentsToPayload,
    buildCambodianCalendarSignals,
};
