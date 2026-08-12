const bcrypt = require('bcrypt')
const crypto = require('crypto')

const BCRYPT_COST = 10

/**
 * A throwaway hash at the same cost the app uses for real passwords. Comparing against
 * it when an account is missing keeps the failed-login response time roughly constant,
 * which stops attackers from discovering valid usernames by timing the endpoint.
 */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), BCRYPT_COST)

async function equalizeFailedLoginTiming(plainPassword) {
  try {
    await bcrypt.compare(String(plainPassword || ''), DUMMY_HASH)
  } catch {
    /* the result is irrelevant; this call exists only to burn equivalent time */
  }
  return false
}

function normalizeLoginInput(username, password) {
  const normalizedUsername = String(username ?? '').trim().toLowerCase()
  const plainPassword = password == null ? '' : String(password)

  return {
    normalizedUsername,
    plainPassword,
  }
}

function resolveStoredPasswordHash(user) {
  const hash = user?.password_hash ?? user?.password ?? null
  if (hash == null) return null

  const normalized = String(hash).trim()
  return normalized || null
}

async function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) {
    return false
  }

  return bcrypt.compare(plainPassword, storedHash)
}

function buildTokenPayload(user) {
  const id = Number.parseInt(user?.id, 10)
  const username = String(user?.username ?? '').trim()
  const role = String(user?.role ?? 'Staff').trim() || 'Staff'

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('User record is missing a valid id')
  }

  if (!username) {
    throw new Error('User record is missing a username')
  }

  return { id, username, role }
}

function assertJwtSecret(jwtSecret) {
  const secret = String(jwtSecret ?? '').trim()
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return secret
}

module.exports = {
  normalizeLoginInput,
  resolveStoredPasswordHash,
  verifyPassword,
  equalizeFailedLoginTiming,
  buildTokenPayload,
  assertJwtSecret,
  BCRYPT_COST,
}
