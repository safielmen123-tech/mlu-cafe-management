/**
 * Replaces the live menu with the photographed Romduol boards.
 * Coffee/Tea keep Hot/Iced prices. Cold drinks, beer, and food use one price.
 * Dried fish (#10) and signature mocktails are skipped until photos are dropped.
 *
 * Copies photos from menu-photos/ (same filename as the dish in the app),
 * then deletes leftover old menu images so only the current set remains.
 *
 * Usage: npm run seed:menu
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const pool = require('../db')
const { ensureMenuItemsSchema, menuCategoryFieldSql } = require('../src/utils/menuItemsSchema')

const IMAGE_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'menu-images')
const THUMB_DIR = path.join(IMAGE_DIR, 'thumbs')
const PHOTO_SOURCE = path.join(__dirname, '..', '..', 'menu-photos')
const PUBLIC_PREFIX = '/menu-images'
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const DRINKS = [
  { name: 'Espresso', category: 'Coffee', hot: 1.0, iced: null, file: 'espresso.jpg' },
  { name: 'Americano', category: 'Coffee', hot: 1.0, iced: 1.5, file: 'americano.jpg' },
  { name: 'Mocha', category: 'Coffee', hot: 2.5, iced: 3.0, file: 'mocha.jpg' },
  { name: 'Cappuccino', category: 'Coffee', hot: 2.0, iced: 2.5, file: 'cappuccino.jpg' },
  { name: 'Latte', category: 'Coffee', hot: 2.0, iced: 2.5, file: 'latte.jpg' },
  { name: 'Chocolate', category: 'Coffee', hot: 2.0, iced: 2.5, file: 'chocolate.jpg' },
  { name: 'Matcha', category: 'Coffee', hot: 2.75, iced: 3.0, file: 'matcha.jpg' },
  { name: 'Matcha Espresso', category: 'Coffee', hot: 3.0, iced: 3.25, file: 'matcha-espresso.jpg' },
  { name: 'Khmer Coffee', category: 'Coffee', hot: 1.25, iced: 1.5, file: 'khmer-coffee.jpg' },
  { name: 'Passion W/ Milk', category: 'Coffee', hot: null, iced: 2.0, file: 'passion-with-milk.jpg' },
  { name: 'Passion Soda', category: 'Coffee', hot: null, iced: 2.0, file: 'passion-soda.jpg' },
  { name: 'Sero Milk', category: 'Coffee', hot: 1.5, iced: 1.5, file: 'sero-milk.jpg' },
  { name: 'Red Milk Tea', category: 'Tea', hot: null, iced: 1.5, file: 'red-milk-tea.jpg' },
  { name: 'Green Milk Tea', category: 'Tea', hot: null, iced: 1.5, file: 'green-milk-tea.jpg' },
  { name: 'Butterfly Milk Tea', category: 'Tea', hot: null, iced: 1.5, file: 'butterfly-milk-tea.jpg' },
  { name: 'Green Lemon Tea', category: 'Tea', hot: 1.5, iced: 2.0, file: 'green-lemon-tea.jpg' },
  { name: 'Tea W/ Honey & Lemon', category: 'Tea', hot: 1.75, iced: 2.25, file: 'tea-honey-lemon.jpg' },
  { name: 'Lemon Tea W/ Syrup', category: 'Tea', hot: null, iced: 2.0, file: 'lemon-tea-syrup.jpg' },
  { name: 'Tea Selection', category: 'Tea', hot: 1.0, iced: 1.5, file: 'tea-selection.jpg' },
]

const COLD_DRINKS = [
  { name: 'Fresh Lime', category: 'Cold Drinks', price: 1.5, file: 'fresh-lime.jpg' },
  { name: 'Fresh Pineapple', category: 'Cold Drinks', price: 2.5, file: 'fresh-pineapple.jpg' },
  { name: 'Fresh Watermelon', category: 'Cold Drinks', price: 2.5, file: 'fresh-watermelon.jpg' },
  { name: 'Fresh Mango', category: 'Cold Drinks', price: 2.5, file: 'fresh-mango.jpg' },
  { name: 'Fresh Coconut', category: 'Cold Drinks', price: 1.5, file: 'fresh-coconut.jpg' },
  { name: 'Ginger Ale', category: 'Cold Drinks', price: 1.5, file: 'ginger-ale.jpg' },
  { name: 'Tonic Water', category: 'Cold Drinks', price: 1.0, file: 'tonic-water.jpg' },
  { name: 'Cambodia Water (S)', category: 'Cold Drinks', price: 0.5, file: 'cambodia-water.jpg' },
  { name: 'Kulen Water (1.5L)', category: 'Cold Drinks', price: 2.0, file: 'kulen-water.jpg' },
]

const BEERS = [
  { name: 'Cambodia', category: 'Beer', price: 1.5, file: 'cambodia-beer.jpg' },
  { name: 'Tiger Crystal', category: 'Beer', price: 2.5, file: 'tiger-crystal.jpg' },
  { name: 'Hanuman', category: 'Beer', price: 1.5, file: 'hanuman.jpg' },
  { name: 'Hoegaarden', category: 'Beer', price: 3.5, file: 'hoegaarden.jpg' },
  { name: 'Jinro', category: 'Beer', price: 4.0, file: 'jinro.jpg' },
  { name: 'Corona', category: 'Beer', price: 2.5, file: 'corona.jpg' },
  { name: 'Hanuman Black', category: 'Beer', price: 1.75, file: 'hanuman-black.jpg' },
]

const FOOD = [
  { name: 'Cambodian Fish Cake', category: 'Starters', price: 3.0, file: 'cambodian-fish-cake.jpg' },
  { name: 'Deep Fried Spring Rolls', category: 'Starters', price: 2.5, file: 'deep-fried-spring-rolls.jpg' },
  { name: 'Chicken Satay', category: 'Starters', price: 3.0, file: 'chicken-satay.jpg' },
  { name: 'Beef Satay', category: 'Starters', price: 3.5, file: 'beef-satay.jpg' },

  { name: 'Fried Local Fish with Tamarind', category: 'Mains', price: 3.5, file: 'fried-local-fish-tamarind.jpg' },
  { name: 'Hot Basil Chicken', category: 'Mains', price: 3.5, file: 'hot-basil-chicken.jpg' },
  { name: 'Beef Lok Lak', category: 'Mains', price: 4.75, file: 'beef-lok-lak.jpg' },
  { name: 'Chicken Ginger or Pork', category: 'Mains', price: 3.5, file: 'chicken-ginger-or-pork.jpg' },
  { name: 'Chicken Wings or Breast', category: 'Mains', price: 3.75, file: 'chicken-wings.jpg' },
  { name: 'Steamed Fish', category: 'Mains', price: 5.5, file: 'steamed-fish.jpg' },
  { name: 'Red Snapper with Sour Sauce', category: 'Mains', price: 6.0, file: 'red-snapper-sour-sauce.jpg' },
  { name: 'Fried Yellow Noodles', category: 'Mains', price: 3.0, file: 'fried-yellow-noodles.jpg' },
  { name: 'Garlic and Egg Fried Rice', category: 'Mains', price: 2.5, file: 'garlic-egg-fried-rice.jpg' },
  { name: 'Sweet and Sour Boneless Fish', category: 'Mains', price: 4.0, file: 'sweet-and-sour-boneless-fish.jpg' },

  { name: 'Fish Sour Soup', category: 'Soup', price: 3.5, file: 'fish-or-chicken-sour-soup.jpg' },
  { name: 'Chicken Sour Soup', category: 'Soup', price: 3.5, file: 'fish-or-chicken-sour-soup.jpg' },
  { name: 'Beef Sour Soup with Morning Glory', category: 'Soup', price: 4.0, file: 'beef-sour-soup-morning-glory.jpg' },
  { name: 'Wintermelon Soup with Pork Ribs', category: 'Soup', price: 4.0, file: 'wintermelon-soup-pork-ribs.jpg' },

  { name: 'Wok Fried Morning Glory', category: 'Vegetable', price: 3.0, file: 'wok-fried-morning-glory.jpg' },
  { name: 'Mixed Vegetables', category: 'Vegetable', price: 3.5, file: 'mixed-vegetables.jpg' },
  { name: 'Pok Choy with Oyster Sauce', category: 'Vegetable', price: 3.0, file: 'pok-choy-oyster-sauce.jpg' },

  { name: 'Mixed Seasonal Fruit Platter', category: 'Dessert', price: 3.0, file: 'mixed-seasonal-fruit-platter.jpg' },
  { name: 'Banana Sago in Coconut Milk', category: 'Dessert', price: 3.0, file: 'banana-sago-coconut-milk.jpg' },
  { name: 'Sweet Corn with Coconut Milk', category: 'Dessert', price: 3.0, file: 'sweet-corn-coconut-milk.jpg' },
  { name: 'Bean in Coconut Milk', category: 'Dessert', price: 3.0, file: 'bean-in-coconut-milk.jpg' },
]

function displayPrice(hot, iced) {
  const offered = [hot, iced].filter((value) => value != null)
  return Math.min(...offered)
}

function copyPhotos() {
  if (!fs.existsSync(PHOTO_SOURCE)) {
    throw new Error(`Photo drop folder is missing: ${PHOTO_SOURCE}`)
  }
  fs.mkdirSync(IMAGE_DIR, { recursive: true })

  const missing = []
  const items = [...DRINKS, ...COLD_DRINKS, ...BEERS, ...FOOD]
  for (const item of items) {
    const from = path.join(PHOTO_SOURCE, item.file)
    const to = path.join(IMAGE_DIR, item.file)
    if (!fs.existsSync(from)) {
      missing.push(`${item.name} (${item.file})`)
      continue
    }
    fs.copyFileSync(from, to)
  }

  if (missing.length) {
    throw new Error(`Missing photo file(s) in menu-photos: ${missing.join(', ')}`)
  }

  return items.map((item) => item.file)
}

function removeOldPhotos(keepFiles) {
  const keep = new Set(['placeholder.jpg', ...keepFiles.map((name) => name.toLowerCase())])
  const removed = []

  for (const name of fs.readdirSync(IMAGE_DIR)) {
    const full = path.join(IMAGE_DIR, name)
    if (fs.statSync(full).isDirectory()) continue
    if (!PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase())) continue
    if (keep.has(name.toLowerCase())) continue
    fs.unlinkSync(full)
    removed.push(name)
  }

  if (fs.existsSync(THUMB_DIR)) {
    const keepThumbs = new Set(
      [...keep].map((name) => `${path.basename(name, path.extname(name)).toLowerCase()}.webp`),
    )
    for (const name of fs.readdirSync(THUMB_DIR)) {
      if (path.extname(name).toLowerCase() !== '.webp') continue
      if (keepThumbs.has(name.toLowerCase())) continue
      fs.unlinkSync(path.join(THUMB_DIR, name))
      removed.push(`thumbs/${name}`)
    }
  }

  return removed
}

function buildThumbs() {
  const script = path.join(__dirname, '..', '..', 'frontend', 'scripts', 'optimize-menu-thumbs.mjs')
  const cwd = path.join(__dirname, '..', '..', 'frontend')
  const result = spawnSync(process.execPath, [script], { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Thumbnail script exited ${result.status}`)
  }
}

async function main() {
  const db = pool

  console.log('1/6  Backfilling order_items.item_name from menu_items…')
  const [backfill] = await db.query(`
    UPDATE order_items oi
    JOIN menu_items m ON m.id = oi.menu_item_id
    SET oi.item_name = m.name
    WHERE oi.item_name IS NULL OR oi.item_name = ''
  `)
  console.log(`     preserved ${backfill.affectedRows} historical line item name(s)`)

  const [[remaining]] = await db.query(`
    SELECT COUNT(*) AS c FROM order_items
    WHERE (item_name IS NULL OR item_name = '') AND menu_item_id IS NOT NULL
  `)
  if (remaining.c > 0) {
    throw new Error(`Aborting: ${remaining.c} order line item(s) still have no preserved name.`)
  }

  console.log('2/6  Copying photos (typos in drop-folder names are mapped)…')
  const keepFiles = copyPhotos()
  console.log(`     copied ${keepFiles.length} photo(s)`)

  console.log('3/6  Ensuring categories and price columns…')
  await ensureMenuItemsSchema(db)

  console.log('4/6  Replacing the full menu…')
  await db.query('DELETE FROM menu_items')

  for (const drink of DRINKS) {
    await db.query(
      `INSERT INTO menu_items (name, category, price, hot_price, iced_price, image_url, is_available)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        drink.name,
        drink.category,
        displayPrice(drink.hot, drink.iced),
        drink.hot,
        drink.iced,
        `${PUBLIC_PREFIX}/${drink.file}`,
      ],
    )
  }

  for (const item of [...COLD_DRINKS, ...BEERS, ...FOOD]) {
    await db.query(
      `INSERT INTO menu_items (name, category, price, hot_price, iced_price, image_url, is_available)
       VALUES (?, ?, ?, NULL, NULL, ?, 1)`,
      [item.name, item.category, item.price, `${PUBLIC_PREFIX}/${item.file}`],
    )
  }

  console.log('5/6  Removing leftover old menu images…')
  const removed = removeOldPhotos(keepFiles)
  console.log(`     deleted ${removed.length} old file(s)`)

  console.log('6/6  Building POS thumbnails…')
  buildThumbs()

  const [[count]] = await db.query('SELECT COUNT(*) AS c FROM menu_items')
  console.log(`\nDone. ${count.c} menu items. Dried fish and signature mocktails were skipped.`)

  const [byCat] = await db.query(
    `SELECT category, COUNT(*) AS c FROM menu_items
     GROUP BY category
     ORDER BY ${menuCategoryFieldSql()}`,
  )
  byCat.forEach((row) => console.log(`  ${row.category}: ${row.c}`))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Menu seed failed:', error.message)
    process.exit(1)
  })
