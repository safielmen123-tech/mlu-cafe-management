/**
 * Official dish names for the POS.
 * English names are stored in the database and stay the source of truth.
 * Khmer is the same as English until staff agree on official Khmer names.
 * When those names are ready, only change the `km` values in MENU_NAME_TRANSLATIONS.
 */
export const MENU_NAME_TRANSLATIONS = [
  { en: 'Espresso', km: 'Espresso' },
  { en: 'Americano', km: 'Americano' },
  { en: 'Mocha', km: 'Mocha' },
  { en: 'Cappuccino', km: 'Cappuccino' },
  { en: 'Latte', km: 'Latte' },
  { en: 'Chocolate', km: 'Chocolate' },
  { en: 'Matcha', km: 'Matcha' },
  { en: 'Matcha Espresso', km: 'Matcha Espresso' },
  { en: 'Khmer Coffee', km: 'Khmer Coffee' },
  { en: 'Passion W/ Milk', km: 'Passion W/ Milk' },
  { en: 'Passion Soda', km: 'Passion Soda' },
  { en: 'Sero Milk', km: 'Sero Milk' },
  { en: 'Red Milk Tea', km: 'Red Milk Tea' },
  { en: 'Green Milk Tea', km: 'Green Milk Tea' },
  { en: 'Butterfly Milk Tea', km: 'Butterfly Milk Tea' },
  { en: 'Green Lemon Tea', km: 'Green Lemon Tea' },
  { en: 'Tea W/ Honey & Lemon', km: 'Tea W/ Honey & Lemon' },
  { en: 'Lemon Tea W/ Syrup', km: 'Lemon Tea W/ Syrup' },
  { en: 'Tea Selection', km: 'Tea Selection' },
  { en: 'Cambodian Fish Cake', km: 'Cambodian Fish Cake' },
  { en: 'Deep Fried Spring Rolls', km: 'Deep Fried Spring Rolls' },
  { en: 'Chicken Satay', km: 'Chicken Satay' },
  { en: 'Beef Satay', km: 'Beef Satay' },
  { en: 'Fried Local Fish with Tamarind', km: 'Fried Local Fish with Tamarind' },
  { en: 'Hot Basil Chicken', km: 'Hot Basil Chicken' },
  { en: 'Beef Lok Lak', km: 'Beef Lok Lak' },
  { en: 'Chicken Ginger or Pork', km: 'Chicken Ginger or Pork' },
  { en: 'Chicken Wings or Breast', km: 'Chicken Wings or Breast' },
  { en: 'Steamed Fish', km: 'Steamed Fish' },
  { en: 'Red Snapper with Sour Sauce', km: 'Red Snapper with Sour Sauce' },
  { en: 'Fried Yellow Noodles', km: 'Fried Yellow Noodles' },
  { en: 'Garlic and Egg Fried Rice', km: 'Garlic and Egg Fried Rice' },
  { en: 'Sweet and Sour Boneless Fish', km: 'Sweet and Sour Boneless Fish' },
  { en: 'Fish Sour Soup', km: 'Fish Sour Soup' },
  { en: 'Chicken Sour Soup', km: 'Chicken Sour Soup' },
  { en: 'Beef Sour Soup with Morning Glory', km: 'Beef Sour Soup with Morning Glory' },
  { en: 'Wintermelon Soup with Pork Ribs', km: 'Wintermelon Soup with Pork Ribs' },
  { en: 'Wok Fried Morning Glory', km: 'Wok Fried Morning Glory' },
  { en: 'Mixed Vegetables', km: 'Mixed Vegetables' },
  { en: 'Pok Choy with Oyster Sauce', km: 'Pok Choy with Oyster Sauce' },
  { en: 'Mixed Seasonal Fruit Platter', km: 'Mixed Seasonal Fruit Platter' },
  { en: 'Banana Sago in Coconut Milk', km: 'Banana Sago in Coconut Milk' },
  { en: 'Sweet Corn with Coconut Milk', km: 'Sweet Corn with Coconut Milk' },
  { en: 'Bean in Coconut Milk', km: 'Bean in Coconut Milk' },
  { en: 'Fresh Lime', km: 'Fresh Lime' },
  { en: 'Fresh Pineapple', km: 'Fresh Pineapple' },
  { en: 'Fresh Watermelon', km: 'Fresh Watermelon' },
  { en: 'Fresh Mango', km: 'Fresh Mango' },
  { en: 'Fresh Coconut', km: 'Fresh Coconut' },
  { en: 'Ginger Ale', km: 'Ginger Ale' },
  { en: 'Tonic Water', km: 'Tonic Water' },
  { en: 'Cambodia Water (S)', km: 'Cambodia Water (S)' },
  { en: 'Kulen Water (1.5L)', km: 'Kulen Water (1.5L)' },
  { en: 'Cambodia', km: 'Cambodia' },
  { en: 'Tiger Crystal', km: 'Tiger Crystal' },
  { en: 'Hanuman', km: 'Hanuman' },
  { en: 'Hoegaarden', km: 'Hoegaarden' },
  { en: 'Jinro', km: 'Jinro' },
  { en: 'Corona', km: 'Corona' },
  { en: 'Hanuman Black', km: 'Hanuman Black' },
]

