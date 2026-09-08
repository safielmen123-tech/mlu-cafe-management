-- Optional email on users. Prefer letting the API apply this on boot
-- (ensureUsersEmailColumn) or: node scripts/seed-admin.js

USE mlu_kitchen_cafe_db;

-- Run only if the column is missing:
-- ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username;

UPDATE users
SET email = 'antagonistslayer9000@gmail.com'
WHERE LOWER(role) = 'admin' AND (email IS NULL OR email = '');
