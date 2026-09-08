const { assertRequiredEnv, env } = require('./src/config/env');
const { STORE } = require('./src/config/store');
assertRequiredEnv();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./db'); // Import our database connection pool
const { resolveDbHost } = require('./db');
const {
    normalizeIncomingTarget,
    targetIdSelectSql,
    findPendingOrderId,
    createPendingOrder,
    insertOrderItem,
    logOrderError,
    pendingOrderWhereClause,
    resolveTableForeignKey,
    ensureOrderItemsSchema,
    formatOrderLineName,
} = require('./src/utils/orderTargets');
const { normalizePermissions, isAdminRole, VALID_PERMISSIONS } = require('./src/constants/permissions');
const {
    authenticateToken,
    requireAdmin,
    requirePermission,
    requireAnyPermission,
} = require('./src/middleware/auth');
const multer = require('multer');
const { exportBusinessDataBuffer } = require('./src/utils/backupExport');
const { createDatabaseDump, restoreDatabaseFromSql } = require('./src/utils/backupSql');
const { parseBackupPeriod, buildBackupFilename } = require('./src/utils/backupPeriod');
const { buildActiveAlerts } = require('./src/utils/alertEngine');
const {
    ensureMenuItemsImageSchema,
    normalizeMenuImageUrl,
    serializeMenuItem,
} = require('./src/utils/menuItemsSchema');
const { buildSalesReport } = require('./src/utils/reports');
const {
    ensureInventorySchema,
    resolveStockStatus,
} = require('./src/utils/inventorySchema');
const { ensureOrdersSchema } = require('./src/utils/ordersSchema');
const {
    ensureExpensesSchema,
    listExpenses,
    createExpense,
    deleteExpense,
    summarizeExpensesToday,
} = require('./src/utils/expenses');
const {
    ensureAuditSchema,
    writeAuditLog,
    auditFromRequest,
    listAuditLogs,
} = require('./src/utils/auditLog');
const helmet = require('helmet');
const { sanitizeRequest } = require('./src/middleware/sanitize');
const { apiLimiter, sensitiveOperationLimiter } = require('./src/middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { logError, logSecurity } = require('./src/utils/logger');
const { publicAuthRouter, privateAuthRouter, rejectPublicSignup } = require('./src/routes/auth');
const { listUnreadUserAlerts, markNotificationRead, ensureAdminNotificationsSchema } = require('./src/utils/adminNotifications');
const { ensureUsersEmailColumn } = require('./src/utils/userAccounts');
const {
    ensureReservationsSchema,
    listFloorTables,
    listReservations,
    getReservation,
    createReservation,
    updateReservation,
    checkInReservation,
    deleteReservation,
    getAvailableTables,
    getLiveFloorReservations,
    TIME_SLOTS,
    ALL_STATUSES,
} = require('./src/utils/reservations');
const { processReservationReminders, startReservationReminderJob } = require('./src/utils/reservationReminders');
const { sendReservationConfirmationLetter } = require('./src/utils/reservationLetter');

const app = express();

// Behind a reverse proxy this makes req.ip the real client address so rate limiting
// keys correctly. Left off by default: trusting the header without a proxy in front
// would let anyone spoof X-Forwarded-For and bypass the login limiter.
app.set('trust proxy', env.security.trustProxy ? 1 : false);
app.disable('x-powered-by');

app.use(helmet({
    // The API serves JSON plus menu photo downloads; it never renders HTML itself.
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
        },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

const allowedOrigins = env.security.allowedOrigins;
app.use(cors({
    origin(origin, callback) {
        // Same-origin and server-to-server calls arrive without an Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
        logSecurity('cors_blocked', { origin });
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
}));

// Bounded body size keeps a single request from exhausting memory.
app.use(express.json({ limit: env.security.jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.security.jsonBodyLimit }));
app.use(sanitizeRequest);

// ==========================================
// 🔐 PUBLIC AUTH (login, password reset — no JWT)
// ==========================================
app.use('/api/auth', publicAuthRouter);
app.post('/api/register', rejectPublicSignup);
app.post('/api/signup', rejectPublicSignup);
app.get('/api/register', rejectPublicSignup);
app.get('/api/signup', rejectPublicSignup);

// ==========================================
// 🔐 AUTHENTICATED API ROUTES (JWT + live DB permissions)
// ==========================================
app.use('/api', apiLimiter, authenticateToken);
app.use('/api/auth', privateAuthRouter);

// ==========================================
// 👥 EMPLOYEES & USER MANAGEMENT API ROUTES
// ==========================================

function serializePermissionsForRole(role, permissions) {
    if (isAdminRole(role)) {
        return JSON.stringify(VALID_PERMISSIONS);
    }
    return JSON.stringify(normalizePermissions(permissions));
}

// 1. FETCH ALL USER PROFILES WITH SYSTEM PERMISSIONS
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, display_name, username, role, permissions
             FROM users
             ORDER BY CASE WHEN LOWER(role) = 'admin' THEN 0 ELSE 1 END, display_name ASC`,
        );
        
        // Safely parse the permissions JSON string back into an array for React
        const users = rows.map((u) => ({
            id: u.id,
            display_name: u.display_name,
            username: u.username,
            role: u.role,
            permissions: normalizePermissions(u.permissions),
        }));

        res.status(200).json(users);
    } catch (error) {
        console.error("❌ FETCH USERS ERROR:", error.message);
        res.status(500).json({ message: "Failed to load employee profiles" });
    }
});

// 2. REGISTER A SECURE ACCOUNT WITH ENCRYPTED PASSWORD
app.post('/api/users', requireAdmin, async (req, res) => {
    const { display_name, username, password, role, permissions } = req.body ?? {};

    if (!display_name || !username || !password) {
        return res.status(400).json({ message: "All identification boxes are required" });
    }

    const trimmedPassword = String(password).trim();
    if (trimmedPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    try {
        const normalizedUsername = String(username).trim().toLowerCase();
        const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [normalizedUsername]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Username is already taken" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(trimmedPassword, saltRounds);
        const permissionsString = serializePermissionsForRole(role, permissions);

        await db.execute(
            'INSERT INTO users (display_name, username, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)',
            [display_name, normalizedUsername, passwordHash, role || 'Staff', permissionsString]
        );

        res.status(201).json({ message: "New user profile established securely!" });
    } catch (error) {
        console.error("❌ CREATE USER ERROR:", error.message);
        res.status(500).json({ message: "Failed to build secure user account" });
    }
});

// 3. UPDATE USER ROLE & PERMISSION GATES IN REAL TIME
app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    const { display_name, role, permissions, password } = req.body ?? {};

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!display_name || !role) {
        return res.status(400).json({ message: 'Display name and role are required' });
    }

    try {
        const [existingRows] = await db.execute(
            'SELECT id FROM users WHERE id = ? LIMIT 1',
            [userId],
        );
        if (!existingRows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const normalizedPermissions = serializePermissionsForRole(role, permissions);
        const trimmedPassword = password != null ? String(password).trim() : '';

        if (trimmedPassword) {
            if (trimmedPassword.length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters.' });
            }

            const passwordHash = await bcrypt.hash(trimmedPassword, 10);
            await db.execute(
                `UPDATE users
                 SET display_name = ?, role = ?, permissions = ?, password_hash = ?
                 WHERE id = ?`,
                [display_name, role, normalizedPermissions, passwordHash, userId],
            );
        } else {
            await db.execute(
                `UPDATE users
                 SET display_name = ?, role = ?, permissions = ?
                 WHERE id = ?`,
                [display_name, role, normalizedPermissions, userId],
            );
        }

        const [updatedRows] = await db.execute(
            'SELECT id, display_name, username, role, permissions FROM users WHERE id = ? LIMIT 1',
            [userId],
        );

        const updated = updatedRows[0]
        const updatedUser = {
            id: updated.id,
            display_name: updated.display_name,
            username: updated.username,
            role: updated.role,
            permissions: normalizePermissions(updated.permissions),
        };

        res.status(200).json({
            message: 'User permissions updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        console.error('❌ UPDATE USER ERROR:', error.message);
        res.status(500).json({ message: 'Failed to update user permissions' });
    }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Invalid user id' });
    }

    if (Number(req.user?.id) === userId) {
        return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    try {
        const [existingRows] = await db.execute(
            'SELECT id, display_name, username, role FROM users WHERE id = ? LIMIT 1',
            [userId],
        );
        if (!existingRows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const target = existingRows[0];
        if (isAdminRole(target.role)) {
            const [adminCountRows] = await db.execute(
                `SELECT COUNT(*) AS admin_count FROM users WHERE LOWER(role) = 'admin'`,
            );
            if (Number(adminCountRows[0]?.admin_count || 0) <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last administrator account.' });
            }
        }

        try {
            await db.execute('DELETE FROM admin_notifications WHERE recipient_user_id = ?', [userId]);
        } catch (notificationError) {
            if (notificationError.code !== 'ER_NO_SUCH_TABLE') {
                throw notificationError;
            }
        }

        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await auditFromRequest(db, req, {
            action: 'user_delete',
            module: 'User Management',
            description: `Deleted user ${target.username} (${target.display_name})`,
        });

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('❌ DELETE USER ERROR:', error.message);
        res.status(500).json({
            message: 'Failed to delete user',
            errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }),
        });
    }
});

// ==========================================
// ☕ MENU MANAGEMENT API ROUTES
// ==========================================

// 1. GET ALL MENU ITEMS (To display them on your frontend grid)
app.get('/api/menu', async (req, res) => {
    try {
        const [items] = await db.execute(
            'SELECT id, name, category, price, image_url, is_available FROM menu_items ORDER BY category, name',
        );
        res.status(200).json(items.map(serializeMenuItem));
    } catch (error) {
        console.error("Error fetching menu items:", error);
        res.status(500).json({ message: "Failed to load menu items" });
    }
});

// 2. ADD A NEW MENU ITEM (When you click 'Add Item' on your management page)
app.post('/api/menu', requirePermission('menu'), async (req, res) => {
    const { name, category, price, image_url } = req.body ?? {};
    const priceNum = Number(price);

    if (!name || !category || !Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: 'Please fill in all fields (Name, Category, Price)' });
    }

    const normalizedImageUrl = normalizeMenuImageUrl(image_url);

    try {
        const query =
            'INSERT INTO menu_items (name, category, price, image_url, is_available) VALUES (?, ?, ?, ?, TRUE)';
        const [result] = await db.execute(query, [name, category, priceNum, normalizedImageUrl]);

        await auditFromRequest(db, req, {
            action: 'menu_create',
            module: 'Menu Management',
            description: `Created menu item "${name}" at $${priceNum.toFixed(2)}`,
        });

        res.status(201).json({
            message: 'Item added successfully!',
            item: {
                id: result.insertId,
                name,
                category,
                price: priceNum,
                image_url: normalizedImageUrl,
                is_available: true,
            },
        });
    } catch (error) {
        console.error('Error adding menu item:', error);
        res.status(500).json({ message: 'Failed to save the new item' });
    }
});

// 3. EDIT AN EXISTING MENU ITEM (Fixes your click/modify actions)
app.put('/api/menu/:id', requirePermission('menu'), async (req, res) => {
    const itemId = Number.parseInt(req.params.id, 10);
    const { name, category, price, image_url } = req.body ?? {};
    const priceNum = Number(price);

    if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ message: 'Invalid menu item id' });
    }

    if (!name || !category || !Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: 'Please fill in all fields to complete update' });
    }

    const normalizedImageUrl = normalizeMenuImageUrl(image_url);

    try {
        const query =
            'UPDATE menu_items SET name = ?, category = ?, price = ?, image_url = ? WHERE id = ?';
        const [result] = await db.execute(query, [name, category, priceNum, normalizedImageUrl, itemId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }

        await auditFromRequest(db, req, {
            action: 'menu_update',
            module: 'Menu Management',
            description: `Updated menu item #${itemId} "${name}" (price $${priceNum.toFixed(2)})`,
        });

        res.status(200).json({ message: 'Item updated successfully!' });
    } catch (error) {
        console.error('Error modifying menu item:', error);
        res.status(500).json({ message: 'Failed to update item details' });
    }
});

