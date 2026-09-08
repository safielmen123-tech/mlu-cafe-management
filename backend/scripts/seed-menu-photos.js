/**
 * Replaces the menu with the photographed Mlu Kitchen & Cafe Siem Reap menu.
 *
 * Safe to re-run. Order of operations matters:
 *   1. Backfill order_items.item_name from menu_items.name. The FK is ON DELETE SET NULL
 *      and reports read COALESCE(m.name, oi.item_name, 'Custom item'), so without this
 *      backfill, replacing menu rows would erase the item detail behind every past order.
 *   2. Widen the category ENUM. The UI already offers Cold Drinks / Food, but the column
 *      only allowed Coffee / Bakery, so those items could never be saved.
 *   3. Rename the photo files to url-safe kebab-case, then replace the menu rows.
 *
 * Usage: npm run seed:menu
 */
const fs = require('fs')
const path = require('path')
const pool = require('../db')

const IMAGE_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'menu-images')
const PUBLIC_PREFIX = '/menu-images'

// originalFile -> cleanFile, display name, category, price
const MENU = [
  ['Hot Americano.jpg', 'hot-americano.jpg', 'Hot Americano', 'Coffee', 2.0],
  ['Hot Cappuchino.jpg', 'hot-cappuccino.jpg', 'Hot Cappuccino', 'Coffee', 2.5],
  ['Hot latte.jpg', 'hot-latte.jpg', 'Hot Latte', 'Coffee', 2.75],
  ['Hot Macha.jpg', 'hot-matcha.jpg', 'Hot Matcha', 'Coffee', 3.25],

  ['Ice Americano.jpg', 'iced-americano.jpg', 'Iced Americano', 'Cold Drinks', 2.25],
  ['Ice Cappuchino.jpg', 'iced-cappuccino.jpg', 'Iced Cappuccino', 'Cold Drinks', 2.75],
  ['Ice latte.jpg', 'iced-latte.jpg', 'Iced Latte', 'Cold Drinks', 3.0],
  ['Matcha Ice Latte.jpg', 'iced-matcha-latte.jpg', 'Iced Matcha Latte', 'Cold Drinks', 3.5],
  ['Ice Lemon tea.jpg', 'iced-lemon-tea.jpg', 'Iced Lemon Tea', 'Cold Drinks', 2.95],
  ['Blueberry Ice Tea.jpg', 'blueberry-iced-tea.jpg', 'Blueberry Iced Tea', 'Cold Drinks', 3.25],
  ['Strawberry Lemon tea.jpg', 'strawberry-lemon-tea.jpg', 'Strawberry Lemon Tea', 'Cold Drinks', 3.35],
  ['Ginger Aloe Tea.jpg', 'ginger-aloe-tea.jpg', 'Ginger Aloe Tea', 'Cold Drinks', 3.15],

  ['Strawberry Cake.jpg', 'strawberry-cake.jpg', 'Strawberry Cake', 'Bakery', 3.95],
  ['Vanila and Strawberry cupcake.jpg', 'vanilla-strawberry-cupcake.jpg', 'Vanilla & Strawberry Cupcake', 'Bakery', 3.25],
  ['Chocolate Fountain.jpg', 'chocolate-fountain.jpg', 'Chocolate Fountain', 'Bakery', 4.75],
  ['Morning Pancake.jpg', 'morning-pancake.jpg', 'Morning Pancake', 'Bakery', 4.25],
  ['Regular Pancake with Honey.jpg', 'pancake-with-honey.jpg', 'Pancake with Honey', 'Bakery', 4.5],

  ['Buddha Bowl.jpg', 'buddha-bowl.jpg', 'Buddha Bowl', 'Food', 7.5],
  ['Healthy Meal.jpg', 'healthy-meal.jpg', 'Healthy Meal', 'Food', 6.75],
  ['Diet Meal.jpg', 'diet-meal.jpg', 'Diet Meal', 'Food', 6.95],
  ['Morning Protien Meal.jpg', 'morning-protein-meal.jpg', 'Morning Protein Meal', 'Food', 6.25],
  ['Veggie Pizza.jpg', 'veggie-pizza.jpg', 'Veggie Pizza', 'Food', 8.25],
  ['Susage Fried Rice.jpg', 'sausage-fried-rice.jpg', 'Sausage Fried Rice', 'Food', 5.95],
  ['Sweet and Sour Chicken.jpg', 'sweet-and-sour-chicken.jpg', 'Sweet & Sour Chicken', 'Food', 7.5],
  ['Korean Chicken Leg.jpg', 'korean-chicken-leg.jpg', 'Korean Chicken Leg', 'Food', 7.25],
  ['Steam Chicken Traditional Style.jpg', 'steamed-chicken-traditional.jpg', 'Steamed Chicken (Traditional)', 'Food', 8.5],
  ['Fish Sour and Spicy Soup.jpg', 'fish-sour-and-spicy-soup.jpg', 'Fish Sour & Spicy Soup', 'Food', 6.5],
  ['Grilled Fish.jpg', 'grilled-fish.jpg', 'Grilled Fish', 'Food', 8.95],
  ['Stir Fried Salmon.jpg', 'stir-fried-salmon.jpg', 'Stir Fried Salmon', 'Food', 9.5],
  ['Salmon with Veggie.jpg', 'salmon-with-veggie.jpg', 'Salmon with Veggie', 'Food', 9.75],
  ['Sasah Clam.jpg', 'sasah-clam.jpg', 'Sasah Clam', 'Food', 7.95],
  ['Grilled Lamp.jpg', 'grilled-lamb.jpg', 'Grilled Lamb', 'Food', 10.5],
  ['Steak with Fried.jpg', 'steak-with-fries.jpg', 'Steak with Fries', 'Food', 11.95],
  ['Meat Grilled Set.jpg', 'meat-grilled-set.jpg', 'Meat Grilled Set', 'Food', 12.5],
]

