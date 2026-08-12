const FORECAST_HORIZON_DAYS = 14;

/**
 * Estimated ingredient draw per menu unit sold (by menu analytics category).
 */
const INGREDIENT_USAGE_RULES = [
    {
        ingredientMatch: 'coffee beans',
        categories: ['Hot Coffee', 'Iced Coffee', 'Hot Tea'],
        usagePerMenuUnit: 0.07,
    },
    {
        ingredientMatch: 'whole milk',
        categories: ['Hot Coffee', 'Iced Coffee', 'Hot Tea', 'Iced Tea', 'Smoothie'],
        usagePerMenuUnit: 0.13,
    },
    {
        ingredientMatch: 'oat milk',
        categories: ['Hot Coffee', 'Iced Coffee', 'Iced Tea'],
        usagePerMenuUnit: 0.05,
    },
    {
        ingredientMatch: 'vanilla syrup',
        categories: ['Hot Coffee', 'Iced Coffee', 'Smoothie', 'Iced Tea'],
        usagePerMenuUnit: 0.045,
    },
    {
        ingredientMatch: 'sugar',
        categories: ['Hot Coffee', 'Hot Tea', 'Iced Tea'],
        usagePerMenuUnit: 0.04,
    },
    {
        ingredientMatch: 'paper cups',
        categories: ['Hot Coffee', 'Iced Coffee', 'Hot Tea', 'Iced Tea', 'Smoothie'],
        usagePerMenuUnit: 0.11,
    },
    {
        ingredientMatch: 'pastry boxes',
        categories: ['Bakery'],
        usagePerMenuUnit: 0.08,
    },
    {
        ingredientMatch: 'croissant dough',
        categories: ['Bakery'],
        usagePerMenuUnit: 0.17,
    },
];

function roundUnits(value) {
    return Math.round(Number(value) * 100) / 100;
}

function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
}

function findInventoryRow(inventory, ingredientMatch) {
    return inventory.find((row) => {
        const name = normalizeName(row.itemName || row.item_name);
        return name.includes(ingredientMatch) || ingredientMatch.includes(name);
    });
}

function computeFourteenDayCategoryUnits({ topCategories, dailyForecast, topItems, analysisDays = 365 }) {
    const forecastWindow = (dailyForecast || []).slice(0, FORECAST_HORIZON_DAYS);
    const categoryUnits = {};

    if (topCategories?.length && forecastWindow.length) {
        const totalOrders = forecastWindow.reduce(
            (sum, day) => sum + Number(day.predictedOrders || 0),
            0,
        );

        for (const category of topCategories) {
            const share = Number(category.sharePercent || 0) / 100;
            categoryUnits[category.category] = roundUnits(totalOrders * share);
        }
    }

    if (Object.keys(categoryUnits).length === 0 && topItems?.length) {
        const scale = FORECAST_HORIZON_DAYS / Math.max(analysisDays, 1);
        for (const item of topItems.slice(0, 12)) {
            const category = item.category || 'Coffee';
            categoryUnits[category] = (categoryUnits[category] || 0) + item.unitsSold * scale;
        }
    }

    return categoryUnits;
}

function computeIngredientUsage14Day(categoryUnits) {
    const usageByIngredient = {};

    for (const rule of INGREDIENT_USAGE_RULES) {
        let projectedUsage = 0;
        for (const category of rule.categories) {
            projectedUsage += (categoryUnits[category] || 0) * rule.usagePerMenuUnit;
        }
        usageByIngredient[rule.ingredientMatch] = roundUnits(projectedUsage);
    }

    return usageByIngredient;
}

function buildAiRecommendation({
    itemName,
    projectedUsage14Day,
    projectedStockRemaining,
    unitLabel,
    targetPeriodLabel,
}) {
    if (projectedStockRemaining <= 0) {
        return `AI: ${itemName} may run out within ${FORECAST_HORIZON_DAYS} days at current demand${
            targetPeriodLabel ? ` (${targetPeriodLabel})` : ''
        }.`;
    }

    return `AI: Reorder ${itemName} — projected use of ${projectedUsage14Day} ${unitLabel} in the next ${FORECAST_HORIZON_DAYS} days (≈${projectedStockRemaining} ${unitLabel} left).`;
}

