-- Floor tables referenced by POS table numbers (target_id) and optional orders.table_id FK.
-- IDs align with frontend floorTables in frontend/src/data/tables.js.
-- Layout: 8 standard tables + 2 VIP rooms. Take Out is a POS ticket, not a row here.

INSERT INTO tables (id, table_name, status) VALUES
  (1, 'Table 1', 'Empty'),
  (2, 'Table 2', 'Empty'),
  (3, 'Table 3', 'Empty'),
  (4, 'Table 4', 'Empty'),
  (5, 'Table 5', 'Empty'),
  (6, 'Table 6', 'Empty'),
  (7, 'Table 7', 'Empty'),
  (8, 'Table 8', 'Empty'),
  (9, 'VIP Room 1', 'Empty'),
  (10, 'VIP Room 2', 'Empty')
ON DUPLICATE KEY UPDATE
  table_name = VALUES(table_name);