// 4. DELETE A MENU ITEM (When clicking the delete/trash icon on a menu card)
app.delete('/api/menu/:id', requirePermission('menu'), async (req, res) => {
    const itemId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ message: 'Invalid menu item id' });
    }

    try {
        const [result] = await db.execute('DELETE FROM menu_items WHERE id = ?', [itemId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        await auditFromRequest(db, req, {
            action: 'menu_delete',
            module: 'Menu Management',
            description: `Deleted menu item #${itemId}`,
        });

        res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting menu item:", error);
        res.status(500).json({ message: "Failed to delete the item" });
    }
});

// ==========================================
// 📋 ACTIVE ORDERING & POS API ROUTES
// ==========================================

// 1. GET ACTIVE (PENDING) ORDERS FOR BILL RECONCILIATION
app.get('/api/orders/active', async (req, res) => {
    const targetSelect = targetIdSelectSql('o');
    try {
        const query = `
            SELECT o.id AS order_id, ${targetSelect} AS target_id, o.status,
                   COALESCE(o.bill_requested, 0) AS bill_requested,
                   oi.menu_item_id, oi.quantity, oi.price, oi.notes,
                   COALESCE(m.name, oi.item_name, 'Custom item') AS name
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menu_items m ON oi.menu_item_id = m.id
            WHERE o.status = 'Pending'
        `;
        const [results] = await db.execute(query);
        res.status(200).json(results.map((row) => ({
            ...row,
            notes: row.notes || '',
            name: formatOrderLineName(row.name, row.notes),
            bill_requested: Number(row.bill_requested) ? 1 : 0,
        })));
    } catch (error) {
        if (error.message && error.message.includes('bill_requested')) {
            try {
                const fallbackQuery = `
                    SELECT o.id AS order_id, ${targetSelect} AS target_id, o.status,
                           oi.menu_item_id, oi.quantity, oi.price, oi.notes,
                           COALESCE(m.name, oi.item_name, 'Custom item') AS name
                    FROM orders o
                    JOIN order_items oi ON o.id = oi.order_id
                    LEFT JOIN menu_items m ON oi.menu_item_id = m.id
                    WHERE o.status = 'Pending'
                `;
                const [results] = await db.execute(fallbackQuery);
                res.status(200).json(results.map((row) => ({
                    ...row,
                    notes: row.notes || '',
                    name: formatOrderLineName(row.name, row.notes),
                    bill_requested: 0,
                })));
                return;
            } catch (fallbackError) {
                logOrderError('DATABASE ERROR IN /api/orders/active (fallback)', fallbackError);
            }
        } else {
            logOrderError('DATABASE ERROR IN /api/orders/active', error);
        }
        res.status(500).json({ message: 'Failed to load active orders', errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }) });
    }
});

