const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parseBackupPeriod(query = {}) {
  const rawMonth = query.month
  const rawYear = query.year

  if (rawMonth === undefined && rawYear === undefined) {
    return buildAllTimePeriod()
  }

  if (rawMonth === '' && rawYear === '') {
    return buildAllTimePeriod()
  }

  const month = Number.parseInt(rawMonth, 10)
  const year = Number.parseInt(rawYear, 10)

  if (
    !Number.isInteger(month)
    || month < 1
    || month > 12
    || !Number.isInteger(year)
    || year < 2000
    || year > 2100
  ) {
    throw new Error('Invalid month or year. Use month=1-12 and year=YYYY, or omit both for all-time exports.')
  }

  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return {
    scope: 'month',
    month,
    year,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    slug: `${MONTH_NAMES[month - 1]}-${year}`,
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

function buildAllTimePeriod() {
  return {
    scope: 'all',
    month: null,
    year: null,
    label: 'All Time',
    slug: 'All-Time',
    startDate: null,
    endDate: null,
  }
}

function buildBackupFilename(baseName, extension, period) {
  return `${baseName}-${period.slug}.${extension}`
}

function buildOrderPeriodClause(column = 'updated_at') {
  return (period) => {
    if (period.scope !== 'month') {
      return { clause: '', params: [] }
    }

    return {
      clause: `${column} >= ? AND ${column} < ?`,
      params: [period.startDate, period.endDate],
    }
  }
}

function appendWhere(baseClause, addition) {
  if (!addition.clause) return { clause: baseClause, params: addition.params || [] }
  if (!baseClause) return addition
  return {
    clause: `${baseClause} AND ${addition.clause}`,
    params: [...(addition.params || [])],
  }
}

function parseBackupMetadata(sqlContent) {
  const monthMatch = sqlContent.match(/^--\s*Backup-Month:\s*(\d+)/m)
  const yearMatch = sqlContent.match(/^--\s*Backup-Year:\s*(\d+)/m)
  const scopeMatch = sqlContent.match(/^--\s*Backup-Scope:\s*(\w+)/m)

  if (scopeMatch?.[1] === 'month' && monthMatch && yearMatch) {
    try {
      return parseBackupPeriod({
        month: monthMatch[1],
        year: yearMatch[1],
      })
    } catch {
      return buildAllTimePeriod()
    }
  }

  return buildAllTimePeriod()
}

function buildMetadataComments(period) {
  const lines = [
    '-- Romdoul Restaurant / Cafe System Database Backup',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Backup-Scope: ${period.scope}`,
    `-- Backup-Period: ${period.label}`,
  ]

  if (period.scope === 'month') {
    lines.push(`-- Backup-Month: ${period.month}`)
    lines.push(`-- Backup-Year: ${period.year}`)
  }

  return lines
}

module.exports = {
  MONTH_NAMES,
  parseBackupPeriod,
  buildBackupFilename,
  buildOrderPeriodClause,
  appendWhere,
  parseBackupMetadata,
  buildMetadataComments,
}
