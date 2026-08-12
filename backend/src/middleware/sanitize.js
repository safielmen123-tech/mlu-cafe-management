const MAX_STRING_LENGTH = 5000
const MAX_DEPTH = 6

// Keys whose values are secrets: they get null-byte stripping only. Altering the
// characters of a password would silently change what gets hashed or compared.
const RAW_VALUE_KEYS = new Set(['password', 'newPassword', 'currentPassword', 'confirmPassword'])

// Blocking these stops attacker-supplied JSON from walking up Object.prototype.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi
const HTML_TAG = /<\/?[a-z][^>]*>/gi
const DANGEROUS_URI = /\b(?:javascript|vbscript|data)\s*:/gi
const EVENT_HANDLER = /\bon[a-z]+\s*=/gi
// Control characters are never meaningful here and are a classic log/command injection vector.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

function sanitizeString(value, { raw = false } = {}) {
  let out = value.replace(/\0/g, '')
  if (raw) return out.slice(0, MAX_STRING_LENGTH)

  out = out.replace(CONTROL_CHARS, '')
  out = out.replace(SCRIPT_BLOCK, '')
  out = out.replace(HTML_TAG, '')
  out = out.replace(EVENT_HANDLER, '')
  out = out.replace(DANGEROUS_URI, '')

  return out.trim().slice(0, MAX_STRING_LENGTH)
}

function sanitizeValue(value, key, depth) {
  if (depth > MAX_DEPTH) return null

  if (typeof value === 'string') {
    return sanitizeString(value, { raw: RAW_VALUE_KEYS.has(key) })
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, depth + 1))
  }

  if (value && typeof value === 'object') {
    const out = {}
    for (const [childKey, childValue] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(childKey)) continue
      out[childKey] = sanitizeValue(childValue, childKey, depth + 1)
    }
    return out
  }

  return value
}

/** Sanitizes in place; Express 5 exposes req.query as a getter that cannot be reassigned. */
function sanitizeInPlace(target) {
  if (!target || typeof target !== 'object') return
  for (const [key, value] of Object.entries(target)) {
    if (FORBIDDEN_KEYS.has(key)) {
      delete target[key]
      continue
    }
    target[key] = sanitizeValue(value, key, 0)
  }
}

function sanitizeRequest(req, _res, next) {
  sanitizeInPlace(req.body)
  sanitizeInPlace(req.params)
  sanitizeInPlace(req.query)
  next()
}

module.exports = {
  sanitizeRequest,
  sanitizeString,
}
