export function parseOptionalPrice(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function availableServings(item) {
  const hot = parseOptionalPrice(item?.hot_price)
  const iced = parseOptionalPrice(item?.iced_price)
  const servings = []
  if (hot != null) servings.push({ id: 'hot', price: hot })
  if (iced != null) servings.push({ id: 'iced', price: iced })
  return servings
}

export function defaultServing(item) {
  return availableServings(item)[0]?.id ?? null
}

export function servingPrice(item, serving) {
  const match = availableServings(item).find((entry) => entry.id === serving)
  if (match) return match.price
  return parseOptionalPrice(item?.price) ?? 0
}

export function hasServingOptions(item) {
  return availableServings(item).length > 0
}

export function isDrinkMenuCategory(category) {
  const value = String(category || '').trim().toLowerCase()
  return value === 'coffee' || value === 'tea'
}

export function formatMenuPrice(item) {
  const servings = availableServings(item)
  if (servings.length === 0) {
    const price = parseOptionalPrice(item?.price)
    return `$${(price ?? 0).toFixed(2)}`
  }
  if (servings.length === 1) {
    return `$${servings[0].price.toFixed(2)}`
  }
  const [first, second] = servings
  if (first.price === second.price) {
    return `$${first.price.toFixed(2)}`
  }
  const low = Math.min(first.price, second.price)
  const high = Math.max(first.price, second.price)
  return `$${low.toFixed(2)}–$${high.toFixed(2)}`
}

export const TEA_SELECTION_FLAVORS = [
  { id: 'green', name: 'Green tea' },
  { id: 'jasmine', name: 'Jasmine tea' },
  { id: 'mint', name: 'Mint tea' },
  { id: 'ginger', name: 'Ginger tea' },
  { id: 'lemongrass', name: 'Lemongrass tea' },
]

export function needsTeaFlavor(item) {
  return /tea selection/i.test(String(item?.name || ''))
}
