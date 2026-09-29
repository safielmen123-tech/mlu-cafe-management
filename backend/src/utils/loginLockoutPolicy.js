/**
 * Progressive login lockout.
 * Stage 1: 5 failures → 1 minute
 * Stage 2: 3 more failures → 10 minutes
 * Stage 3: 1 more failure → 24 hours and an admin alert
 * After the 24-hour lock expires, the counter returns to stage 1.
 */

const INVALID_CREDENTIALS_MESSAGE = 'Username or password is incorrect.'
const LOCKOUT_MESSAGE = 'Too many attempts. Please try again later.'

const STAGE_RULES = {
  1: { failures: 5, lockMs: 60 * 1000 },
  2: { failures: 3, lockMs: 10 * 60 * 1000 },
  3: { failures: 1, lockMs: 24 * 60 * 60 * 1000 },
}

function emptyAttempt() {
  return { failedCount: 0, stage: 1, lockedUntil: null }
}

function applyExpiry(attempt, nowMs) {
  const current = attempt
    ? {
        failedCount: Number(attempt.failedCount) || 0,
        stage: Number(attempt.stage) || 1,
        lockedUntil: attempt.lockedUntil ?? null,
      }
    : emptyAttempt()

  if (current.lockedUntil == null || current.lockedUntil > nowMs) {
    return current
  }

  if (current.stage >= 3) {
    return emptyAttempt()
  }

  return { failedCount: 0, stage: current.stage + 1, lockedUntil: null }
}

function lockRemainingSeconds(attempt, nowMs) {
  if (!attempt?.lockedUntil || attempt.lockedUntil <= nowMs) return 0
  return Math.max(1, Math.ceil((attempt.lockedUntil - nowMs) / 1000))
}

function isLocked(attempt, nowMs) {
  return lockRemainingSeconds(attempt, nowMs) > 0
}

function registerFailure(attempt, nowMs) {
  const current = applyExpiry(attempt, nowMs)
  if (isLocked(current, nowMs)) {
    return { attempt: current, triggeredLock: false, triggeredAlert: false, alreadyLocked: true }
  }

  const stage = current.stage
  const rule = STAGE_RULES[stage] || STAGE_RULES[1]
  const failedCount = current.failedCount + 1

  if (failedCount >= rule.failures) {
    return {
      attempt: { failedCount, stage, lockedUntil: nowMs + rule.lockMs },
      triggeredLock: true,
      triggeredAlert: stage === 3,
      alreadyLocked: false,
    }
  }

  return {
    attempt: { failedCount, stage, lockedUntil: null },
    triggeredLock: false,
    triggeredAlert: false,
    alreadyLocked: false,
  }
}

function cumulativeFailures(stage, failedCount) {
  const count = Number(failedCount) || 0
  if (stage <= 1) return count
  if (stage === 2) return STAGE_RULES[1].failures + count
  return STAGE_RULES[1].failures + STAGE_RULES[2].failures + count
}

module.exports = {
  INVALID_CREDENTIALS_MESSAGE,
  LOCKOUT_MESSAGE,
  STAGE_RULES,
  emptyAttempt,
  applyExpiry,
  lockRemainingSeconds,
  isLocked,
  registerFailure,
  cumulativeFailures,
}