const CATEGORIES = ['Coffee', 'Bakery', 'Cold Drinks', 'Food']
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function normalizePhotoKey(filename) {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function listPhotoFiles() {
  return fs.readdirSync(IMAGE_DIR).filter((name) => {
    if (name.startsWith('__tmp__')) return false
    if (name.toLowerCase() === 'placeholder.jpg') return false
    return PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase())
  })
}

function findPhotoOnDisk(original, clean, files) {
  const wanted = new Set([
    original.toLowerCase(),
    clean.toLowerCase(),
  ])
  const wantedKeys = new Set([
    normalizePhotoKey(original),
    normalizePhotoKey(clean),
  ])

  const exact = files.find((name) => wanted.has(name.toLowerCase()))
  if (exact) return exact

  return files.find((name) => wantedKeys.has(normalizePhotoKey(name))) || null
}

function renamePhotos() {
  let renamed = 0
  const missing = []
  let files = listPhotoFiles()

  for (const [original, clean] of MENU) {
    const to = path.join(IMAGE_DIR, clean)
    const match = findPhotoOnDisk(original, clean, files)

    if (!match) {
      missing.push(`${original} (expected ${clean})`)
      continue
    }

    if (match.toLowerCase() === clean.toLowerCase()) {
      continue
    }

    const from = path.join(IMAGE_DIR, match)
    // Two-step guards against case-insensitive collisions on Windows.
    const temp = path.join(IMAGE_DIR, `__tmp__${clean}`)
    fs.renameSync(from, temp)
    fs.renameSync(temp, to)
    renamed += 1
    files = files.map((name) => (name === match ? clean : name))
  }

  if (missing.length) {
    throw new Error(`Missing photo file(s): ${missing.join(', ')}`)
  }

  return { renamed, missing }
}

async function main() {
  const db = pool

  console.log('1/4  Backfilling order_items.item_name from menu_items…')
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

  console.log('2/4  Widening menu_items.category…')
  const enumValues = CATEGORIES.map((c) => `'${c}'`).join(',')
  await db.query(`ALTER TABLE menu_items MODIFY category ENUM(${enumValues}) NOT NULL`)
  console.log(`     categories: ${CATEGORIES.join(', ')}`)

  console.log('3/4  Matching photos to url-safe file names…')
  const { renamed } = renamePhotos()
  console.log(`     renamed ${renamed} file(s); ${MENU.length} photo(s) ready`)

  console.log('4/4  Replacing menu items…')
  await db.query('DELETE FROM menu_items')
  await db.query('ALTER TABLE menu_items AUTO_INCREMENT = 1')

  for (const [, clean, name, category, price] of MENU) {
    const photoPath = path.join(IMAGE_DIR, clean)
    if (!fs.existsSync(photoPath)) {
      throw new Error(`Photo still missing after rename: ${clean}`)
    }
    await db.query(
      'INSERT INTO menu_items (name, category, price, image_url, is_available) VALUES (?, ?, ?, ?, 1)',
      [name, category, price, `${PUBLIC_PREFIX}/${clean}`],
    )
  }

  const [[count]] = await db.query('SELECT COUNT(*) AS c FROM menu_items')
  const [[withImg]] = await db.query('SELECT COUNT(*) AS c FROM menu_items WHERE image_url IS NOT NULL')
  console.log(`\nDone. ${count.c} menu items, ${withImg.c} with photos.`)

  const [byCat] = await db.query('SELECT category, COUNT(*) AS c FROM menu_items GROUP BY category ORDER BY category')
  byCat.forEach((r) => console.log(`  ${r.category}: ${r.c}`))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Menu seed failed:', error.message)
    process.exit(1)
  })