const TEA_FLAVOR_KEYS = {
  'green tea': 'order.teaFlavors.green',
  'jasmine tea': 'order.teaFlavors.jasmine',
  'mint tea': 'order.teaFlavors.mint',
  'ginger tea': 'order.teaFlavors.ginger',
  'lemongrass tea': 'order.teaFlavors.lemongrass',
}

const MENU_NAME_INDEX = new Map(
  MENU_NAME_TRANSLATIONS.map((entry) => [entry.en.trim().toLowerCase(), entry]),
)

function languageKey(language) {
  return language === 'km' ? 'km' : 'en'
}

function pickTranslatedName(entry, language) {
  const lang = languageKey(language)
  return String(entry?.[lang] || entry?.en || '').trim()
}

function lookupMenuEntry(name) {
  return MENU_NAME_INDEX.get(String(name || '').trim().toLowerCase()) || null
}

export function translateDrinkNotes(notes, t) {
  const raw = String(notes || '').trim()
  if (!raw || typeof t !== 'function') return raw

  return raw
    .split(/\s·\s/)
    .map((part) => {
      const value = part.trim()
      if (!value) return value
      if (/^hot$/i.test(value)) return t('order.serving.hot')
      if (/^iced$/i.test(value)) return t('order.serving.iced')

      const flavorKey = TEA_FLAVOR_KEYS[value.toLowerCase()]
      if (flavorKey) return t(flavorKey)

      const extraSweet = /^120%\s*\/\s*extra sweet$/i.test(value)
      if (extraSweet) return t('order.sugar.extraSweet')

      const sugarMatch = value.match(/^sugar:\s*(.+)$/i)
      if (sugarMatch) {
        const level = sugarMatch[1].trim()
        if (/^120%\s*\/\s*extra sweet$/i.test(level)) {
          return t('order.sugar.notePrefix', { level: t('order.sugar.extraSweet') })
        }
        return t('order.sugar.notePrefix', { level })
      }

      return value
    })
    .join(' · ')
}

export function translateMenuName(name, language, t) {
  const raw = String(name || '').trim()
  if (!raw) return raw

  const exact = lookupMenuEntry(raw)
  if (exact) return pickTranslatedName(exact, language)

  const noteMatch = raw.match(/^(.*?)\s*\((.+)\)$/)
  if (noteMatch) {
    const base = noteMatch[1].trim()
    const notes = noteMatch[2].trim()
    const baseEntry = lookupMenuEntry(base)
    if (baseEntry) {
      const translatedBase = pickTranslatedName(baseEntry, language)
      return `${translatedBase} (${translateDrinkNotes(notes, t)})`
    }
  }

  return raw
}

export function translateMenuSummary(summary, language, t) {
  const raw = String(summary || '').trim()
  if (!raw) return raw

  return raw
    .split(/,\s*/)
    .map((part) => {
      const qtyMatch = part.match(/^(\d+\s*[×x]\s*)(.+)$/i)
      if (qtyMatch) {
        return `${qtyMatch[1]}${translateMenuName(qtyMatch[2], language, t)}`
      }
      return translateMenuName(part, language, t)
    })
    .join(', ')
}

export function menuNameMatchesQuery(name, query, language, t) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return true
  const english = String(name || '').toLowerCase()
  const translated = translateMenuName(name, language, t).toLowerCase()
  return english.includes(needle) || translated.includes(needle)
}
