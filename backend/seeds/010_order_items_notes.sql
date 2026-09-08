-- Line-item notes / modifiers (e.g. sugar level) for kitchen, payment, and receipts.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS notes VARCHAR(255) NULL AFTER item_name;

ALTER TABLE orders
  MODIFY tax DECIMAL(10,2) NOT NULL DEFAULT 0.00;
