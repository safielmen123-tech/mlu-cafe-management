-- RBAC users table with JSON permissions array
-- Database: romduol_cafe_db

USE romduol_cafe_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Staff',
  permissions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username)
);

-- Normalize legacy inventory permission key to inventory_stock
UPDATE users
SET permissions = REPLACE(CAST(permissions AS CHAR), '"inventory"', '"inventory_stock"')
WHERE JSON_SEARCH(permissions, 'one', 'inventory') IS NOT NULL;
