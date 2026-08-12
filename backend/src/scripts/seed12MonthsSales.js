/**
 * Seeds 12 months of realistic Cambodian cafe sales (Aug 1 2025 – Jul 31 2026).
 * Run: npm run seed:12months
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const db = require('../../db');

const TAX_RATE = 0.1;
const START_DATE = new Date(2025, 7, 1);
const END_DATE = new Date(2026, 6, 31);
const PAYMENT_METHODS = ['Cash', 'Bank Scan'];
const INVOICE_PREFIX = 'RC-';

const CAMBODIAN_MENU = [
    { name: 'Americano', category: 'Coffee', segment: 'Hot Coffee', price: 3.25, drinkType: 'hot' },
    { name: 'Hot Latte', category: 'Coffee', segment: 'Hot Coffee', price: 3.85, drinkType: 'hot' },
    { name: 'Cambodian Drip Coffee', category: 'Coffee', segment: 'Hot Coffee', price: 2.75, drinkType: 'hot' },
    { name: 'Cappuccino', category: 'Coffee', segment: 'Hot Coffee', price: 3.75, drinkType: 'hot' },
    { name: 'Hot Milk Tea', category: 'Coffee', segment: 'Hot Tea', price: 2.95, drinkType: 'hot' },
    { name: 'Ginger Honey Tea', category: 'Coffee', segment: 'Hot Tea', price: 3.15, drinkType: 'hot' },
    { name: 'Iced Latte', category: 'Coffee', segment: 'Iced Coffee', price: 4.15, drinkType: 'iced' },
    { name: 'Iced Coffee', category: 'Coffee', segment: 'Iced Coffee', price: 3.25, drinkType: 'iced' },
    { name: 'Passion Fruit Tea', category: 'Coffee', segment: 'Iced Tea', price: 3.45, drinkType: 'iced' },
    { name: 'Iced Milk Tea', category: 'Coffee', segment: 'Iced Tea', price: 3.05, drinkType: 'iced' },
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
    if (isHotSeason && bucket < 0.38) return pickWeighted(AFTERNOON_HOURS, () => 1.5);
    if (bucket < 0.42) return pickWeighted(MORNING_HOURS, () => 1);
    if (bucket < 0.74) return pickWeighted(LUNCH_HOURS, () => 1.2);
    if (bucket < 0.9) return pickWeighted(AFTERNOON_HOURS, () => 1);
    return pickWeighted(EVENING_HOURS, () => 1);
}

function getSeasonProfile(month, day) {
    // Nov–Feb: high season & cool weather (+35% volume, hot coffee focus)
    if (month === 11 || month === 12 || month <= 2) {
        return {
            name: 'high-season',
            volumeMultiplier: 1.35,
            takeoutRatio: 0.16,
            weights: { hot: 6.2, iced: 0.9, smoothie: 0.7, tea: 2.0, bakery: 2.2 },
        };
    }

    // Mar–May: hot season & Khmer New Year (+25% iced mix, April surge)
    if (month >= 3 && month <= 5) {
        const knySurge = month === 4 && day >= 13 && day <= 16 ? 1.55 : 1.12;
        return {
            name: 'hot-season',
            volumeMultiplier: knySurge,
            takeoutRatio: 0.26,
            icedBoost: 1.25,
            weights: { hot: 0.9, iced: 5.5, smoothie: 4.2, tea: 3.8, bakery: 1.3 },
        };
    }

    // Jun–Oct & Jul boundary: rainy/monsoon + Pchum Ben (balanced, more takeout)
    const pchumBenSurge =
        (month === 9 && day >= 18) || (month === 10 && day <= 8) ? 1.18 : 1.0;
    return {
        name: 'rainy-season',
        volumeMultiplier: pchumBenSurge,
        takeoutRatio: 0.38,
        weights: { hot: 2.1, iced: 2.6, smoothie: 2.0, tea: 2.2, bakery: 2.5 },
    };
}

function getDailyOrderCount(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = date.getDay();
    const profile = getSeasonProfile(month, day);

    const base = randomInt(10, 17);
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.2 : 1;
    const weekdayDip = weekday === 1 ? 0.9 : 1;
    return Math.max(5, Math.round(base * profile.volumeMultiplier * weekendBoost * weekdayDip));
}

function drinkTypeWeight(item, profile) {
    if (item.segment === 'Hot Tea' || item.segment === 'Iced Tea') return profile.weights.tea;
    const type = item.drinkType;
    if (type === 'hot') return profile.weights.hot;
    if (type === 'iced') return profile.weights.iced * (profile.icedBoost ?? 1);
    if (type === 'smoothie') return profile.weights.smoothie * (profile.icedBoost ?? 1);
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
                weight *= 1.3;
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
    return `${INVOICE_PREFIX}${String(counter).padStart(6, '0')}`;
}

function eachDay(start, end, callback) {
    const cursor = new Date(start);
    while (cursor <= end) {
        callback(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
}

async function ensureMenuItems() {
    const [rows] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id');

    const names = new Set(rows.map((row) => row.name.toLowerCase()));
    for (const item of CAMBODIAN_MENU) {
        if (!names.has(item.name.toLowerCase())) {
            await db.execute(
                'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, TRUE)',
                [item.name, item.category, item.price],
            );
        }
    }

    const [allRows] = await db.execute('SELECT id, name, category, price FROM menu_items ORDER BY id');
    const menuByName = new Map(allRows.map((row) => [row.name.toLowerCase(), row]));

    const resolved = CAMBODIAN_MENU.map((item) => {
        const dbItem = menuByName.get(item.name.toLowerCase());
        if (!dbItem) return null;
        return {
            ...item,
            id: dbItem.id,
            price: Number.parseFloat(dbItem.price),
            category: dbItem.category,
        };
    }).filter(Boolean);

    if (!resolved.length) {
        throw new Error('No menu items available — cannot seed order_items foreign keys.');
    }

    return resolved;
}

async function ensureFloorTables() {
    const [rows] = await db.execute('SELECT id FROM tables ORDER BY id');
    if (!rows.length) {
        throw new Error('No floor tables found. Run backend/seeds/004_floor_tables.sql first.');
    }
    return rows.map((row) => row.id);
}

async function validateForeignKeys(menuItems, tableIds) {
    const [itemCheck] = await db.execute(
        `SELECT COUNT(*) AS count FROM menu_items WHERE id IN (${menuItems.map(() => '?').join(', ')})`,
        menuItems.map((item) => item.id),
    );
    if (Number(itemCheck[0].count) !== menuItems.length) {
        throw new Error('Menu item foreign key validation failed.');
    }

    const [tableCheck] = await db.execute(
        `SELECT COUNT(*) AS count FROM tables WHERE id IN (${tableIds.map(() => '?').join(', ')})`,
        tableIds,
    );
    if (Number(tableCheck[0].count) !== tableIds.length) {
        throw new Error('Table foreign key validation failed.');
    }
}

async function wipeSalesData() {
    await db.execute('DELETE FROM order_items');
    await db.execute('DELETE FROM orders');
}

async function insertCompletedOrder(menuItems, tableIds, orderDate, invoiceCounter, profile) {
    const hour = pickOrderHour(orderDate.getMonth() + 1);
    orderDate.setHours(hour, randomInt(0, 59), randomInt(0, 59), 0);

    const lines = buildOrderLines(menuItems, profile, hour);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const tax = roundMoney(subtotal * TAX_RATE);
    const total = roundMoney(subtotal + tax);
    const paymentMethod = PAYMENT_METHODS[Math.random() < 0.55 ? 0 : 1];
    const isTakeOut = Math.random() < profile.takeoutRatio;
    const sourceType = isTakeOut ? 'Take Out' : 'Table';
    const tableId = isTakeOut ? null : tableIds[randomInt(0, tableIds.length - 1)];
    const timestamp = orderDate.toISOString().slice(0, 19).replace('T', ' ');

    const [orderResult] = await db.execute(
        `INSERT INTO orders
            (target_id, table_id, source_type, total_amount, payment_type, status,
             invoice_id, payment_method, subtotal, tax, total, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Completed', ?, ?, ?, ?, ?, ?, ?)`,
        [
            tableId,
            tableId,
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

    return { total, sourceType };
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

async function seed12MonthsSales() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Romdoul Cafe — 12-Month Sales Seed');
    console.log('  Period: August 2025 → July 2026');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    console.log('[1/4] Ensuring menu catalog & floor tables...');
    const menuItems = await ensureMenuItems();
    const tableIds = await ensureFloorTables();
    await validateForeignKeys(menuItems, tableIds);
    console.log(`      ✓ ${menuItems.length} menu items linked`);
    console.log(`      ✓ ${tableIds.length} floor tables linked`);

    console.log('[2/4] Clearing existing sales data...');
    await wipeSalesData();
    console.log('      ✓ orders & order_items wiped');

    console.log('[3/4] Generating daily transactions with seasonal patterns...');

    let invoiceCounter = 300001;
    let totalOrders = 0;
    let totalRevenue = 0;
    let takeoutOrders = 0;
    const monthStats = {};

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
            const result = await insertCompletedOrder(
                menuItems,
                tableIds,
                orderDate,
                invoiceCounter,
                profile,
            );
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

    console.log('      ✓ Daily generation complete');

    console.log('[4/4] Verifying database totals...');
    const [summary] = await db.execute(`
        SELECT
            COUNT(*) AS order_count,
            MIN(updated_at) AS earliest_sale,
            MAX(updated_at) AS latest_sale,
            SUM(total) AS gross_revenue
        FROM orders
        WHERE status = 'Completed'
    `);

    const hundreds = Math.floor(totalOrders / 100);

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total orders generated : ${totalOrders.toLocaleString()} (${hundreds}+ hundred orders)`);
    console.log(`  Gross revenue          : $${totalRevenue.toFixed(2)}`);
    console.log(`  Take-out share         : ${((takeoutOrders / totalOrders) * 100).toFixed(1)}%`);
    console.log(`  Date range             : ${summary[0].earliest_sale} → ${summary[0].latest_sale}`);
    console.log('');
    console.log('  Monthly breakdown:');
    Object.entries(monthStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([monthKey, stats]) => {
            const label = stats.season.replace('-', ' ');
            console.log(
                `    ${monthKey}  ${String(stats.orders).padStart(4)} orders  `
                + `$${stats.revenue.toFixed(2).padStart(9)}  `
                + `[${label}]  ${stats.takeout} takeout`,
            );
        });
    console.log('');
    console.log('  Foreign keys verified: menu_item_id ✓  table_id ✓');
    console.log('═══════════════════════════════════════════════════════');
}

seed12MonthsSales()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('');
        console.error('❌ 12-month sales seed failed:', error.message);
        process.exit(1);
    });