// 2. DISPATCH/MERGE ORDER ITEMS INTO TARGET TICKETS
app.post('/api/orders', async (req, res) => {
    const { target_id, items, table_id } = req.body ?? {};

    if (!target_id || !Array.isArray(items) || !items.length) {
        return res.status(400).json({ message: 'Missing table target or checkout lines' });
    }

    const invalidLine = items.find((item) => {
        const qty = Number(item?.quantity ?? item?.qty);
        const price = Number(item?.price ?? item?.unitPrice);
        return !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0;
    });
    if (invalidLine) {
        return res.status(400).json({ message: 'Each order line needs a valid quantity and price' });
    }

    let target;
    try {
        target = normalizeIncomingTarget(target_id);
    } catch (validationError) {
        console.error('❌ Order target validation failed:', validationError.message, { target_id });
        return res.status(400).json({ message: validationError.message });
    }

    try {
        let orderId = await findPendingOrderId(db, target);

        if (!orderId) {
            orderId = await createPendingOrder(db, target, table_id);
        }

        for (const item of items) {
            await insertOrderItem(db, orderId, item);
        }

        res.status(201).json({
            message: "Order stored securely in database!",
            orderId,
            target_key: target.key,
            source_type: target.sourceType,
        });

        await auditFromRequest(db, req, {
            action: 'order_place',
            module: 'Order',
            description: `Placed/merged ${items.length} item(s) for ${target.key === 'takeout' ? 'Take Out' : `Table ${target.key}`}`,
        });
    } catch (error) {
        logOrderError('DATABASE ERROR IN POST /api/orders', error, {
            target_id,
            normalized_target: target.key,
            source_type: target.sourceType,
            item_count: items.length,
        });
        res.status(500).json({
            message: "Database failure mapping shopping cart values",
            errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }),
        });
    }
});

