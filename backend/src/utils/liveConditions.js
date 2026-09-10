/**
 * Live weather and USD→KHR rate for the dashboard.
 * Both calls use fixed public URLs (no API keys, no user-controlled hosts)
 * and are cached so a busy till cannot hammer the upstream APIs.
 */
const { env } = require('../config/env')

const CACHE_TTL_MS = 15 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const EXCHANGE_URL = 'https://open.er-api.com/v6/latest/USD'

const DEFAULT_LAT = 13.3644
const DEFAULT_LON = 103.8603
const DEFAULT_LOCATION = 'Siem Reap'

const WMO_CONDITIONS = {
  0: 'clear',
  1: 'mainly_clear',
  2: 'partly_cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'drizzle',
  57: 'drizzle',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'thunderstorm',
  96: 'thunderstorm',
  99: 'thunderstorm',
}

let cache = {
  expiresAt: 0,
  payload: null,
}

function parseCoord(value, fallback) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function weatherCoords() {
  return {
    latitude: parseCoord(env.liveConditions.weatherLat, DEFAULT_LAT),
    longitude: parseCoord(env.liveConditions.weatherLon, DEFAULT_LON),
    location: String(env.liveConditions.weatherLocation || DEFAULT_LOCATION).trim() || DEFAULT_LOCATION,
  }
}

function conditionFromCode(code) {
  return WMO_CONDITIONS[Number(code)] || 'unknown'
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function unavailable(reason) {
  return { ok: false, reason }
}

async function loadWeather() {
  const { latitude, longitude, location } = weatherCoords()
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    timezone: 'Asia/Phnom_Penh',
    wind_speed_unit: 'kmh',
  })

  try {
    const data = await fetchJson(`${WEATHER_URL}?${params.toString()}`)
    const current = data?.current || {}
    const temperatureC = Number(current.temperature_2m)
    const humidity = Number(current.relative_humidity_2m)
    const windKmh = Number(current.wind_speed_10m)
    const weatherCode = Number(current.weather_code)

    if (!Number.isFinite(temperatureC)) {
      return unavailable('invalid_weather')
    }

    return {
      ok: true,
      location,
      temperatureC: Math.round(temperatureC),
      humidity: Number.isFinite(humidity) ? Math.round(humidity) : null,
      windKmh: Number.isFinite(windKmh) ? Math.round(windKmh) : null,
      weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
      condition: conditionFromCode(weatherCode),
      updatedAt: current.time || null,
    }
  } catch {
    return unavailable('weather_unreachable')
  }
}

async function loadExchange() {
  try {
    const data = await fetchJson(EXCHANGE_URL)
    const khrPerUsd = Number(data?.rates?.KHR)
    if (!Number.isFinite(khrPerUsd) || khrPerUsd <= 0) {
      return unavailable('invalid_rate')
    }

    return {
      ok: true,
      base: 'USD',
      quote: 'KHR',
      khrPerUsd: Math.round(khrPerUsd),
      updatedAt: data.time_last_update_utc || null,
    }
  } catch {
    return unavailable('exchange_unreachable')
  }
}

async function getLiveConditions({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache.payload && cache.expiresAt > now) {
    return cache.payload
  }

  const [weather, exchange] = await Promise.all([loadWeather(), loadExchange()])
  const payload = {
    weather,
    exchange,
    fetchedAt: new Date().toISOString(),
  }
  cache = {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  }
  return payload
}

module.exports = {
  getLiveConditions,
  conditionFromCode,
}
