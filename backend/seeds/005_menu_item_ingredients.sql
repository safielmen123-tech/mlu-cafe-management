-- Recipe / ingredient mapping for automated inventory deduction
-- inventory_item_id references `inventory` (stock items table)

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  quantity_required DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(16) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_menu_inventory (menu_item_id, inventory_item_id),
  CONSTRAINT fk_mii_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_mii_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- Track per line whether stock was already deducted (avoid double deduction on checkout)
-- Applied automatically at server startup via ensureRecipeSchema(); run manually if needed:
-- ALTER TABLE order_items ADD COLUMN inventory_deducted TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE inventory ADD COLUMN stock_status VARCHAR(32) NOT NULL DEFAULT 'IN_STOCK';