// 3. PROCESS PAYMENT / FINAL TRANSACTION CHECKOUT
app.post('/api/orders/checkout', async (req, res) => {
    const {
        invoice_id,
        target_id,
        payment_method,
        subtotal,
        table_id,
    } = req.body ?? {};

    if (!target_id) {
        return res.status(400).json({ message: 'Missing target_id for checkout' });
    }

    const method = typeof payment_method === 'string' ? payment_method.trim() : '';
    if (!method) {
        return res.status(400).json({ message: 'Missing payment_method for checkout' });
    }

    const subtotalNum = Number(subtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
        return res.status(400).json({ message: 'Checkout requires a valid subtotal' });
    }
    const taxNum = 0;
    const totalNum = subtotalNum;

    let target;
    try {
        target = normalizeIncomingTarget(target_id);
    } catch (validationError) {
        console.error('❌ Checkout target validation failed:', validationError.message, { target_id });
        return res.status(400).json({ message: validationError.message });
    }

    try {
        const { sql, params } = pendingOrderWhereClause(target);
        let orderId = await findPendingOrderId(db, target);

        if (!orderId) {
            orderId = await createPendingOrder(db, target, table_id);
        }

        const resolvedTableId =
            target.sourceType === 'Take Out' ? null : await resolveTableForeignKey(db, table_id ?? target.tableId);

        const checkoutQuery = `
            UPDATE orders
            SET invoice_id = ?, payment_method = ?, payment_type = ?, subtotal = ?, tax = ?, total = ?,
                total_amount = ?, table_id = ?, status = 'Completed', updated_at = NOW()
            WHERE id = ? AND ${sql}
        `;

        const [result] = await db.execute(checkoutQuery, [
            invoice_id || null,
            method,
            method,
            subtotalNum,
            taxNum,
            totalNum,
            totalNum,
            resolvedTableId,
            orderId,
            ...params,
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'No active ticket session found for this target.' });
        }

        await auditFromRequest(db, req, {
            action: 'payment_process',
            module: 'Payment',
            description: `Payment received via ${method} for ${
                target.key === 'takeout' ? 'Take Out' : `Table ${target.key}`
            } / Invoice ${invoice_id || orderId} ($${totalNum.toFixed(2)})`,
        });

        res.status(200).json({ message: 'Transaction completed and locked successfully.', invoice_id });
    } catch (error) {
        logOrderError('DATABASE ERROR IN POST /api/orders/checkout', error, {
            target_id,
            normalized_target: target.key,
            invoice_id,
        });
        res.status(500).json({ message: 'Error committing accounting metrics', errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }) });
    }
});

// 4. MARK TABLE AS BILL REQUESTED (PENDING BILL STATUS)
app.post('/api/orders/bill-requested', async (req, res) => {
    const { target_id } = req.body ?? {};
    if (!target_id) {
        return res.status(400).json({ message: 'Missing target_id' });
    }

    let target;
    try {
        target = normalizeIncomingTarget(target_id);
    } catch (validationError) {
        return res.status(400).json({ message: validationError.message });
    }

    try {
        const { sql, params } = pendingOrderWhereClause(target);
        await db.execute(`UPDATE orders SET bill_requested = 1 WHERE ${sql}`, params);
        res.status(200).json({ message: "Bill requested flag set." });
    } catch (error) {
        if (error.message && error.message.includes('bill_requested')) {
            try {
                await db.execute(
                    'ALTER TABLE orders ADD COLUMN bill_requested TINYINT(1) NOT NULL DEFAULT 0'
                );
                const { sql, params } = pendingOrderWhereClause(target);
                await db.execute(`UPDATE orders SET bill_requested = 1 WHERE ${sql}`, params);
                res.status(200).json({ message: "Bill requested flag set." });
                return;
            } catch (alterError) {
                logOrderError('Error setting bill_requested (alter)', alterError, { target_id });
            }
        } else {
            logOrderError('Error setting bill_requested', error, { target_id });
        }
        res.status(200).json({ message: "Bill request noted (local state only)." });
    }
});

