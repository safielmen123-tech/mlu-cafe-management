/**
 * Creates core tables on an empty database (e.g. Aiven defaultdb).
 * Safe to re-run: every statement uses CREATE TABLE IF NOT EXISTS.
 * Secondary tables (expenses, sessions, stock links, etc.) are created by
 * the other ensure* helpers called from ensureApplicationSchema.
 */

let baseSchemaReadyPromise = null

const CREATE_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    display_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Staff',
    permissions TEXT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    tokens_valid_after INT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS \`tables\` (
    id INT NOT NULL AUTO_INCREMENT,
    table_name VARCHAR(20) NOT NULL,
    section VARCHAR(20) NOT NULL DEFAULT 'standard',
    capacity INT NOT NULL DEFAULT 4,
    status ENUM('Empty', 'Occupied', 'Pending Bill') NOT NULL DEFAULT 'Empty',
    PRIMARY KEY (id),
    UNIQUE KEY table_name (table_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`

const CREATE_MENU_ITEMS = `
  CREATE TABLE IF NOT EXISTS menu_items (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    category ENUM(
      'Coffee', 'Tea', 'Starters', 'Mains', 'Soup', 'Vegetable',
      'Dessert', 'Bakery', 'Food', 'Cold Drinks', 'Beer'
    ) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    hot_price DECIMAL(10,2) NULL,
    iced_price DECIMAL(10,2) NULL,
    image_url VARCHAR(512) NULL,
    is_available TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`

const CREATE_INVENTORY = `
  CREATE TABLE IF NOT EXISTS inventory (
    id INT NOT NULL AUTO_INCREMENT,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    section VARCHAR(20) NOT NULL,
    stock_quantity DECIMAL(14,6) NOT NULL DEFAULT 0,
    max_stock DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    unit_label VARCHAR(20) NOT NULL,
    unit_singular VARCHAR(20) NOT NULL,
    critical_threshold DECIMAL(10,2) NULL,
    low_threshold DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    is_weight TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    stock_status VARCHAR(32) NOT NULL DEFAULT 'IN_STOCK',
    unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`

const CREATE_ORDERS = `
  CREATE TABLE IF NOT EXISTS orders (
    id INT NOT NULL AUTO_INCREMENT,
    table_id INT NULL,
    source_type ENUM('Table', 'Take Out') NOT NULL,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    payment_type ENUM('Cash', 'Bank Scan') NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    kitchen_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    invoice_id VARCHAR(50) NULL,
    payment_method VARCHAR(50) NULL,
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    target_id INT NULL,
    bill_requested TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_invoice_id (invoice_id),
    KEY table_id (table_id),
    KEY orders_target_id_fk (target_id),
    CONSTRAINT orders_ibfk_1 FOREIGN KEY (table_id) REFERENCES \`tables\` (id) ON DELETE SET NULL,
    CONSTRAINT orders_target_id_fk FOREIGN KEY (target_id) REFERENCES \`tables\` (id) ON DELETE SET NULL,
    CONSTRAINT chk_orders_subtotal_nonneg CHECK (subtotal IS NULL OR subtotal >= 0),
    CONSTRAINT chk_orders_tax_nonneg CHECK (tax >= 0),
    CONSTRAINT chk_orders_total_amount_nonneg CHECK (total_amount IS NULL OR total_amount >= 0),
    CONSTRAINT chk_orders_total_nonneg CHECK (total IS NULL OR total >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`

const CREATE_ORDER_ITEMS = `
  CREATE TABLE IF NOT EXISTS order_items (
    id INT NOT NULL AUTO_INCREMENT,
    order_id INT NOT NULL,
    menu_item_id INT NULL,
    item_name VARCHAR(255) NULL,
    notes VARCHAR(255) NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    price DECIMAL(10,2) NULL,
    inventory_deducted TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY order_id (order_id),
    KEY order_items_ibfk_2 (menu_item_id),
    CONSTRAINT order_items_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT order_items_ibfk_2 FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE SET NULL,
    CONSTRAINT chk_order_items_price_nonneg CHECK (price IS NULL OR price >= 0),
    CONSTRAINT chk_order_items_quantity_nonneg CHECK (quantity >= 0),
    CONSTRAINT chk_order_items_subtotal_nonneg CHECK (subtotal >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`

async function ensureBaseSchema(db) {
  if (!baseSchemaReadyPromise) {
    baseSchemaReadyPromise = (async () => {
      // Order matters for foreign keys.
      await db.execute(CREATE_USERS)
      await db.execute(CREATE_TABLES)
      await db.execute(CREATE_MENU_ITEMS)
      await db.execute(CREATE_INVENTORY)
      await db.execute(CREATE_ORDERS)
      await db.execute(CREATE_ORDER_ITEMS)
    })().catch((error) => {
      baseSchemaReadyPromise = null
      throw error
    })
  }
  return baseSchemaReadyPromise
}

module.exports = {
  ensureBaseSchema,
}
