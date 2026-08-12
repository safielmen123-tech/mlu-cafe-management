let schemaReadyPromise = null

async function ensureAuditSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          user_role VARCHAR(50) NULL,
          username VARCHAR(120) NULL,
          action VARCHAR(120) NOT NULL,
          module VARCHAR(120) NOT NULL,
          description TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_created (created_at),
          INDEX idx_audit_module (module),
          INDEX idx_audit_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }
  return schemaReadyPromise
}

async function writeAuditLog(db, entry = {}) {
  try {
    await ensureAuditSchema(db)
    const action = String(entry.action || '').trim()
    const moduleName = String(entry.module || '').trim()
    if (!action || !moduleName) return null

    const [result] = await db.execute(
      `
      INSERT INTO audit_logs (user_id, user_role, username, action, module, description)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        entry.userId ?? entry.user_id ?? null,
        entry.userRole ?? entry.user_role ?? null,
        entry.username ?? null,
        action.slice(0, 120),
        moduleName.slice(0, 120),
        entry.description ? String(entry.description).slice(0, 2000) : null,
      ],
    )
    return result.insertId
  } catch (error) {
    console.warn('⚠️ Audit log write skipped:', error.message)
    return null
  }
}

function actorFromRequest(req) {
  const user = req?.user
  if (!user) {
    return { userId: null, userRole: null, username: null }
  }
  return {
    userId: user.id ?? null,
    userRole: user.role ?? null,
    username: user.username || user.display_name || null,
  }
}

async function auditFromRequest(db, req, { action, module, description }) {
  const actor = actorFromRequest(req)
  return writeAuditLog(db, {
    ...actor,
    action,
    module,
    description,
  })
}

async function listAuditLogs(db, { limit = 100 } = {}) {
  await ensureAuditSchema(db)
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500)
  const [rows] = await db.execute(
    `
    SELECT id, user_id, user_role, username, action, module, description, created_at
    FROM audit_logs
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
    `,
  )
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_role: row.user_role,
    username: row.username,
    action: row.action,
    module: row.module,
    description: row.description || '',
    created_at: row.created_at,
  }))
}

module.exports = {
  ensureAuditSchema,
  writeAuditLog,
  auditFromRequest,
  actorFromRequest,
  listAuditLogs,
}