function computeInventoryAiRecommendations({
    inventory,
    topItems,
    topCategories,
    dailyForecast,
    targetPeriod,
    analysisDays = 365,
}) {
    const categoryUnits = computeFourteenDayCategoryUnits({
        topCategories,
        dailyForecast,
        topItems,
        analysisDays,
    });
    const ingredientUsage = computeIngredientUsage14Day(categoryUnits);
    const targetPeriodLabel = targetPeriod?.label || null;

    const recommendations = [];

    for (const rule of INGREDIENT_USAGE_RULES) {
        const inventoryRow = findInventoryRow(inventory, rule.ingredientMatch);
        if (!inventoryRow) continue;

        const projectedUsage14Day = ingredientUsage[rule.ingredientMatch] || 0;
        if (projectedUsage14Day <= 0) continue;

        const stock = Number(inventoryRow.stock ?? inventoryRow.stock_quantity ?? 0);
        const lowThreshold = Number(
            inventoryRow.lowThreshold ?? inventoryRow.low_threshold ?? 0,
        );
        const criticalThreshold =
            inventoryRow.criticalThreshold != null
                ? Number(inventoryRow.criticalThreshold)
                : inventoryRow.critical_threshold != null
                  ? Number(inventoryRow.critical_threshold)
                  : null;

        const projectedStockRemaining = roundUnits(stock - projectedUsage14Day);
        const safetyThreshold = criticalThreshold != null ? criticalThreshold : lowThreshold;
        const predictedLowStock =
            projectedStockRemaining <= 0
            || (safetyThreshold > 0 && projectedStockRemaining <= safetyThreshold)
            || (lowThreshold > 0 && projectedStockRemaining <= lowThreshold);

        if (!predictedLowStock) continue;

        const itemName = inventoryRow.itemName || inventoryRow.item_name;
        const unitLabel = inventoryRow.unitLabel || inventoryRow.unit_label || 'units';

        recommendations.push({
            id: inventoryRow.id,
            itemName,
            category: inventoryRow.category,
            predictedLowStock: true,
            projectedUsage14Day,
            projectedStockRemaining,
            currentStock: stock,
            lowThreshold,
            criticalThreshold,
            aiRecommendation: buildAiRecommendation({
                itemName,
                projectedUsage14Day,
                projectedStockRemaining,
                unitLabel,
                targetPeriodLabel,
            }),
        });
    }

    return recommendations.sort(
        (a, b) => a.projectedStockRemaining - b.projectedStockRemaining,
    );
}

function mergeInventoryAiFlags(inventoryRows, recommendations) {
    const byId = new Map(recommendations.map((row) => [row.id, row]));

    return inventoryRows.map((row) => {
        const insight = byId.get(row.id);
        if (!insight) {
            return {
                ...row,
                predictedLowStock: false,
            };
        }

        return {
            ...row,
            predictedLowStock: true,
            projectedUsage14Day: insight.projectedUsage14Day,
            projectedStockRemaining: insight.projectedStockRemaining,
            aiRecommendation: insight.aiRecommendation,
        };
    });
}

function attachInventoryAiToPredictionPayload(payload, inventory, topItems, topCategories, dailyForecast) {
    const inventoryAiRecommendations = computeInventoryAiRecommendations({
        inventory,
        topItems,
        topCategories,
        dailyForecast: dailyForecast || payload.forecasts?.dailyForecast || [],
        targetPeriod: payload.targetPeriod,
        analysisDays: payload.analysisPeriodDays,
    });

    const flaggedInventory = mergeInventoryAiFlags(inventory, inventoryAiRecommendations);

    const inventoryWarnings = (payload.inventoryWarnings || []).map((warning) => {
        const match = inventoryAiRecommendations.find((row) => row.id === warning.id);
        if (!match) return warning;
        return {
            ...warning,
            predictedLowStock: true,
            projectedUsage14Day: match.projectedUsage14Day,
            aiRecommendation: match.aiRecommendation,
        };
    });

    for (const recommendation of inventoryAiRecommendations) {
        if (inventoryWarnings.some((warning) => warning.id === recommendation.id)) continue;
        inventoryWarnings.push({
            id: recommendation.id,
            itemName: recommendation.itemName,
            category: recommendation.category,
            stock: recommendation.currentStock,
            unitLabel: 'units',
            percentRemaining: 0,
            status: recommendation.projectedStockRemaining <= 0 ? 'Out of Stock' : 'Low Stock',
            urgency: recommendation.projectedStockRemaining <= 0 ? 'critical' : 'high',
            reason: 'Projected demand exceeds stock in next 14 days',
            predictedLowStock: true,
            projectedUsage14Day: recommendation.projectedUsage14Day,
            aiRecommendation: recommendation.aiRecommendation,
        });
    }

    return {
        ...payload,
        inventoryAiRecommendations,
        inventoryWithAiFlags: flaggedInventory,
        inventoryWarnings,
    };
}

module.exports = {
    FORECAST_HORIZON_DAYS,
    INGREDIENT_USAGE_RULES,
    computeFourteenDayCategoryUnits,
    computeIngredientUsage14Day,
    computeInventoryAiRecommendations,
    mergeInventoryAiFlags,
    attachInventoryAiToPredictionPayload,
};
