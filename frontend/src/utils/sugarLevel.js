export const SUGAR_LEVELS = [
  { value: '0%', label: '0%' },
  { value: '25%', label: '25%' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: '100%' },
  { value: '120%', label: '120% / Extra Sweet' },
]

export const DEFAULT_SUGAR_LEVEL = '100%'

const NON_DRINK_CATEGORIES = new Set([
  'food',
  'bakery',
  'cocktails',
  'cocktail',
  'pastry',
  'dessert',
  'desserts',
  'snack',
  'snacks',
])

const DRINK_CATEGORIES = new Set([
  'coffee',
  'cold drinks',
  'cold drink',
  'tea',
  'matcha',
  'hot drinks',
  'hot drink',
  'drinks',
  'drink',
  'smoothie',
  'smoothies',
  'juice',
  'juices',
  'iced drinks',
  'milk tea',
  'boba',
  'shake',
  'shakes',
])

const DRINK_CATEGORY_PATTERN =
  /\b(coffee|latte|tea|matcha|drink|smoothie|juice|mocha|americano|espresso|cappuccino|frappe|shake)\b/i

export function needsSugarLevel(item) {
  const category = String(item?.category || '').trim().toLowerCase()
  if (!category) return false
  if (NON_DRINK_CATEGORIES.has(category)) return false
  if (category.includes('cocktail')) return false
  if (DRINK_CATEGORIES.has(category)) return true
  return DRINK_CATEGORY_PATTERN.test(category)
}

export function formatSugarNote(sugarLevel, extraNotes = '') {
  const level = String(sugarLevel || DEFAULT_SUGAR_LEVEL).trim() || DEFAULT_SUGAR_LEVEL
  const sugarLabel = `Sugar: ${level}`
  const extra = String(extraNotes || '').trim()
  return extra ? `${sugarLabel} · ${extra}` : sugarLabel
}

export function formatItemDisplayName(baseName, notes) {
  const name = String(baseName || '').trim() || 'Item'
  const note = String(notes || '').trim()
  if (!note) return name
  if (name.includes(`(${note})`) || /\(\s*Sugar:/i.test(name)) return name
  return `${name} (${note})`
}

export function lineIdentity(item) {
  const menuId = item?.menu_item_id ?? item?.id
  const notes = String(item?.notes || '').trim()
  return `${menuId}::${notes}`
}
