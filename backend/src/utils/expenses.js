let schemaReadyPromise = null

async function ensureExpensesSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          category VARCHAR(100) NOT NULL,
          description VARCHAR(500) NULL,
          amount DECIMAL(12, 2) NOT NULL,
          expense_date DATE NOT NULL,
          created_by INT NULL,
          created_by_name VARCHAR(120) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_expenses_date (expense_date),
          INDEX idx_expenses_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }
  return schemaReadyPromise
}

function serializeExpense(row) {
  return {
    id: row.id,
    category: row.category,
    description: row.description || '',
    amount: Number.parseFloat(row.amount) || 0,
    expense_date: row.expense_date instanceof Date
      ? row.expense_date.toISOString().slice(0, 10)
      : String(row.expense_date).slice(0, 10),
    created_by: row.created_by,
    created_by_name: row.created_by_name || null,
    created_at: row.created_at,
  }
}

async function listExpenses(db, { days = 365 } = {}) {
  await ensureExpensesSchema(db)
  const allowed = [30, 60, 90, 120, 180, 365]
  const range = allowed.includes(Number(days)) ? Number(days) : 365
  const [rows] = await db.execute(
    `
    SELECT *
    FROM expenses
    WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    ORDER BY expense_date DESC, id DESC
    `,
    [range],
  )
  return rows.map(serializeExpense)
}

async function createExpense(db, payload, user) {
  await ensureExpensesSchema(db)
  const category = String(payload.category || '').trim()
  const description = String(payload.description || '').trim()
  const amount = Number(payload.amount)
  const expenseDate = String(payload.expense_date || '').trim() || new Date().toISOString().slice(0, 10)

  if (!category) throw Object.assign(new Error('Expense category is required'), { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Expense amount must be a positive number'), { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    throw Object.assign(new Error('expense_date must be YYYY-MM-DD'), { status: 400 })
  }

  const [result] = await db.execute(
    `
    INSERT INTO expenses (category, description, amount, expense_date, created_by, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      category,
      description || null,
      amount,
      expenseDate,
      user?.id || null,
      user?.display_name || user?.username || null,
    ],
  )

  const [rows] = await db.execute('SELECT * FROM expenses WHERE id = ? LIMIT 1', [result.insertId])
  return serializeExpense(rows[0])
}

async function deleteExpense(db, expenseId) {
  await ensureExpensesSchema(db)
  const id = Number.parseInt(expenseId, 10)
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Invalid expense id'), { status: 400 })
  }
  const [result] = await db.execute('DELETE FROM expenses WHERE id = ?', [id])
  if (result.affectedRows === 0) {
    throw Object.assign(new Error('Expense not found'), { status: 404 })
  }
  return true
}

async function summarizeExpensesToday(db) {
  await ensureExpensesSchema(db)
  const [rows] = await db.execute(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE expense_date = CURDATE()
    `,
  )
  return Number.parseFloat(rows[0]?.total) || 0
}

module.exports = {
  ensureExpensesSchema,
  listExpenses,
  createExpense,
  deleteExpense,
  summarizeExpensesToday,
  serializeExpense,
}