// 5. SYNC UPDATED BILL LINE ITEMS BEFORE CHECKOUT
app.put('/api/orders/items', async (req, res) => {
    const { target_id, items, table_id } = req.body ?? {};

    if (!target_id || !Array.isArray(items)) {
        return res.status(400).json({ message: 'Missing target_id or items array' });
    }

    if (items.length > 0) {
        const invalidLine = items.find((item) => {
            const qty = Number(item?.quantity ?? item?.qty);
            const price = Number(item?.price ?? item?.unitPrice);
            return !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0;
        });
        if (invalidLine) {
            return res.status(400).json({ message: 'Each bill line needs a valid quantity and price' });
        }
    }

    let target;
    try {
        target = normalizeIncomingTarget(target_id);
    } catch (validationError) {
        return res.status(400).json({ message: validationError.message });
    }

    try {
        let orderId = await findPendingOrderId(db, target);

        if (!orderId) {
            orderId = await createPendingOrder(db, target, table_id);
        }

        await db.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);

        for (const item of items) {
            await insertOrderItem(db, orderId, item);
        }

        res.status(200).json({ message: "Bill items updated.", orderId });
    } catch (error) {
        logOrderError('DATABASE ERROR IN PUT /api/orders/items', error, {
            target_id,
            normalized_target: target.key,
            item_count: items.length,
        });
        res.status(500).json({ message: "Failed to update bill items", errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }) });
    }
});

// 6. FETCH COMPLETED SALES HISTORY LOGS
app.get('/api/orders/history', async (req, res) => {
    const parsedDays = Number.parseInt(req.query.days, 10);
    const allowedDayRanges = [30, 60, 90, 120, 180, 365, 730];
    const days = allowedDayRanges.includes(parsedDays) ? parsedDays : 730;

    try {
        const query = `
            SELECT 
                id AS order_id,
                invoice_id,
                target_id,
                source_type,
                payment_method,
                payment_type,
                subtotal,
                tax,
                total,
                status,
                DATE_FORMAT(updated_at, '%Y-%m-%d') AS date,
                DATE_FORMAT(updated_at, '%h:%i %p') AS time,
                DATE_FORMAT(updated_at, '%Y-%m') AS month_key
            FROM orders 
            WHERE UPPER(status) IN ('COMPLETED', 'PAID')
              AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY updated_at DESC
        `;
        const [historyRows] = await db.execute(query, [days]);

        if (historyRows.length === 0) {
            return res.status(200).json([]);
        }

        const orderIds = historyRows.map((row) => row.order_id);
        const placeholders = orderIds.map(() => '?').join(', ');
        const [itemRows] = await db.execute(
            `
            SELECT
                oi.order_id,
                COALESCE(m.name, oi.item_name, 'Custom item') AS name,
                oi.notes,
                oi.quantity AS qty,
                oi.price AS unitPrice,
                (oi.quantity * oi.price) AS lineTotal
            FROM order_items oi
            LEFT JOIN menu_items m ON oi.menu_item_id = m.id
            WHERE oi.order_id IN (${placeholders})
            `,
            orderIds,
        );

        const itemsByOrder = itemRows.reduce((acc, row) => {
            if (!acc[row.order_id]) acc[row.order_id] = [];
            acc[row.order_id].push({
                name: formatOrderLineName(row.name, row.notes),
                notes: row.notes || '',
                qty: row.qty,
                unitPrice: parseFloat(row.unitPrice),
                lineTotal: parseFloat(row.lineTotal),
            });
            return acc;
        }, {});

        const enrichedHistory = historyRows.map((row) => {
            const items = itemsByOrder[row.order_id] || [];
            const targetKey = row.target_id != null ? String(row.target_id) : 'takeout';
            return {
                ...row,
                target_id: targetKey,
                payment_method: row.payment_method || row.payment_type || 'Cash',
                summary: items.length
                    ? items.map((item) => `${item.qty}× ${item.name}`).join(', ')
                    : 'Items logged',
                items,
            };
        });

        res.status(200).json(enrichedHistory);
    } catch (error) {
        console.error('❌ CRITICAL DATABASE ERROR IN /api/orders/history:', error.message);
        res.status(500).json({ message: 'Failed to load sales history', errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }) });
    }
});

// ==========================================
// 🔔 REAL-TIME ALERTS
// ==========================================

function summarizeAlertCounts(alerts) {
    return {
        total: alerts.length,
        critical: alerts.filter((alert) => alert.severity === 'critical').length,
        warning: alerts.filter((alert) => alert.severity === 'warning').length,
        info: alerts.filter((alert) => alert.severity === 'info').length,
        reservation: alerts.filter((alert) => alert.category === 'reservation').length,
    };
}

app.get('/api/alerts', async (req, res) => {
    try {
        await processReservationReminders(db).catch(() => null);
        const bypassCache = req.query.refresh === '1';
        const payload = await buildActiveAlerts(db, { bypassCache });
        const storedAlerts = req.user?.id ? await listUnreadUserAlerts(db, req.user.id) : [];
        const alerts = [...storedAlerts, ...(payload.alerts || [])];
        const counts = summarizeAlertCounts(alerts);
        return res.status(200).json({ ...payload, alerts, counts });
    } catch (error) {
        console.error('❌ ALERTS ENGINE ERROR:', error.message);
        res.status(500).json({ message: 'Failed to scan active alerts', errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }) });
    }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
    const notificationId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({ message: 'Invalid notification id' });
    }

    try {
        const updated = await markNotificationRead(db, {
            notificationId,
            recipientUserId: req.user.id,
        });
        if (!updated) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('❌ MARK NOTIFICATION READ ERROR:', error.message);
        res.status(500).json({ message: 'Failed to update notification' });
    }
});

