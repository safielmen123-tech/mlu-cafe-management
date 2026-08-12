/**
 * Seeds 12 months of realistic Cambodian cafe sales (Aug 2025 – Jul 2026).
 * Run: npm run seed:sales:year
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const db = require('../../db');

const TAX_RATE = 0.1;
const START_DATE = new Date(2025, 7, 1); // Aug 1 2025
const END_DATE = new Date(2026, 6, 31); // Jul 31 2026
const TARGET_TABLES = [1, 2, 3, 4, 5, 6];
const PAYMENT_METHODS = ['Cash', 'Bank Scan'];

const CAMBODIAN_MENU = [
    { name: 'Cambodian Drip Coffee', category: 'Coffee', segment: 'Hot Coffee', price: 2.75, drinkType: 'hot' },
    { name: 'Hot Latte', category: 'Coffee', segment: 'Hot Coffee', price: 3.85, drinkType: 'hot' },
    { name: 'Cappuccino', category: 'Coffee', segment: 'Hot Coffee', price: 3.75, drinkType: 'hot' },
    { name: 'Hot Milk Tea', category: 'Coffee', segment: 'Hot Tea', price: 2.95, drinkType: 'hot' },
    { name: 'Ginger Honey Tea', category: 'Coffee', segment: 'Hot Tea', price: 3.15, drinkType: 'hot' },
    { name: 'Iced Coffee', category: 'Coffee', segment: 'Iced Coffee', price: 3.25, drinkType: 'iced' },
    { name: 'Iced Latte', category: 'Coffee', segment: 'Iced Coffee', price: 4.15, drinkType: 'iced' },
    { name: 'Iced Milk Tea', category: 'Coffee', segment: 'Iced Tea', price: 3.05, drinkType: 'iced' },
    { name: 'Passion Fruit Tea', category: 'Coffee', segment: 'Iced Tea', price: 3.45, drinkType: 'iced' },
    { name: 'Mango Smoothie', category: 'Coffee', segment: 'Smoothie', price: 4.25, drinkType: 'smoothie' },
    { name: 'Avocado Smoothie', category: 'Coffee', segment: 'Smoothie', price: 4.45, drinkType: 'smoothie' },
    { name: 'Coconut Smoothie', category: 'Coffee', segment: 'Smoothie', price: 4.15, drinkType: 'smoothie' },
    { name: 'Croissant', category: 'Bakery', segment: 'Bakery', price: 2.85, drinkType: 'bakery' },
    { name: 'Banana Cake', category: 'Bakery', segment: 'Bakery', price: 3.35, drinkType: 'bakery' },
    { name: 'Palm Sugar Cookie', category: 'Bakery', segment: 'Bakery', price: 2.45, drinkType: 'bakery' },
    { name: 'Khmer Baguette', category: 'Bakery', segment: 'Bakery', price: 2.65, drinkType: 'bakery' },
];

const MORNING_HOURS = [7, 8, 9, 10];
const LUNCH_HOURS = [11, 12, 13];
const AFTERNOON_HOURS = [14, 15, 16];
const EVENING_HOURS = [17, 18, 19, 20];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items, weightFn) {
    const weights = items.map(weightFn);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;
    for (let index = 0; index < items.length; index += 1) {
        roll -= weights[index];
        if (roll <= 0) return items[index];
    }
    return items[items.length - 1];
}

function pickOrderHour(month) {
    const isHotSeason = month >= 3 && month <= 5;
    const bucket = Math.random();
    if (isHotSeason && bucket < 0.35) return pickWeighted(AFTERNOON_HOURS, () => 1.4);
    if (bucket < 0.4) return pickWeighted(MORNING_HOURS, () => 1);
    if (bucket < 0.72) return pickWeighted(LUNCH_HOURS, () => 1.2);
    if (bucket < 0.9) return pickWeighted(AFTERNOON_HOURS, () => 1);
    return pickWeighted(EVENING_HOURS, () => 1);
}

function getSeasonProfile(month, day) {
    // Nov–Feb peak (+35%), hot drinks favored
    if (month === 11 || month === 12 || month <= 2) {
        return {
            name: 'peak',
            volumeMultiplier: 1.35,
            takeoutRatio: 0.18,
            weights: { hot: 5.5, iced: 1.2, smoothie: 0.8, tea: 2.2, bakery: 2.4 },
        };
    }

    // Mar–May hot season; Khmer New Year spike mid-April
    if (month >= 3 && month <= 5) {
        const knyBoost = month === 4 && day >= 12 && day <= 17 ? 1.45 : 1.15;
        return {
            name: 'hot',
            volumeMultiplier: knyBoost,
            takeoutRatio: 0.28,
            weights: { hot: 1.1, iced: 4.8, smoothie: 3.6, tea: 3.2, bakery: 1.4 },
        };
    }

    // Jun–Oct monsoon / Pchum Ben — balanced dine-in + delivery/takeout
    const pchumBenBoost = (month === 9 && day >= 10) || (month === 10 && day <= 15) ? 1.12 : 1.0;
    return {
        name: 'monsoon',
        volumeMultiplier: pchumBenBoost,
        takeoutRatio: 0.34,
        weights: { hot: 2.0, iced: 2.8, smoothie: 2.2, tea: 2.4, bakery: 2.6 },
    };
}

function getDailyOrderCount(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = date.getDay();
    const profile = getSeasonProfile(month, day);

    const base = randomInt(9, 16);
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.18 : 1;
    const weekdayDip = weekday === 1 ? 0.88 : 1;
    return Math.max(4, Math.round(base * profile.volumeMultiplier * weekendBoost * weekdayDip));
}

function drinkTypeWeight(item, profile) {
    if (item.segment === 'Hot Tea' || item.segment === 'Iced Tea') return profile.weights.tea;
    const type = item.drinkType;
    if (type === 'hot') return profile.weights.hot;
    if (type === 'iced') return profile.weights.iced;
    if (type === 'smoothie') return profile.weights.smoothie;
    return profile.weights.bakery;
}

function buildOrderLines(menuItems, profile, hour) {
    const lineCount = randomInt(1, 3);
    const lines = [];
    const coffeePeak = MORNING_HOURS.includes(hour) || LUNCH_HOURS.includes(hour);

    for (let index = 0; index < lineCount; index += 1) {
        const item = pickWeighted(menuItems, (menuItem) => {
            let weight = drinkTypeWeight(menuItem, profile);
            if (coffeePeak && (menuItem.drinkType === 'hot' || menuItem.drinkType === 'iced')) {
                weight *= 1.35;
            }
            return weight;
        });

        const quantity = randomInt(1, item.category === 'Bakery' ? 3 : 2);
        const price = Number.parseFloat(item.price);
        lines.push({
            menu_item_id: item.id,
            quantity,
            price,
            lineTotal: quantity * price,
        });
    }

    return lines;
}

function formatInvoiceId(counter) {
    return `INV-${String(counter).padStart(6, '0')}`;
}

async function ensureMenuItems() {
    const [rows] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id');

    if (rows.length === 0) {
        for (const item of CAMBODIAN_MENU) {
            await db.execute(
                'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, TRUE)',
                [item.name, item.category, item.price],
            );
        }
    } else {
        const names = new Set(rows.map((row) => row.name.toLowerCase()));
        for (const item of CAMBODIAN_MENU) {
            if (!names.has(item.name.toLowerCase())) {
                await db.execute(
                    'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, TRUE)',
                    [item.name, item.category, item.price],
                );
            }
        }
    }

    const [allRows] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id');
    const menuByName = new Map(allRows.map((row) => [row.name.toLowerCase(), row]));

    return CAMBODIAN_MENU.map((item) => {
        const dbItem = menuByName.get(item.name.toLowerCase());
        return {
            ...item,
            id: dbItem.id,
            price: Number.parseFloat(dbItem.price),
            category: dbItem.category,
        };
    }).filter((item) => item.id);
}

async function wipeSalesData() {
    await db.execute('DELETE FROM order_items');
    await db.execute('DELETE FROM orders');
}

async function insertCompletedOrder(menuItems, orderDate, invoiceCounter, profile) {
    const hour = pickOrderHour(orderDate.getMonth() + 1);
    orderDate.setHours(hour, randomInt(0, 59), randomInt(0, 59), 0);

    const lines = buildOrderLines(menuItems, profile, hour);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    const paymentMethod = PAYMENT_METHODS[Math.random() < 0.56 ? 0 : 1];
    const isTakeOut = Math.random() < profile.takeoutRatio;
    const sourceType = isTakeOut ? 'Take Out' : 'Table';
    const tableTargetId = isTakeOut ? null : TARGET_TABLES[randomInt(0, TARGET_TABLES.length - 1)];
    const timestamp = orderDate.toISOString().slice(0, 19).replace('T', ' ');

    const [orderResult] = await db.execute(
        `INSERT INTO orders
            (target_id, table_id, source_type, total_amount, payment_type, status,
             invoice_id, payment_method, subtotal, tax, total, created_at, updated_at)
         VALUES (?, NULL, ?, ?, ?, 'Completed', ?, ?, ?, ?, ?, ?, ?)`,
        [
            tableTargetId,
            sourceType,
            total,
            paymentMethod,
            formatInvoiceId(invoiceCounter),
            paymentMethod,
            subtotal,
            tax,
            total,
            timestamp,
            timestamp,
        ],
    );

    const orderId = orderResult.insertId;
    for (const line of lines) {
        await db.execute(
            `INSERT INTO order_items (order_id, menu_item_id, quantity, price, subtotal)
             VALUES (?, ?, ?, ?, ?)`,
            [orderId, line.menu_item_id, line.quantity, line.price, line.lineTotal],
        );
    }

    return { total, paymentMethod, sourceType };
}

function eachDay(start, end, callback) {
    const cursor = new Date(start);
    while (cursor <= end) {
        callback(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
}

async function seedSalesHistory() {
    console.log('Ensuring Cambodian cafe menu catalog...');
    const menuItems = await ensureMenuItems();
    console.log(`Loaded ${menuItems.length} menu items.`);

    console.log('Wiping existing orders and order_items...');
    await wipeSalesData();

    let invoiceCounter = 200001;
    let totalOrders = 0;
    let totalRevenue = 0;
    let takeoutOrders = 0;
    const monthStats = {};

    console.log('Generating 12 months of sales (Aug 2025 – Jul 2026)...');

    const days = [];
    eachDay(START_DATE, END_DATE, (day) => days.push(new Date(day)));

    for (const day of days) {
        const monthKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
        const profile = getSeasonProfile(day.getMonth() + 1, day.getDate());
        const orderCount = getDailyOrderCount(day);

        if (!monthStats[monthKey]) {
            monthStats[monthKey] = { orders: 0, revenue: 0, takeout: 0, season: profile.name };
        }

        for (let index = 0; index < orderCount; index += 1) {
            const orderDate = new Date(day);
            const result = await insertCompletedOrder(menuItems, orderDate, invoiceCounter, profile);
            invoiceCounter += 1;
            totalOrders += 1;
            totalRevenue += result.total;
            monthStats[monthKey].orders += 1;
            monthStats[monthKey].revenue += result.total;
            if (result.sourceType === 'Take Out') {
                takeoutOrders += 1;
                monthStats[monthKey].takeout += 1;
            }
        }
    }

    const [summary] = await db.execute(`
        SELECT
            COUNT(*) AS order_count,
            MIN(updated_at) AS earliest_sale,
            MAX(updated_at) AS latest_sale,
            SUM(total) AS gross_revenue
        FROM orders
        WHERE status = 'Completed'
    `);

    const [categorySummary] = await db.execute(`
        SELECT m.category, SUM(oi.quantity) AS units_sold, SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN menu_items m ON m.id = oi.menu_item_id
        GROUP BY m.category
        ORDER BY units_sold DESC
    `);

    console.log('');
    console.log('12-month Cambodian sales seed completed.');
    console.log(JSON.stringify(summary[0], null, 2));
    console.log('');
    console.log('Monthly breakdown:');
    Object.entries(monthStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([monthKey, stats]) => {
            console.log(
                `  ${monthKey} [${stats.season}]: ${stats.orders} orders, `
                + `$${stats.revenue.toFixed(2)} revenue, ${stats.takeout} takeout`,
            );
        });
    console.log('');
    console.log('Top categories:');
    categorySummary.forEach((row, index) => {
        console.log(
            `  ${index + 1}. ${row.category} — ${row.units_sold} units, `
            + `$${Number.parseFloat(row.revenue).toFixed(2)}`,
        );
    });
    console.log('');
    console.log(`Takeout share: ${((takeoutOrders / totalOrders) * 100).toFixed(1)}%`);
    console.log(`Total seeded orders: ${totalOrders}`);
    console.log(`Total seeded revenue: $${totalRevenue.toFixed(2)}`);
}

seedSalesHistory()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Sales seed failed:', error.message);
        process.exit(1);
    });
