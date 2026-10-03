const mysql = require('mysql2')
const { env } = require('./src/config/env')

function resolveDbHost(host) {
  const normalized = String(host || '').trim().toLowerCase()
  if (normalized === 'localhost') {
    return '127.0.0.1'
  }
  return host
}

const pool = mysql.createPool({
  host: resolveDbHost(env.db.host),
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ...(env.db.ssl ? { ssl: env.db.ssl } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

module.exports = pool.promise()
module.exports.resolveDbHost = resolveDbHost