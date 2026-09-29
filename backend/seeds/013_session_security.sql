-- Removes stored plaintext passwords and creates the logout revocation table.
-- users.must_change_password, users.is_active, and users.tokens_valid_after
-- are added by the server on startup (see sessionSecurity.js), which is safe to run
-- more than once. This file is safe to run more than once as well.
-- Database: mlu_kitchen_cafe_db

USE mlu_kitchen_cafe_db;

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_revoked_tokens_expires (expires_at),
  KEY idx_revoked_tokens_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE admin_notifications
SET meta = JSON_REMOVE(meta, '$.temporaryPassword', '$.password', '$.temporary_password')
WHERE JSON_VALID(meta)
  AND (
    JSON_EXTRACT(meta, '$.temporaryPassword') IS NOT NULL
    OR JSON_EXTRACT(meta, '$.password') IS NOT NULL
    OR JSON_EXTRACT(meta, '$.temporary_password') IS NOT NULL
  );
