-- Phase 1 stock links and movement log.
-- Applied on server start by ensureStockSchema (idempotent).
-- Back up the database before the first start that runs this.
-- Database: mlu_kitchen_cafe_db
-- orders, order_items, inventory, menu_items, and users must be InnoDB.

CREATE TABLE IF NOT EXISTS menu_item_stock_links (
  id INT NOT NULL AUTO_INCREMENT,
  menu_item_id INT NOT NULL,
  variant VARCHAR(16) NOT NULL DEFAULT '',
  option_key VARCHAR(32) NOT NULL DEFAULT '',
  option_value VARCHAR(64) NOT NULL DEFAULT '',
  inventory_id INT NOT NULL,
  quantity_per_unit DECIMAL(12,3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_stock_link (menu_item_id, variant, option_key, option_value, inventory_id),
  KEY idx_stock_link_inventory (inventory_id),
  CONSTRAINT fk_stock_link_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_link_inventory FOREIGN KEY (inventory_id) REFERENCES inventory (id) ON DELETE RESTRICT,
  CONSTRAINT chk_stock_link_qty CHECK (quantity_per_unit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT NOT NULL AUTO_INCREMENT,
  inventory_id INT NOT NULL,
  change_amount DECIMAL(12,3) NOT NULL,
  quantity_after DECIMAL(12,3) NOT NULL,
  reason ENUM('sale','restock','cancel','adjustment','waste') NOT NULL,
  order_id INT NULL,
  note VARCHAR(255) NULL,
  user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_movements_item (inventory_id, id),
  KEY idx_stock_movements_order (order_id),
  CONSTRAINT fk_stock_movement_item FOREIGN KEY (inventory_id) REFERENCES inventory (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_movement_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT fk_stock_movement_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
