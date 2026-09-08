const mysql = require('mysql2')
const {
  resolveCliTool,
  buildMysqlArgs,
  runCliProcess,
  getDatabaseName,
} = require('./mysqlCli')
const {
  buildBackupFilename,
  buildMetadataComments,
  parseBackupMetadata,
} = require('./backupPeriod')

const REFERENCE_TABLES = ['menu_items', 'users', 'inventory', 'tables']
const TRANSACTIONAL_TABLES = ['orders', 'order_items', 'reservations']

async function getTableColumns(db, tableName) {
  const [rows] = await db.execute(`SHOW COLUMNS FROM \`${tableName}\``)
  return rows.map((row) => row.Field)
}

function serializeCellValue(value) {
  if (value instanceof Date) {
    return mysql.escape(value.toISOString().slice(0, 19).replace('T', ' '))
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`
  }
  if (typeof value === 'object' && value !== null) {
    return mysql.escape(JSON.stringify(value))
  }
  return mysql.escape(value)
}

function buildReplaceStatements(tableName, rows, columns) {
  if (!rows.length) return `-- No rows for \`${tableName}\`\n`

  const columnList = columns.map((column) => `\`${column}\``).join(', ')
  return rows.map((row) => {
    const values = columns.map((column) => serializeCellValue(row[column])).join(', ')
    return `REPLACE INTO \`${tableName}\` (${columnList}) VALUES (${values});`
  }).join('\n')
}

async function fetchTableRows(db, tableName, whereClause = '', params = []) {
  const sql = `SELECT * FROM \`${tableName}\`${whereClause ? ` WHERE ${whereClause}` : ''}`
  const [rows] = await db.execute(sql, params)
  return rows
}

async function buildPeriodDeleteStatements(db, period) {
  const [orderRows] = await db.execute(
    `SELECT id FROM orders WHERE updated_at >= ? AND updated_at < ?`,
    [period.startDate, period.endDate],
  )
  const orderIds = orderRows.map((row) => row.id)

  const lines = [
    '-- Remove existing records for this period before re-importing',
    `DELETE oi FROM order_items oi`,
    `INNER JOIN orders o ON o.id = oi.order_id`,
    `WHERE o.updated_at >= '${period.startDate}' AND o.updated_at < '${period.endDate}';`,
    `DELETE FROM orders WHERE updated_at >= '${period.startDate}' AND updated_at < '${period.endDate}';`,
  ]

  if (orderIds.length) {
    lines.push(`-- Targeted cleanup for ${orderIds.length} order(s) in ${period.label}`)
  }

  return `${lines.join('\n')}\n`
}

async function createPeriodDatabaseDump(db, period) {
  const sections = [
    ...buildMetadataComments(period),
    `SET FOREIGN_KEY_CHECKS=0;`,
    `SET NAMES utf8mb4;`,
    `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";`,
    '',
    await buildPeriodDeleteStatements(db, period),
  ]

  for (const tableName of REFERENCE_TABLES) {
    const columns = await getTableColumns(db, tableName)
    const rows = await fetchTableRows(db, tableName)
    sections.push(`-- Reference table: ${tableName}`)
    sections.push(buildReplaceStatements(tableName, rows, columns))
    sections.push('')
  }

  const orderColumns = await getTableColumns(db, 'orders')
  const orders = await fetchTableRows(
    db,
    'orders',
    'updated_at >= ? AND updated_at < ?',
    [period.startDate, period.endDate],
  )
  sections.push(`-- Transactional table: orders (${period.label})`)
  sections.push(buildReplaceStatements('orders', orders, orderColumns))
  sections.push('')

  const orderItems = await fetchTableRows(
    db,
    'order_items',
    `order_id IN (SELECT id FROM orders WHERE updated_at >= ? AND updated_at < ?)`,
    [period.startDate, period.endDate],
  )
  const orderItemColumns = await getTableColumns(db, 'order_items')
  sections.push(`-- Transactional table: order_items (${period.label})`)
  sections.push(buildReplaceStatements('order_items', orderItems, orderItemColumns))
  sections.push('')

  try {
    const reservationColumns = await getTableColumns(db, 'reservations')
    const reservations = await fetchTableRows(
      db,
      'reservations',
      'reservation_date >= ? AND reservation_date < ?',
      [period.startDate, period.endDate],
    )
    sections.push(`-- Transactional table: reservations (${period.label})`)
    sections.push(buildReplaceStatements('reservations', reservations, reservationColumns))
    sections.push('')
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error
  }

  sections.push('SET FOREIGN_KEY_CHECKS=1;')

  const buffer = Buffer.from(sections.join('\n'), 'utf8')
  return {
    buffer,
    filename: buildBackupFilename('mlu-kitchen-cafe-database', 'sql', period),
  }
}

async function createFullDatabaseDump(period) {
  const mysqldumpPath = resolveCliTool('mysqldump')
  const database = getDatabaseName()

  const args = [
    ...buildMysqlArgs(),
    '--single-transaction',
    '--routines',
    '--triggers',
    '--add-drop-table',
    '--default-character-set=utf8mb4',
    database,
  ]

  const { stdout } = await runCliProcess(mysqldumpPath, args)
  const header = [
    ...buildMetadataComments(period),
    `-- Database: ${database}`,
    'SET FOREIGN_KEY_CHECKS=0;',
    'SET NAMES utf8mb4;',
    'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";',
    '',
  ].join('\n')

  const footer = '\nSET FOREIGN_KEY_CHECKS=1;\n'
  const dumpBuffer = Buffer.concat([
    Buffer.from(header, 'utf8'),
    stdout,
    Buffer.from(footer, 'utf8'),
  ])

  return {
    buffer: dumpBuffer,
    filename: buildBackupFilename('mlu-kitchen-cafe-database', 'sql', period),
  }
}

async function createDatabaseDump(db, period) {
  if (period.scope === 'month') {
    return createPeriodDatabaseDump(db, period)
  }
  return createFullDatabaseDump(period)
}

function validateSqlContent(sqlContent) {
  const trimmed = String(sqlContent || '').trim()

  if (!trimmed) {
    throw new Error('The uploaded SQL file is empty')
  }

  if (trimmed.length > 100 * 1024 * 1024) {
    throw new Error('The uploaded SQL file exceeds the 100 MB limit')
  }

  const looksLikeSql = /(?:CREATE|INSERT|REPLACE|DROP|ALTER|SET|DELETE|USE)\s+/i.test(trimmed)
  if (!looksLikeSql) {
    throw new Error('The uploaded file does not appear to be a valid SQL dump')
  }

  return trimmed
}

function ensureDropTableBeforeCreate(sqlContent) {
  return sqlContent.replace(/(^|\n)(CREATE TABLE(?: IF NOT EXISTS)?\s+(`[^`]+`|\w+))/gi, (match, prefix, createStatement, tableRef, offset, fullText) => {
    const tableName = tableRef.replace(/`/g, '')
    const lookback = fullText.slice(Math.max(0, offset - 300), offset)
    const dropPattern = new RegExp(`DROP TABLE IF EXISTS\\s+\`?${tableName}\`?`, 'i')

    if (dropPattern.test(lookback)) {
      return match
    }

    return `${prefix}DROP TABLE IF EXISTS \`${tableName}\`;\n${createStatement}`
  })
}

