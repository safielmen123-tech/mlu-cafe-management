# Handover checklist (Windows + Laragon)

One page for moving this project to another PC. Do not skip the `.env` step.

## What you need

- Laragon with **MySQL 8.x** (tested: 8.4.3)
- **Node.js 20+** (tested: 26.x) and npm
- Project RAR **without** `node_modules` / `frontend/dist` (optional omit)
- Your phpMyAdmin `.sql` export of `mlu_kitchen_cafe_db`

## phpMyAdmin export settings

- Database: `mlu_kitchen_cafe_db` (or Custom → select all tables)
- Format: **SQL**
- **Structure:** yes (include DROP TABLE / CREATE TABLE)
- **Data:** yes
- Character set of the file: **utf8** (phpMyAdmin) — dump must contain `SET NAMES utf8mb4`
- Prefer: **mysqli** export, no compression, or gzip if you know how to import it
- Include: routines / triggers / events if the UI offers them (safe to leave on)

## Fresh Laragon vs this machine

| Setting | Typical fresh Laragon | This project’s local default |
|--------|------------------------|------------------------------|
| MySQL user | `root` | `root` |
| MySQL password | **empty** | empty (set `DB_PASSWORD` if you changed it) |
| DB name | you create/import | `mlu_kitchen_cafe_db` |
| API port | free | `5500` |
| Vite port | free | `5173` |

If MySQL password/user differs on the teammate PC, edit **only** `backend/.env` (`DB_USER`, `DB_PASSWORD`). Do not change the SQL file.

## Steps

1. Extract the project under `C:\laragon\www\` (any folder name is fine).
2. Create DB in phpMyAdmin (utf8mb4) and **Import** the `.sql`.
3. Copy `backend/.env.example` → `backend/.env` and set at least:
   - `DB_HOST=127.0.0.1`
   - `DB_USER=root` (or your user)
   - `DB_PASSWORD=` (your password)
   - `DB_NAME=mlu_kitchen_cafe_db`
   - `JWT_SECRET=` (long random string, ≥32 chars)
   - `FRONTEND_URL=http://localhost:5173`
4. Copy `frontend/.env.example` → `frontend/.env`:
   - `VITE_API_URL=http://localhost:5500/api`
5. Optional: `MYSQL_BIN` / `LARAGON_ROOT` / `BACKUP_DIR` if Laragon is not at `C:\laragon` (folders are created automatically).
6. In `backend`: `npm install` then `npm start`
7. In `frontend`: `npm install` then `npm run dev`
8. Open `http://localhost:5173` and sign in as **Admin** with the **existing** password from the exported DB.
9. If the password is unknown: in `backend` run `npm run admin:reset` (interactive; sets `must_change_password`).

## After install notes

- `bcrypt` builds/loads on `npm install` (needs a normal Windows build toolchain if no prebuild matches).
- First API start runs schema ensures; a second start should make **no** structural changes.
- SQL backups go to `%LARAGON_ROOT%\backup` or `BACKUP_DIR`.
- Logs go to `backend/logs` (created on first write).
