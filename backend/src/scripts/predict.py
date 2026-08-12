#!/usr/bin/env python3
"""
Romdoul Cafe AI prediction engine.

Trains on up to 12 months of historical sales and projects revenue, categories,
and stock needs for a user-selected target month.
"""

from __future__ import annotations

import calendar
import json
import sys
from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression


def load_input() -> dict[str, Any]:
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg in ("--stdin", "-"):
            return json.load(sys.stdin)
        if arg.startswith("{"):
            return json.loads(arg)
        with open(arg, encoding="utf-8") as handle:
            return json.load(handle)
    return json.load(sys.stdin)


def round_money(value: float) -> float:
    return round(float(value), 2)


def format_hour_label(hour24: int) -> str:
    hour = int(hour24) % 24
    next_hour = (hour + 1) % 24

    def to_label(value: int) -> tuple[int, str]:
        period = "PM" if value >= 12 else "AM"
        hour12 = value % 12 or 12
        return hour12, period

    start_hour, start_period = to_label(hour)
    end_hour, end_period = to_label(next_hour)
    return (
        f"{start_hour:02d}:00 {start_period} – "
        f"{end_hour:02d}:00 {end_period}"
    )


def to_day_label(date_key: str) -> str:
    parsed = datetime.strptime(date_key, "%Y-%m-%d")
    return parsed.strftime("%a, %b %d")


def month_label(year: int, month: int) -> str:
    parsed = datetime(year, month, 1)
    return parsed.strftime("%B %Y")


def build_daily_frame(daily_revenue: list[dict[str, Any]]) -> pd.DataFrame:
    if not daily_revenue:
        today = date.today()
        return pd.DataFrame(
            {
                "date": pd.date_range(end=today, periods=1, freq="D"),
                "orders": [0],
                "revenue": [0.0],
            }
        )

    frame = pd.DataFrame(daily_revenue)
    frame["date"] = pd.to_datetime(frame["date"])
    frame["orders"] = frame["orders"].astype(float)
    frame["revenue"] = frame["revenue"].astype(float)

    start = frame["date"].min()
    end = frame["date"].max()
    full_range = pd.date_range(start=start, end=end, freq="D")
    frame = (
        frame.set_index("date")
        .reindex(full_range, fill_value=0)
        .rename_axis("date")
        .reset_index()
    )
    frame["orders"] = frame["orders"].astype(float)
    frame["revenue"] = frame["revenue"].astype(float)
    return frame


def add_features(frame: pd.DataFrame) -> pd.DataFrame:
    enriched = frame.copy()
    enriched["day_of_week"] = enriched["date"].dt.dayofweek
    enriched["day_of_month"] = enriched["date"].dt.day
    enriched["month"] = enriched["date"].dt.month
    enriched["year"] = enriched["date"].dt.year
    enriched["is_weekend"] = enriched["day_of_week"].isin([5, 6]).astype(int)
    enriched["ordinal_day"] = (
        enriched["date"] - enriched["date"].min()
    ).dt.days.astype(float)
    enriched["lag_1_revenue"] = enriched["revenue"].shift(1).fillna(0)
    enriched["lag_7_revenue"] = enriched["revenue"].shift(7).fillna(0)
    enriched["rolling_7_revenue"] = (
        enriched["revenue"].rolling(window=7, min_periods=1).mean()
    )
    enriched["rolling_7_orders"] = (
        enriched["orders"].rolling(window=7, min_periods=1).mean()
    )
    enriched["same_month_avg"] = (
        enriched.groupby("month")["revenue"].transform("mean")
    )
    return enriched


def choose_model(sample_count: int):
    if sample_count >= 30:
        return RandomForestRegressor(
            n_estimators=160,
            random_state=42,
            min_samples_leaf=1,
        ), "RandomForestRegressor"
    return LinearRegression(), "LinearRegression"


def train_regressor(frame: pd.DataFrame, target_column: str):
    feature_columns = [
        "day_of_week",
        "day_of_month",
        "month",
        "is_weekend",
        "ordinal_day",
        "lag_1_revenue",
        "lag_7_revenue",
        "rolling_7_revenue",
        "rolling_7_orders",
        "same_month_avg",
    ]

    enriched = add_features(frame)
    model, model_name = choose_model(len(enriched))

    x_train = enriched[feature_columns]
    y_train = enriched[target_column]
    model.fit(x_train, y_train)

    return model, model_name, feature_columns, enriched


