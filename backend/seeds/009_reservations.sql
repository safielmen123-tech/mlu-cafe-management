-- Table reservations. Floor table rows (8 standard + 2 VIP) are upserted on API startup
-- via backend/src/utils/reservations.js (ensureFloorTables).

CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  reservation_date DATE NOT NULL,
  time_slot VARCHAR(8) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 120,
  table_id INT NOT NULL,
  guest_count INT NOT NULL DEFAULT 2,
  status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
  notes TEXT NULL,
  reminder_3d_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_1d_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reservations_date (reservation_date, status),
  INDEX idx_reservations_table_slot (table_id, reservation_date, time_slot),
  CONSTRAINT fk_reservations_table
    FOREIGN KEY (table_id) REFERENCES tables(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