// ==========================================
// 📦 INVENTORY & STOCK MANAGEMENT API ROUTES
// ==========================================

app.get('/api/inventory', async (req, res) => {
    try {
        const [items] = await db.execute('SELECT * FROM inventory ORDER BY section, category, item_name');
        res.status(200).json(items);
    } catch (error) {
        console.error('❌ INVENTORY FETCH ERROR:', error.message);
        res.status(500).json({ message: 'Failed to load inventory logs' });
    }
});

app.put('/api/inventory/:id/stock', requirePermission('inventory_stock'), async (req, res) => {
    const itemId = Number.parseInt(req.params.id, 10);
    const { stock_quantity, unit_cost } = req.body ?? {};
    const qty = Number(stock_quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ message: 'Invalid inventory item id' });
    }

    if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({ message: 'Please provide a valid stock quantity' });
    }

    try {
        await ensureInventorySchema(db);
        const [rows] = await db.execute(
            'SELECT low_threshold, critical_threshold, unit_cost FROM inventory WHERE id = ? LIMIT 1',
            [itemId],
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }

        const row = rows[0];
        const lowThreshold = Number(row.low_threshold ?? 0);
        const criticalThreshold =
            row.critical_threshold != null ? Number(row.critical_threshold) : null;
        const stockStatus = resolveStockStatus(qty, lowThreshold, criticalThreshold);
        const nextUnitCost =
            unit_cost !== undefined && unit_cost !== null && unit_cost !== ''
                ? Number(unit_cost)
                : Number(row.unit_cost ?? 0);

        const query =
            'UPDATE inventory SET stock_quantity = ?, stock_status = ?, unit_cost = ? WHERE id = ?';
        await db.execute(query, [qty, stockStatus, Number.isFinite(nextUnitCost) ? nextUnitCost : 0, itemId]);
        res.status(200).json({ message: 'Stock level updated successfully!' });
    } catch (error) {
        console.error('❌ INVENTORY UPDATE ERROR:', error.message);
        res.status(500).json({ message: 'Failed to alter stock quantities' });
    }
});

// 3. ADD A NEW TRACKED INVENTORY ITEM
app.post('/api/inventory', requirePermission('inventory_stock'), async (req, res) => {
    const body = req.body ?? {};
    const item_name = body.item_name;
    const category = body.category;
    const stock_quantity = Number(body.stock_quantity);
    const unit =
        body.unit_label || body.unit || body.unit_singular || '';
    const unitSingular = body.unit_singular || unit;
    const section = body.section === 'uncountable' ? 'uncountable' : 'countable';
    const lowThreshold = Number(body.low_threshold ?? body.low_stock_threshold ?? 5);
    const criticalThreshold =
        body.critical_threshold != null && body.critical_threshold !== ''
            ? Number(body.critical_threshold)
            : null;
    const maxStock = Number(body.max_stock ?? Math.max(stock_quantity, lowThreshold * 2, 10));

    if (!item_name || !category || !Number.isFinite(stock_quantity) || stock_quantity < 0 || !unit) {
        return res.status(400).json({ message: 'Missing required tracking attributes' });
    }

    try {
        const stockStatus = resolveStockStatus(
            stock_quantity,
            Number.isFinite(lowThreshold) ? lowThreshold : 5,
            Number.isFinite(criticalThreshold) ? criticalThreshold : null,
        );
        const query = `
            INSERT INTO inventory (
                item_name, category, section, stock_quantity, max_stock,
                unit_label, unit_singular, low_threshold, critical_threshold, stock_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            item_name,
            category,
            section,
            stock_quantity,
            Number.isFinite(maxStock) && maxStock > 0 ? maxStock : Math.max(stock_quantity, 10),
            unit,
            unitSingular,
            Number.isFinite(lowThreshold) ? lowThreshold : 5,
            Number.isFinite(criticalThreshold) ? criticalThreshold : null,
            stockStatus,
        ]);

        res.status(201).json({
            message: 'New stock line registered successfully!',
            itemId: result.insertId,
        });
    } catch (error) {
        console.error('❌ INVENTORY CREATION ERROR:', error.message);
        res.status(500).json({ message: 'Failed to initialize item line' });
    }
});

// ==========================================
// 💾 BACKUP & RECOVERY API ROUTES
// ==========================================

const sqlUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.sql')) {
            cb(new Error('Only .sql backup files are allowed'));
            return;
        }
        cb(null, true);
    },
});

function handleBackupError(res, error, fallbackMessage) {
    const errorId = logError(error, { route: 'system/backup' });
    res.status(500).json({
        message: fallbackMessage,
        errorId,
    });
}

app.get('/api/system/backup/excel', sensitiveOperationLimiter, requirePermission('backup_recovery'), async (req, res) => {
    try {
        const period = parseBackupPeriod(req.query);
        const buffer = await exportBusinessDataBuffer(db, period);
        const filename = buildBackupFilename('mlu-kitchen-cafe-business-data', 'xlsx', period);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        if (error?.message?.includes('Invalid month or year')) {
            return res.status(400).json({ message: error.message });
        }
        handleBackupError(res, error, 'Failed to export business data to Excel');
    }
});

app.get('/api/system/backup/sql', sensitiveOperationLimiter, requireAdmin, async (req, res) => {
    try {
        const period = parseBackupPeriod(req.query);
        const { buffer, filename } = await createDatabaseDump(db, period);

        res.setHeader('Content-Type', 'application/sql; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        if (error?.message?.includes('Invalid month or year')) {
            return res.status(400).json({ message: error.message });
        }
        handleBackupError(res, error, 'Failed to create SQL database backup');
    }
});

app.post('/api/system/backup/restore', sensitiveOperationLimiter, requireAdmin, (req, res) => {
    sqlUpload.single('sqlFile')(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({ message: uploadError.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a .sql backup file' });
        }

        try {
            const sqlContent = req.file.buffer.toString('utf8');
            const result = await restoreDatabaseFromSql(sqlContent);
            res.status(200).json(result);
        } catch (error) {
            handleBackupError(res, error, 'Failed to restore database from SQL backup');
        }
    });
});

// ==========================================
// 💰 EXPENSE / SPENDING TRACKING
// ==========================================
app.get('/api/expenses', async (req, res) => {
    try {
        const expenses = await listExpenses(db, { days: req.query.days });
        res.status(200).json(expenses);
    } catch (error) {
        console.error('❌ EXPENSES FETCH ERROR:', error.message);
        res.status(500).json({ message: 'Failed to load expenses' });
    }
});

app.get('/api/expenses/summary', async (req, res) => {
    try {
        const todaySpending = await summarizeExpensesToday(db);
        res.status(200).json({ todaySpending });
    } catch (error) {
        console.error('❌ EXPENSE SUMMARY ERROR:', error.message);
        res.status(500).json({ message: 'Failed to load expense summary' });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const expense = await createExpense(db, req.body ?? {}, req.user);
        await auditFromRequest(db, req, {
            action: 'expense_create',
            module: 'Expenses',
            description: `Logged $${Number(expense.amount).toFixed(2)} (${expense.category})`,
        });
        res.status(201).json(expense);
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) {
            const errorId = logError(error, { route: `${req.method} ${req.originalUrl}` });
            return res.status(500).json({ message: 'Failed to create expense', errorId });
        }
        res.status(status).json({ message: error.message || 'Failed to create expense' });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        await deleteExpense(db, req.params.id);
        await auditFromRequest(db, req, {
            action: 'expense_delete',
            module: 'Expenses',
            description: `Deleted expense #${req.params.id}`,
        });
        res.status(200).json({ message: 'Expense deleted' });
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) {
            const errorId = logError(error, { route: `${req.method} ${req.originalUrl}` });
            return res.status(500).json({ message: 'Failed to delete expense', errorId });
        }
        res.status(status).json({ message: error.message || 'Failed to delete expense' });
    }
});

