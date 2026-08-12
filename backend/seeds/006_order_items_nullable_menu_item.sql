-- Allow ad-hoc / deleted menu references on order line items.
-- Applied automatically at server startup via ensureOrderItemsSchema(); run manually if needed.

ALTER TABLE order_items DROP FOREIGN KEY order_items_ibfk_2;
ALTER TABLE order_items MODIFY menu_item_id INT NULL;
ALTER TABLE order_items ADD COLUMN item_name VARCHAR(255) NULL AFTER menu_item_id;
ALTER TABLE order_items ADD CONSTRAINT order_items_ibfk_2
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;
