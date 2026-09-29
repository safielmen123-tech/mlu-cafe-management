const ALLOWED_ROLES = ['Admin', 'Staff']

function normalizeAllowedRole(role) {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'staff') return 'Staff'
  return null
}

function passwordPolicyError(password) {
  const value = String(password ?? '')
  const longEnough = value.length >= 8
  const hasLetter = /[A-Za-z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  if (longEnough && hasLetter && hasNumber) return null
  return 'Password must be at least 8 characters and include at least one letter and one number.'
}

module.exports = {
  ALLOWED_ROLES,
  normalizeAllowedRole,
  passwordPolicyError,
}