// ==========================================
// 📅 TABLE RESERVATIONS
// ==========================================

const requireReservationsAccess = requireAnyPermission('reservations', 'table')
const requireReportsAccess = requireAnyPermission('reports', 'reports_analysis', 'sales_history')

app.get('/api/tables', requireReservationsAccess, async (_req, res) => {
    try {
        const tables = await listFloorTables(db)
        const floor = await getLiveFloorReservations(db)
        const standard = tables.filter((table) => table.section !== 'vip')
        const vip = tables.filter((table) => table.section === 'vip')
        const reservations = floor.tables || {}

        res.status(200).json({
            date: floor.date,
            counts: {
                standard: standard.length,
                vip: vip.length,
                takeout: 1,
            },
            standard,
            vip,
            takeout: {
                id: 'takeout',
                name: 'Take Out',
                section: 'takeout',
                capacity: null,
                status: 'Empty',
            },
            tables,
            reservations,
        })
    } catch (error) {
        console.error('❌ TABLES FLOOR ERROR:', error.message)
        res.status(500).json({ message: 'Failed to load floor tables' })
    }
})

app.get('/api/reports', requireReportsAccess, async (req, res) => {
    try {
        const report = await buildSalesReport(db, { days: req.query.days })
        res.status(200).json(report)
    } catch (error) {
        console.error('❌ REPORTS ERROR:', error.message)
        res.status(500).json({ message: 'Failed to load sales report', errorId: logError(error, { route: `${req.method} ${req.originalUrl}` }) })
    }
})

app.get('/api/reservations/meta', requireReservationsAccess, async (_req, res) => {
    try {
        const tables = await listFloorTables(db)
        res.status(200).json({ tables, timeSlots: TIME_SLOTS, statuses: ALL_STATUSES })
    } catch (error) {
        console.error('❌ RESERVATION META ERROR:', error.message)
        res.status(500).json({ message: 'Failed to load reservation options' })
    }
})

app.get('/api/reservations/availability', requireReservationsAccess, async (req, res) => {
    try {
        const payload = await getAvailableTables(db, {
            date: req.query.date,
            timeSlot: req.query.time_slot,
            excludeId: req.query.exclude_id,
        })
        res.status(200).json(payload)
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION AVAILABILITY ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to check table availability' })
    }
})

app.get('/api/reservations/floor', requireAnyPermission('reservations', 'table'), async (_req, res) => {
    try {
        const payload = await getLiveFloorReservations(db)
        res.status(200).json(payload)
    } catch (error) {
        console.error('❌ RESERVATION FLOOR ERROR:', error.message)
        res.status(500).json({ message: 'Failed to load reserved floor status' })
    }
})