function convertInsertToReplace(sqlContent) {
  return sqlContent.replace(/\bINSERT INTO\b/gi, 'REPLACE INTO')
}

function preprocessSqlForRestore(sqlContent) {
  const sanitizedSql = validateSqlContent(sqlContent)
  const metadata = parseBackupMetadata(sanitizedSql)

  let processedSql = sanitizedSql

  if (metadata.scope === 'all') {
    processedSql = ensureDropTableBeforeCreate(processedSql)
  }

  processedSql = convertInsertToReplace(processedSql)

  const preamble = [
    'SET FOREIGN_KEY_CHECKS=0;',
    'SET NAMES utf8mb4;',
    'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";',
    '',
  ].join('\n')

  const postamble = '\nSET FOREIGN_KEY_CHECKS=1;\n'
  const restoreScript = `${preamble}${processedSql}${postamble}`

  return {
    sql: restoreScript,
    metadata,
  }
}

async function restoreDatabaseFromSql(sqlContent) {
  const mysqlPath = resolveCliTool('mysql')
  const database = getDatabaseName()
  const { sql, metadata } = preprocessSqlForRestore(sqlContent)

  const args = [...buildMysqlArgs(), database]
  await runCliProcess(mysqlPath, args, sql)

  const scopeMessage = metadata.scope === 'month'
    ? `Records for ${metadata.label} were safely overwritten without duplicates.`
    : 'Database restored successfully from SQL backup.'

  return {
    message: scopeMessage,
    database,
    period: metadata.label,
    scope: metadata.scope,
  }
}

module.exports = {
  createDatabaseDump,
  restoreDatabaseFromSql,
  validateSqlContent,
  preprocessSqlForRestore,
  REFERENCE_TABLES,
  TRANSACTIONAL_TABLES,
}
