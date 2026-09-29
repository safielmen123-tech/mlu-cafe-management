-- Order and payment integrity.
-- Checked against the live database before this was applied:
-- no duplicate invoice ids, no blank invoice ids, no negative money,
-- no negative line prices or quantities, and no orphan order, menu, or table ids.
-- Existing foreign keys kept: order_items.order_id -> orders.id,
-- order_items.menu_item_id -> menu_items.id, orders.table_id -> tables.id.
-- Database: mlu_kitchen_cafe_db

USE mlu_kitchen_cafe_db;

ALTER TABLE orders
  ADD UNIQUE KEY uq_orders_invoice_id (invoice_id);

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_subtotal_nonneg CHECK (subtotal IS NULL OR subtotal >= 0),
  ADD CONSTRAINT chk_orders_tax_nonneg CHECK (tax >= 0),
  ADD CONSTRAINT chk_orders_total_nonneg CHECK (total IS NULL OR total >= 0),
  ADD CONSTRAINT chk_orders_total_amount_nonneg CHECK (total_amount IS NULL OR total_amount >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_quantity_nonneg CHECK (quantity >= 0),
  ADD CONSTRAINT chk_order_items_price_nonneg CHECK (price IS NULL OR price >= 0),
  ADD CONSTRAINT chk_order_items_subtotal_nonneg CHECK (subtotal >= 0);

ALTER TABLE orders
  ADD CONSTRAINT orders_target_id_fk
  FOREIGN KEY (target_id) REFERENCES tables (id)
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
