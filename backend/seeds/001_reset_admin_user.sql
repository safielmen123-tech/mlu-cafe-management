-- Romduol Cafe: wipe users and prepare for fresh admin seed
-- NOTE: password_hash must be generated with bcrypt (see scripts/seed-admin.js).
-- Do not run the INSERT below manually unless you replace :password_hash with a real bcrypt string.

USE romduol_cafe_db;

DELETE FROM users;

-- Prefer running:  node backend/scripts/seed-admin.js
-- That script deletes all rows and inserts admin with a secure bcrypt hash.
