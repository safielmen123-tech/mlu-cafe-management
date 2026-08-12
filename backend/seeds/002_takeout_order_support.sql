-- Take-out orders use source_type = 'Take Out' with NULL target_id/table_id.
-- Dine-in orders use source_type = 'Table' with numeric target_id/table_id.
-- No schema change required when using orderTargets normalization helpers.

-- Example pending take-out row:
-- INSERT INTO orders (target_id, table_id, source_type, payment_type, status, total_amount)
-- VALUES (NULL, NULL, 'Take Out', 'Cash', 'Pending', 0);
