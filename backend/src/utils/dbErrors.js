function isDatabaseConnectionError(error) {
  if (!error) return false

  if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST') {
    return true
  }

  if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_BAD_DB_ERROR') {
    return true
  }

  if (Array.isArray(error.errors)) {
    return error.errors.some((nested) => isDatabaseConnectionError(nested))
  }

  return false
}

function getDatabaseErrorMessage(error) {
  if (!error) {
    return 'Database is unavailable. Start MySQL in Laragon and try again.'
  }

  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return 'Database rejected the connection. Check DB_USER and DB_PASSWORD in backend/.env.'
  }

  if (error.code === 'ER_BAD_DB_ERROR') {
    return 'Database romduol_cafe_db was not found. Create/import the schema, then try again.'
  }

  return 'Database is unavailable. Start MySQL in Laragon and try again.'
}

module.exports = {
  isDatabaseConnectionError,
  getDatabaseErrorMessage,
}