def seasonal_multiplier(month: int) -> float:
    if month in (11, 12, 1, 2):
        return 1.35
    if month in (3, 4, 5):
        return 1.18 if month != 4 else 1.28
    return 1.0


def predict_target_month(
    frame: pd.DataFrame,
    target_year: int,
    target_month: int,
) -> tuple[list[dict[str, Any]], str, float]:
    revenue_model, model_name, feature_columns, history = train_regressor(frame, "revenue")
    orders_model, _, _, _ = train_regressor(frame, "orders")

    days_in_month = calendar.monthrange(target_year, target_month)[1]
    working = history[["date", "orders", "revenue"]].copy()
    forecasts: list[dict[str, Any]] = []
    month_factor = seasonal_multiplier(target_month)

    for day_num in range(1, days_in_month + 1):
        next_date = datetime(target_year, target_month, day_num)
        candidate = pd.concat(
            [
                working,
                pd.DataFrame(
                    {
                        "date": [next_date],
                        "orders": [working.iloc[-1]["orders"]],
                        "revenue": [working.iloc[-1]["revenue"]],
                    }
                ),
            ],
            ignore_index=True,
        )
        features = add_features(candidate).tail(1)

        predicted_revenue = max(
            0.0,
            float(revenue_model.predict(features[feature_columns])[0]) * month_factor,
        )
        predicted_orders = max(
            0.0,
            float(orders_model.predict(features[feature_columns])[0]) * month_factor,
        )

        date_key = next_date.strftime("%Y-%m-%d")
        forecasts.append(
            {
                "date": date_key,
                "dayLabel": to_day_label(date_key),
                "predictedRevenue": round_money(predicted_revenue),
                "predictedOrders": round(max(0, int(round(predicted_orders)))),
            }
        )

        working = pd.concat(
            [
                working,
                pd.DataFrame(
                    {
                        "date": [next_date],
                        "orders": [predicted_orders],
                        "revenue": [predicted_revenue],
                    }
                ),
            ],
            ignore_index=True,
        )

    same_month_history = history[history["date"].dt.month == target_month]
    if len(same_month_history):
        baseline = round_money(same_month_history["revenue"].mean())
    else:
        baseline = round_money(history["revenue"].tail(30).mean() if len(history) else 0)

    return forecasts, model_name, baseline


