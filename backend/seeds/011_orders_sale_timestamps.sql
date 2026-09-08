-- Sale history, reports, and AI forecasts all use orders.updated_at as the sale date.
-- ON UPDATE CURRENT_TIMESTAMP rewrote every row during unrelated schema changes
-- (for example ALTER TABLE orders MODIFY tax), so a full year of seeded sales
-- appeared to fall in the current month.
ALTER TABLE orders
  MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE orders
SET updated_at = created_at
WHERE created_at IS NOT NULL
  AND updated_at IS NOT NULL
  AND updated_at > DATE_ADD(created_at, INTERVAL 1 DAY);
