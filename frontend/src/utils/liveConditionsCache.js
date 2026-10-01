const STORAGE_KEY = 'mlu_kitchen_cafe.live_conditions'

export function readLiveConditions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.weather && !parsed?.exchange) return null
    return parsed
  } catch {
    return null
  }
}

export function writeLiveConditions({ weather, exchange }) {
  const current = readLiveConditions() || {}
  const now = new Date().toISOString()
  const next = {
    weather: weather || current.weather || null,
    exchange: exchange || current.exchange || null,
    weatherSavedAt: weather ? now : current.weatherSavedAt || current.savedAt || null,
    exchangeSavedAt: exchange ? now : current.exchangeSavedAt || current.savedAt || null,
    savedAt: now,
  }
  if (!next.weather && !next.exchange) return null
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