def build_peak_hours(hourly_sales: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not hourly_sales:
        return [
            {
                "hour": 12,
                "label": "12:00 PM – 01:00 PM",
                "orders": 0,
                "revenue": 0,
                "confidence": "sample",
            }
        ]

    max_orders = max(item.get("orders", 0) for item in hourly_sales) or 1
    ranked = sorted(hourly_sales, key=lambda item: item.get("orders", 0), reverse=True)

    peak_hours = []
    for entry in ranked[:3]:
        orders = int(entry.get("orders", 0))
        peak_hours.append(
            {
                "hour": int(entry.get("hour", 0)),
                "label": entry.get("label") or format_hour_label(int(entry.get("hour", 0))),
                "orders": orders,
                "revenue": round_money(entry.get("revenue", 0)),
                "confidence": "high" if orders / max_orders >= 0.6 else "moderate",
            }
        )
    return peak_hours


def build_category_forecast(
    category_sales: list[dict[str, Any]],
    target_month: int,
    target_year: int,
    predicted_month_revenue: float,
    predicted_month_orders: int,
) -> list[dict[str, Any]]:
    if not category_sales:
        return []

    frame = pd.DataFrame(category_sales)
    frame["month"] = frame["monthKey"].str.split("-").str[1].astype(int)
    frame["year"] = frame["monthKey"].str.split("-").str[0].astype(int)
    frame["unitsSold"] = frame["unitsSold"].astype(float)
    frame["revenue"] = frame["revenue"].astype(float)

    same_month = frame[frame["month"] == target_month]
    if same_month.empty:
        same_month = frame

    grouped = (
        same_month.groupby("category", as_index=False)[["unitsSold", "revenue"]]
        .sum()
        .sort_values("unitsSold", ascending=False)
    )

    historical_revenue = grouped["revenue"].sum() or 1
    historical_units = grouped["unitsSold"].sum() or 1
    scale_revenue = predicted_month_revenue / historical_revenue if historical_revenue else 1
    scale_units = predicted_month_orders / historical_units if historical_units else scale_revenue

    categories = []
    for _, row in grouped.iterrows():
        predicted_revenue = round_money(row["revenue"] * scale_revenue)
        predicted_units = round(max(0, row["unitsSold"] * scale_units))
        categories.append(
            {
                "category": row["category"],
                "predictedUnits": predicted_units,
                "predictedRevenue": predicted_revenue,
                "sharePercent": round_money((predicted_revenue / max(predicted_month_revenue, 1)) * 100),
            }
        )

    return sorted(categories, key=lambda item: item["predictedUnits"], reverse=True)


def build_stock_requirements(
    top_categories: list[dict[str, Any]],
    inventory: list[dict[str, Any]],
    top_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    requirements = []
    category_units = {
        item["category"]: item["predictedUnits"] for item in top_categories[:6]
    }

    for stock_item in inventory:
        item_name = stock_item.get("itemName") or stock_item.get("item_name") or stock_item.get("name", "")
        category = stock_item.get("category") or "General"
        predicted_demand = category_units.get(category, 0)
        if predicted_demand <= 0:
            for menu_item in top_items[:5]:
                if menu_item.get("category") == category:
                    predicted_demand = max(predicted_demand, menu_item.get("unitsSold", 0) // 12)
                    break

        buffer_units = max(10, round(predicted_demand * 0.15))
        required_units = predicted_demand + buffer_units
        current_stock = float(stock_item.get("stock", stock_item.get("stock_quantity", 0)))
        reorder_qty = max(0, round(required_units - current_stock))
        status = stock_item.get("status", "In Stock")

        urgency = "low"
        if reorder_qty > 0 and status != "In Stock":
            urgency = "critical" if status == "Out of Stock" else "high"
        elif reorder_qty > required_units * 0.25:
            urgency = "medium"

        if reorder_qty <= 0 and status == "In Stock":
            continue

        requirements.append(
            {
                "itemName": item_name,
                "category": category,
                "requiredUnits": round(required_units),
                "currentStock": round(current_stock),
                "reorderQty": reorder_qty,
                "urgency": urgency,
            }
        )

    urgency_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(requirements, key=lambda item: urgency_rank.get(item["urgency"], 99))[:8]


def build_inventory_warnings(
    inventory: list[dict[str, Any]],
    top_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    top_names = {item.get("name", "").lower() for item in top_items[:5]}

    warnings = []
    for item in inventory:
        status = item.get("status", "In Stock")
        if status == "In Stock":
            continue

        item_name = item.get("itemName") or item.get("item_name") or item.get("name", "")
        is_high_demand = item_name.lower() in top_names
        urgency = "medium"
        if status == "Out of Stock":
            urgency = "critical"
        elif status == "Very Low Stock" or is_high_demand:
            urgency = "high"

        warnings.append(
            {
                "id": item.get("id"),
                "itemName": item_name,
                "category": item.get("category"),
                "stock": item.get("stock", item.get("stock_quantity", 0)),
                "unitLabel": item.get("unitLabel") or item.get("unit_label") or "units",
                "percentRemaining": item.get("percentRemaining", 0),
                "status": status,
                "urgency": urgency,
                "reason": (
                    "High menu demand + low inventory"
                    if is_high_demand
                    else "Stock below reorder threshold"
                ),
            }
        )

    urgency_rank = {"critical": 0, "high": 1, "medium": 2}
    return sorted(warnings, key=lambda item: urgency_rank.get(item["urgency"], 99))


def build_high_demand_alerts(
    top_items: list[dict[str, Any]],
    inventory: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    inventory_by_name = {
        (item.get("itemName") or item.get("item_name") or item.get("name", "")).lower(): item
        for item in inventory
    }

    alerts = []
    for item in top_items[:5]:
        stock_item = inventory_by_name.get(item.get("name", "").lower())
        if not stock_item or stock_item.get("status") == "In Stock":
            continue

        status = stock_item.get("status", "Low Stock")
        alerts.append(
            {
                "menuItem": item.get("name"),
                "unitsSold": item.get("unitsSold", item.get("units_sold", 0)),
                "inventoryItem": stock_item.get("itemName")
                or stock_item.get("item_name")
                or stock_item.get("name"),
                "status": status,
                "urgency": "critical" if status == "Out of Stock" else "high",
                "message": (
                    f"{item.get('name')} is a top seller "
                    f"({item.get('unitsSold', item.get('units_sold', 0))} units) but "
                    f"{stock_item.get('itemName') or stock_item.get('item_name')} is "
                    f"{status.lower()}."
                ),
            }
        )
    return alerts


def build_recommendations(
    target_label: str,
    peak_hours: list[dict[str, Any]],
    inventory_warnings: list[dict[str, Any]],
    high_demand_alerts: list[dict[str, Any]],
    target_month_revenue: float,
    growth_percent: float,
    top_categories: list[dict[str, Any]],
    stock_requirements: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []

    recommendations.append(
        {
            "type": "revenue",
            "title": f"Forecast for {target_label}",
            "message": (
                f"ML model projects ${target_month_revenue:.2f} revenue and "
                f"{growth_percent:+.1f}% vs the same seasonal month in history."
            ),
            "priority": "high",
        }
    )

    if peak_hours:
        primary = peak_hours[0]
        recommendations.append(
            {
                "type": "staffing",
                "title": "Staff for peak hours",
                "message": (
                    f"Schedule an extra barista during {primary['label']}. "
                    f"Historical data shows {primary['orders']} orders in this window."
                ),
                "priority": "high",
            }
        )

    if top_categories:
        lead = top_categories[0]
        recommendations.append(
            {
                "type": "operations",
                "title": "Top category to prep",
                "message": (
                    f"{lead['category']} leads demand with ~{lead['predictedUnits']} units "
                    f"({lead['sharePercent']:.1f}% of projected revenue)."
                ),
                "priority": "medium",
            }
        )

    if inventory_warnings:
        critical = [item for item in inventory_warnings if item["urgency"] == "critical"]
        reorder_pool = critical or inventory_warnings
        reorder_list = ", ".join(item["itemName"] for item in reorder_pool[:3])
        recommendations.append(
            {
                "type": "inventory",
                "title": "Reorder inventory soon",
                "message": (
                    f"Prioritize restocking: {reorder_list}. "
                    "Low supply may limit top-selling menu items."
                ),
                "priority": "critical" if critical else "high",
            }
        )

    if stock_requirements:
        urgent = [item for item in stock_requirements if item["urgency"] in ("critical", "high")]
        if urgent:
            stock_list = ", ".join(item["itemName"] for item in urgent[:3])
            recommendations.append(
                {
                    "type": "inventory",
                    "title": "Target-month stock plan",
                    "message": (
                        f"Order ahead for {target_label}: {stock_list}. "
                        f"Combined reorder qty: {sum(item['reorderQty'] for item in urgent[:3])} units."
                    ),
                    "priority": "high",
                }
            )

    if high_demand_alerts:
        recommendations.append(
            {
                "type": "inventory",
                "title": "High-demand stock risk",
                "message": high_demand_alerts[0]["message"],
                "priority": "high",
            }
        )

    return recommendations[:6]


def build_trend_chart(
    daily_revenue: list[dict[str, Any]],
    daily_forecast: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    actual_window = [
        {
            "date": day["date"],
            "dayLabel": to_day_label(day["date"]),
            "actualRevenue": round_money(day["revenue"]),
            "predictedRevenue": None,
        }
        for day in daily_revenue[-30:]
    ]

    predicted_window = [
        {
            "date": day["date"],
            "dayLabel": day["dayLabel"],
            "actualRevenue": None,
            "predictedRevenue": day["predictedRevenue"],
        }
        for day in daily_forecast
    ]

    if not actual_window and predicted_window:
        return [{**day, "actualRevenue": 0} for day in predicted_window]

    if actual_window and predicted_window:
        predicted_window[0] = {
            **predicted_window[0],
            "actualRevenue": actual_window[-1]["actualRevenue"],
        }

    return actual_window + predicted_window


def compute_month_growth(
    daily_revenue: list[dict[str, Any]],
    target_month: int,
    daily_forecast: list[dict[str, Any]],
) -> float:
    same_month_actual = [
        day for day in daily_revenue
        if datetime.strptime(day["date"], "%Y-%m-%d").month == target_month
    ]
    if not same_month_actual:
        return 5.0

    historical_avg = sum(day["revenue"] for day in same_month_actual) / len(same_month_actual)
    forecast_avg = sum(day["predictedRevenue"] for day in daily_forecast) / max(len(daily_forecast), 1)

    if historical_avg <= 0:
        return 0.0

    return round_money((forecast_avg / historical_avg - 1) * 100)


def compute_month_growth(
    daily_revenue: list[dict[str, Any]],
    target_month: int,
    daily_forecast: list[dict[str, Any]],
) -> float:
    same_month_actual = [
        day for day in daily_revenue
        if datetime.strptime(day["date"], "%Y-%m-%d").month == target_month
    ]
    if not same_month_actual:
        return 5.0

    historical_avg = sum(day["revenue"] for day in same_month_actual) / len(same_month_actual)
    forecast_avg = sum(day["predictedRevenue"] for day in daily_forecast) / max(len(daily_forecast), 1)

    if historical_avg <= 0:
        return 0.0

    return round_money((forecast_avg / historical_avg - 1) * 100)


def apply_external_signals(
    result: dict[str, Any],
    external_signals: dict[str, Any] | None,
) -> dict[str, Any]:
    if not external_signals:
        return result

    modifiers = external_signals.get("modifiers") or {}
    revenue_multiplier = float(modifiers.get("revenueMultiplier", 1) or 1)
    takeout_boost = float(modifiers.get("takeoutRatioBoost", 0) or 0)
    coffee_boost = float(modifiers.get("coffeeReorderBoost", 1) or 1)
    dairy_boost = float(modifiers.get("dairyReorderBoost", 1) or 1)

    forecasts = result.get("forecasts") or {}
    daily_forecast = forecasts.get("dailyForecast") or []

    for day in daily_forecast:
        day["predictedRevenue"] = round_money(day.get("predictedRevenue", 0) * revenue_multiplier)
        day["predictedOrders"] = max(
            0,
            int(round(day.get("predictedOrders", 0) * revenue_multiplier)),
        )

    target_month_revenue = round_money(sum(day["predictedRevenue"] for day in daily_forecast))
    target_month_orders = sum(day["predictedOrders"] for day in daily_forecast)

    stock_requirements = []
    for item in forecasts.get("stockRequirements") or []:
        name = str(item.get("itemName", "")).lower()
        boost = 1.0
        if "coffee" in name:
            boost = coffee_boost
        elif "milk" in name:
            boost = dairy_boost
        stock_requirements.append(
            {
                **item,
                "requiredUnits": round((item.get("requiredUnits", 0) or 0) * boost),
                "reorderQty": round((item.get("reorderQty", 0) or 0) * boost),
                "macroAdjusted": boost > 1,
            }
        )

    forecasts.update(
        {
            "dailyForecast": daily_forecast,
            "targetMonthRevenue": target_month_revenue,
            "targetMonthOrders": target_month_orders,
            "next7DaysRevenue": round_money(
                sum(day["predictedRevenue"] for day in daily_forecast[:7])
            ),
            "avgDailyRevenueNext7Days": round_money(
                sum(day["predictedRevenue"] for day in daily_forecast[:7])
                / max(min(7, len(daily_forecast)), 1)
            ),
            "stockRequirements": stock_requirements,
            "takeoutDemandBoostPercent": round(takeout_boost * 100),
            "tableToTakeoutShift": bool(modifiers.get("tableOccupancyShiftToTakeout")),
        }
    )

    recommendations = list(result.get("recommendations") or [])
    if modifiers.get("tableOccupancyShiftToTakeout"):
        recommendations.insert(
            0,
            {
                "type": "operations",
                "title": "Rain shifts demand to Takeout",
                "message": (
                    f"Elevated rain probability — expect +{round(takeout_boost * 100)}% "
                    "takeout/delivery mix vs dine-in."
                ),
                "priority": "medium",
            },
        )

    fx = external_signals.get("fx") or {}
    if fx.get("inflationRisk"):
        recommendations.insert(
            0,
            {
                "type": "revenue",
                "title": "Inflation / Cost Adjustment Risk",
                "message": (
                    f"USD/KHR volatility at {fx.get('volatilityPercent', 0)}% — review supplier "
                    "costs and pricing."
                ),
                "priority": "high",
            },
        )

    result["forecasts"] = forecasts
    result["recommendations"] = recommendations[:8]
    result["macroMarketInsights"] = external_signals.get("macroMarketInsights") or []
    result["insightBanners"] = external_signals.get("insightBanners") or []
    result["externalSignals"] = {
        "fx": fx,
        "weather": external_signals.get("weather"),
        "calendar": external_signals.get("calendar"),
        "modifiers": modifiers,
        "fetchedAt": external_signals.get("fetchedAt"),
    }
    return result


def run_prediction(payload: dict[str, Any]) -> dict[str, Any]:
    daily_revenue = payload.get("dailyRevenue", [])
    hourly_sales = payload.get("hourlySales", [])
    top_items = payload.get("topItems", [])
    inventory = payload.get("inventory", [])
    category_sales = payload.get("categorySales", [])

    target_month = int(payload.get("targetMonth") or (date.today().month % 12) + 1)
    target_year = int(payload.get("targetYear") or date.today().year)
    target_label = month_label(target_year, target_month)

    daily_frame = build_daily_frame(daily_revenue)
    daily_forecast, model_name, baseline = predict_target_month(
        daily_frame,
        target_year,
        target_month,
    )

    target_month_revenue = round_money(sum(day["predictedRevenue"] for day in daily_forecast))
    target_month_orders = sum(day["predictedOrders"] for day in daily_forecast)
    avg_daily_revenue = round_money(target_month_revenue / max(len(daily_forecast), 1))
    monthly_growth_percent = compute_month_growth(daily_revenue, target_month, daily_forecast)

    peak_hours = build_peak_hours(hourly_sales)
    top_categories = build_category_forecast(
        category_sales,
        target_month,
        target_year,
        target_month_revenue,
        target_month_orders,
    )
    stock_requirements = build_stock_requirements(top_categories, inventory, top_items)
    inventory_warnings = build_inventory_warnings(inventory, top_items)
    high_demand_alerts = build_high_demand_alerts(top_items, inventory)
    recommendations = build_recommendations(
        target_label,
        peak_hours,
        inventory_warnings,
        high_demand_alerts,
        target_month_revenue,
        monthly_growth_percent,
        top_categories,
        stock_requirements,
    )

    result = {
        "success": True,
        "targetPeriod": {
            "month": target_month,
            "year": target_year,
            "label": target_label,
        },
        "forecasts": {
            "targetMonthRevenue": target_month_revenue,
            "targetMonthOrders": target_month_orders,
            "next7DaysRevenue": round_money(
                sum(day["predictedRevenue"] for day in daily_forecast[:7])
            ),
            "avgDailyRevenueNext7Days": round_money(
                sum(day["predictedRevenue"] for day in daily_forecast[:7]) / min(7, len(daily_forecast))
            ),
            "weeklyGrowthPercent": monthly_growth_percent,
            "dailyForecast": daily_forecast,
            "peakHours": peak_hours,
            "expectedBusyHours": peak_hours[0]["label"] if peak_hours else "12:00 PM – 01:00 PM",
            "topCategories": top_categories,
            "stockRequirements": stock_requirements,
        },
        "inventoryWarnings": inventory_warnings,
        "highDemandAlerts": high_demand_alerts,
        "recommendations": recommendations,
        "trendChart": build_trend_chart(daily_revenue, daily_forecast),
        "meta": {
            "baselineDailyAverage": baseline,
            "model": model_name,
            "trainingSamples": len(daily_frame),
        },
    }

    return apply_external_signals(result, payload.get("externalSignals"))


def main() -> int:
    try:
        payload = load_input()
        result = run_prediction(payload)
        print(json.dumps(result))
        return 0
    except Exception as error:  # noqa: BLE001 - CLI boundary
        error_payload = {"success": False, "error": str(error)}
        print(json.dumps(error_payload), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