app.get('/api/reservations', requireReservationsAccess, async (req, res) => {
    try {
        const reservations = await listReservations(db, req.query)
        res.status(200).json(reservations)
    } catch (error) {
        console.error('❌ RESERVATIONS LIST ERROR:', error.message)
        res.status(500).json({ message: 'Failed to load reservations' })
    }
})

app.get('/api/reservations/:id', requireReservationsAccess, async (req, res) => {
    try {
        const reservation = await getReservation(db, req.params.id)
        res.status(200).json(reservation)
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION FETCH ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to load reservation' })
    }
})

app.post('/api/reservations', requireReservationsAccess, async (req, res) => {
    try {
        const reservation = await createReservation(db, req.body, req.user)
        res.status(201).json(reservation)
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION CREATE ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to create reservation' })
    }
})

app.put('/api/reservations/:id', requireReservationsAccess, async (req, res) => {
    try {
        const reservation = await updateReservation(db, req.params.id, req.body)
        res.status(200).json(reservation)
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION UPDATE ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to update reservation' })
    }
})

app.post('/api/reservations/:id/check-in', requireReservationsAccess, async (req, res) => {
    try {
        const reservation = await checkInReservation(db, req.params.id)
        res.status(200).json(reservation)
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION CHECK-IN ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to check in reservation' })
    }
})

app.post('/api/reservations/:id/confirmation-letter', requireReservationsAccess, async (req, res) => {
    try {
        const reservation = await getReservation(db, req.params.id)
        const result = await sendReservationConfirmationLetter({
            reservation,
            to: req.body?.email,
        })
        await auditFromRequest(db, req, {
            action: 'reservation_letter_send',
            module: 'Reservations',
            description: `Sent confirmation letter for booking #${reservation.id} (${reservation.customer_name}) to ${String(req.body?.email || '').trim()}`,
        })
        res.status(200).json({
            message: result.delivered
                ? 'Confirmation letter sent'
                : 'Confirmation letter saved to the mail log (SMTP is not configured)',
            delivered: result.delivered,
            method: result.method,
        })
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION LETTER ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to send confirmation letter' })
    }
})

app.delete('/api/reservations/:id', requireReservationsAccess, async (req, res) => {
    try {
        const reservation = await deleteReservation(db, req.params.id)
        res.status(200).json({ message: 'Reservation deleted', reservation })
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) console.error('❌ RESERVATION DELETE ERROR:', error.message)
        res.status(status).json({ message: error.message || 'Failed to delete reservation' })
    }
})

// ==========================================
// 🔐 AUDIT LOGS (ADMIN)
// ==========================================
app.get('/api/audit-logs', requireAdmin, async (req, res) => {
    try {
        const logs = await listAuditLogs(db, { limit: req.query.limit });
        res.status(200).json(logs);
    } catch (error) {
        console.error('❌ AUDIT LOGS FETCH ERROR:', error.message);
        res.status(500).json({ message: 'Failed to load audit logs' });
    }
});

// ==========================================
// 🛟 GLOBAL ERROR + 404 HANDLERS
// ==========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ==========================================
// 🚀 START SERVER
// ==========================================
const PORT = env.port;

// A rejected promise or throw outside Express must not disappear silently, and must not
// leave the process running in an unknown state. Log it, then exit so the supervisor
// (pm2/systemd/nodemon) restarts on clean footing.
process.on('unhandledRejection', (reason) => {
    logError(reason instanceof Error ? reason : new Error(String(reason)), {
        route: 'process:unhandledRejection',
    });
});

process.on('uncaughtException', (error) => {
    logError(error, { route: 'process:uncaughtException' });
    console.error('❌ Uncaught exception - shutting down for a clean restart.');
    process.exit(1);
});

app.listen(PORT, async () => {
    console.log(`🚀 ${STORE.officialName} Backend running smoothly on port ${PORT}`);
    console.log(`   CORS allowed origins: ${env.security.allowedOrigins.join(', ')}`);
    console.log(`   Security: helmet on, rate limiting on, JWT expiry ${env.jwtExpiresIn}`);

    try {
        await db.execute('SELECT 1');
        console.log(`   Database connection: OK (${resolveDbHost(env.db.host)}:${env.db.database})`);
        await ensureInventorySchema(db);
        const restoredSaleDates = await ensureOrdersSchema(db);
        await ensureOrderItemsSchema(db);
        await ensureMenuItemsImageSchema(db);
        await ensureExpensesSchema(db);
        await ensureAuditSchema(db);
        await ensureUsersEmailColumn(db);
        await ensureAdminNotificationsSchema(db);
        await ensureReservationsSchema(db);
        startReservationReminderJob(db);
        console.log('   Inventory schema: OK');
        if (restoredSaleDates > 0) {
            console.log(`   Orders sale dates restored: ${restoredSaleDates} (updated_at <- created_at)`);
        }
        console.log('   Order timestamps: OK (no ON UPDATE stamp)');
        console.log('   Order items schema: OK');
        console.log('   Menu items image_url: OK');
        console.log('   Expenses / audit schema: OK');
        console.log('   Floor tables / reservations schema: OK');
        console.log(`   Admin recovery email: ${env.adminEmail}`);
    } catch (error) {
        console.error('❌ Database connection failed:', error.code || error.message);
        console.error('   Start MySQL in Laragon, then restart this server.');
    }
});