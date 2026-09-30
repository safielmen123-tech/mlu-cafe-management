/**
 * Idempotent recipe loader for desserts, vegetables, soups, mains, starters, cold drinks, and teas.
 * Does not touch the sales seed. Gram amounts are estimates per one menu
 * item. Kg stock uses quantity_per_unit = grams / 1000. Counted units
 * use units per serving directly.
 *
 * A near-duplicate stock name stops the run before any new row is created.
 *
 * Run: npm run seed:desserts
 */
const db = require('../../db')
const { ensureStockSchema } = require('../utils/stockSchema')
const { matchInventoryName, nearInventoryNames, closestNames, saveNewInventoryItem } = require('../utils/inventoryItems')
const { withTransaction } = require('../utils/stockLedger')

const INGREDIENTS = [
  { id: 'banana', name: 'Sugar Bananas (Namwa)', category: 'Produce', onHand: 5, max: 10 },
  { id: 'sago', name: 'Small Tapioca Pearls (Sago)', category: 'Pantry', onHand: 2, max: 5 },
  { id: 'palm-sugar', name: 'Palm Sugar', category: 'Pantry', onHand: 3, max: 5 },
  { id: 'coconut-milk', name: 'Full-Fat Coconut Milk', category: 'Liquids', onHand: 5, max: 10 },
  { id: 'white-sugar', name: 'White Sugar (kitchen)', category: 'Pantry', onHand: 3, max: 5 },
  { id: 'corn', name: 'Sweet Corn Kernels', category: 'Produce', onHand: 5, max: 10 },
  { id: 'dried-beans', name: 'Dried Beans (mixed)', category: 'Pantry', onHand: 3, max: 5 },
  { id: 'mixed-fruit', name: 'Mixed Fresh Fruit (prepped)', category: 'Produce', onHand: 5, max: 10 },
  { id: 'morning-glory', name: 'Fresh Morning Glory (Trakuon)', category: 'Produce', onHand: 4, max: 8 },
  { id: 'bok-choy', name: 'Fresh Bok Choy', category: 'Produce', onHand: 4, max: 8 },
  { id: 'garlic', name: 'Fresh Garlic', category: 'Produce', onHand: 1, max: 2 },
  { id: 'red-chili', name: 'Fresh Red Chili', category: 'Produce', onHand: 0.5, max: 1 },
  { id: 'salad-greens', name: 'Salad Greens (Coral Lettuce/Mixed)', category: 'Produce', onHand: 2, max: 4 },
  { id: 'cabbage', name: 'Cabbage (Red/White)', category: 'Produce', onHand: 3, max: 6 },
  { id: 'carrots', name: 'Fresh Carrots', category: 'Produce', onHand: 3, max: 6 },
  { id: 'cucumber', name: 'Fresh Cucumber', category: 'Produce', onHand: 3, max: 6 },
  { id: 'oyster-sauce', name: 'Oyster Sauce', category: 'Sauces', onHand: 2, max: 4 },
  { id: 'soy-sauce', name: 'Light Soy Sauce', category: 'Sauces', onHand: 2, max: 4 },
  { id: 'yellow-bean-paste', name: 'Fermented Yellow Bean Paste', category: 'Sauces', onHand: 1, max: 2 },
  { id: 'cooking-oil', name: 'Cooking Oil', category: 'Oils', onHand: 8, max: 15 },
  { id: 'salad-dressing', name: 'House Salad Dressing', category: 'Sauces', onHand: 1, max: 2 },
  { id: 'fish-chicken', name: 'Fish or Chicken (soup protein)', category: 'Meat', onHand: 4, max: 8 },
  { id: 'beef', name: 'Beef (Fresh)', existing: true },
  { id: 'pork-ribs', name: 'Pork Spare Ribs', category: 'Meat', onHand: 5, max: 10 },
  { id: 'winter-melon', name: 'Fresh Winter Melon', category: 'Produce', onHand: 4, max: 8 },
  { id: 'pineapple', name: 'Fresh Pineapple', category: 'Produce', onHand: 3, max: 6 },
  { id: 'tomato', name: 'Fresh Tomato', category: 'Produce', onHand: 3, max: 6 },
  { id: 'tamarind', name: 'Tamarind Paste', category: 'Sauces', onHand: 2, max: 4 },
  { id: 'fish-sauce', name: 'Fish Sauce', category: 'Sauces', onHand: 3, max: 6 },
  { id: 'prahok', name: 'Prahok (Fermented Fish Paste)', category: 'Sauces', onHand: 1, max: 2 },
  { id: 'kroeung', name: 'Khmer Kroeung Paste (house-made)', category: 'Sauces', onHand: 1, max: 2 },
  { id: 'stock-powder', name: 'Soup Stock Powder', category: 'Pantry', onHand: 1, max: 2 },
  { id: 'chicken-breast', name: 'Chicken Breast', existing: true },
  { id: 'light-soy', name: 'Light Soy Sauce', existing: true },
  { id: 'local-fish', name: 'Local River Fish (whole)', category: 'Meat', onHand: 5, max: 10 },
  { id: 'snapper', name: 'Red Snapper / Seabass (whole)', category: 'Meat', onHand: 5, max: 10 },
  { id: 'fish-fillet', name: 'Boneless Fish Fillet', category: 'Meat', onHand: 4, max: 8 },
  { id: 'shallots', name: 'Fresh Shallots', category: 'Produce', onHand: 1, max: 2 },
  { id: 'long-beans', name: 'Fresh Long Beans', category: 'Produce', onHand: 2, max: 4 },
  { id: 'yellow-onion', name: 'Fresh Yellow Onion', category: 'Produce', onHand: 3, max: 6 },
  { id: 'bell-pepper', name: 'Fresh Bell Pepper', category: 'Produce', onHand: 2, max: 4 },
  { id: 'ginger', name: 'Fresh Ginger', category: 'Produce', onHand: 2, max: 4 },
  { id: 'spring-onion', name: 'Fresh Spring Onion', category: 'Produce', onHand: 1.5, max: 3 },
  { id: 'holy-basil', name: 'Fresh Holy Basil', category: 'Produce', onHand: 0.5, max: 1 },
  { id: 'bean-sprouts', name: 'Fresh Bean Sprouts', category: 'Produce', onHand: 2, max: 4 },
  { id: 'dark-soy', name: 'Dark Sweet Soy Sauce', category: 'Sauces', onHand: 2, max: 4 },
  { id: 'ketchup', name: 'Tomato Ketchup', category: 'Sauces', onHand: 3, max: 6 },
  { id: 'vinegar', name: 'White Vinegar', category: 'Sauces', onHand: 2, max: 4 },
  { id: 'cornstarch', name: 'Cornstarch', category: 'Pantry', onHand: 3, max: 5 },
  { id: 'noodles', name: 'Fresh Yellow Egg Noodles', category: 'Pantry', onHand: 5, max: 10 },
  { id: 'rice', name: 'Jasmine Rice (raw)', category: 'Pantry', onHand: 20, max: 50 },
  { id: 'eggs', name: 'Chicken Eggs', category: 'Produce', onHand: 60, max: 120, section: 'countable', unit: 'eggs' },
  { id: 'fish-paste', name: 'Fish Paste (Featherback)', category: 'Meat', onHand: 4, max: 8 },
  { id: 'minced-meat', name: 'Minced Meat (Pork/Chicken)', category: 'Meat', onHand: 4, max: 8 },
  { id: 'taro-jicama', name: 'Taro or Jicama', category: 'Produce', onHand: 3, max: 6 },
  { id: 'glass-noodles', name: 'Glass Noodles (dried)', category: 'Pantry', onHand: 2, max: 4 },
  { id: 'wood-ear', name: 'Wood Ear Mushrooms (dried)', category: 'Pantry', onHand: 1, max: 2 },
  { id: 'spring-wrappers', name: 'Spring Roll Wrappers', category: 'Pantry', onHand: 3, max: 6 },
  { id: 'sweet-chili', name: 'Sweet Chili Dipping Sauce', category: 'Sauces', onHand: 3, max: 6 },
  { id: 'satay-spice', name: 'Satay Spice Rub / Curry Powder', category: 'Pantry', onHand: 1, max: 2 },
  { id: 'peanut-paste', name: 'Roasted Peanut Paste', category: 'Pantry', onHand: 2, max: 4 },
  { id: 'limes', name: 'Fresh Limes', category: 'Produce', onHand: 3, max: 6 },
  { id: 'watermelon', name: 'Fresh Watermelon', category: 'Produce', onHand: 6, max: 12 },
  { id: 'mango', name: 'Fresh Mango', category: 'Produce', onHand: 5, max: 10 },
  { id: 'syrup', name: 'Simple Sugar Syrup (house-made)', category: 'Sauces', onHand: 3, max: 6, ignoreNear: ['Sugar'] },
  { id: 'coconut', name: 'Young Coconut', category: 'Produce', onHand: 20, max: 40, section: 'countable', unit: 'coconuts' },
  { id: 'ginger-ale', name: 'Ginger Ale (can)', category: 'Drinks', onHand: 24, max: 48, section: 'countable', unit: 'cans' },
  { id: 'tonic', name: 'Tonic Water (can)', category: 'Drinks', onHand: 24, max: 48, section: 'countable', unit: 'cans' },
  { id: 'cambodia-water', name: 'Cambodia Water 500ml', category: 'Drinks', onHand: 24, max: 48, section: 'countable', unit: 'bottles', ignoreNear: ['Cambodia'] },
  { id: 'kulen-water', name: 'Kulen Water (1.5L)', category: 'Drinks', onHand: 12, max: 24, section: 'countable', unit: 'bottles' },
  { id: 'whole-milk', name: 'Whole Milk', existing: true },
  { id: 'red-tea', name: 'Thai Red Tea Leaves', category: 'Bar Supplies', onHand: 2, max: 4 },
  { id: 'green-tea', name: 'Green Tea Leaves', category: 'Bar Supplies', onHand: 2, max: 4 },
  { id: 'black-tea', name: 'Black Tea Leaves', category: 'Bar Supplies', onHand: 2, max: 4 },
  { id: 'butterfly-pea', name: 'Dried Butterfly Pea Flowers', category: 'Bar Supplies', onHand: 0.5, max: 1 },
  { id: 'boba', name: 'Tapioca Pearls (Boba, dry)', category: 'Bar Supplies', onHand: 3, max: 6, ignoreNear: ['Small Tapioca Pearls (Sago)'] },
  { id: 'condensed-milk', name: 'Condensed Milk', category: 'Dairy', onHand: 4, max: 8 },
  { id: 'evaporated-milk', name: 'Evaporated Milk', category: 'Dairy', onHand: 4, max: 8 },
  { id: 'honey', name: 'Pure Honey', category: 'Bar Supplies', onHand: 2, max: 4 },
  { id: 'lemons', name: 'Fresh Lemons', category: 'Produce', onHand: 3, max: 6 },
  { id: 'tea-bags', name: 'Tea Bags (assorted)', category: 'Bar Supplies', onHand: 100, max: 200, section: 'countable', unit: 'tea bags' },
]

const MENU_NAMES = {
  'Banana Sago in Coconut Milk': 'Banana Sago in Coconut Milk',
  'Mixed Seasonal Fruit Platter': 'Mixed Seasonal Fruit Platter',
  'Sweet Corn in Coconut Milk': 'Sweet Corn with Coconut Milk',
  'Sweet Bean Soup in Coconut Milk': 'Bean in Coconut Milk',
  'Wok Fried Morning Glory': 'Wok Fried Morning Glory',
  'Mixed Vegetables': 'Mixed Vegetables',
  'Pok Choy with Oyster Sauce': 'Pok Choy with Oyster Sauce',
  'Fish or Chicken Sour Soup (Samlor Machu)': 'Fish or Chicken Sour Soup (Samlor Machu)',
  'Beef Sour Soup with Morning Glory (Samlor Machu Trei/Sach Ko)': 'Beef Sour Soup with Morning Glory (Samlor Machu Trei/Sach Ko)',
  'Wintermelon Soup with Pork Ribs': 'Wintermelon Soup with Pork Ribs',
  'Fried Local Fish with Tamarind': 'Fried Local Fish with Tamarind',
  'Hot Basil Chicken': 'Hot Basil Chicken',
  'Beef Lok Lak': 'Beef Lok Lak',
  'Chicken Ginger or Pork': 'Chicken Ginger or Pork',
  'Chicken Wings or Breast': 'Chicken Wings or Breast',
  'Steamed Fish': 'Steamed Fish',
  'Red Snapper with Sour Sauce': 'Red Snapper with Sour Sauce',
  'Fried Yellow Noodles': 'Fried Yellow Noodles',
  'Garlic and Egg Fried Rice': 'Garlic and Egg Fried Rice',
  'Sweet and Sour Boneless Fish': 'Sweet and Sour Boneless Fish',
  'Cambodian Fish Cake': 'Cambodian Fish Cake',
  'Deep Fried Spring Rolls': 'Deep Fried Spring Rolls',
  'Chicken Satay': 'Chicken Satay',
  'Beef Satay': 'Beef Satay',
  'Fresh Lime': 'Fresh Lime',
  'Fresh Pineapple': 'Fresh Pineapple',
  'Fresh Watermelon': 'Fresh Watermelon',
  'Fresh Mango': 'Fresh Mango',
  'Fresh Coconut': 'Fresh Coconut',
  'Ginger Ale': 'Ginger Ale',
  'Tonic Water': 'Tonic Water',
  'Cambodia Water (S)': 'Cambodia Water (S)',
  'Kulen Water (1.5L)': 'Kulen Water (1.5L)',
  'Red Milk Tea': 'Red Milk Tea',
  'Green Milk Tea': 'Green Milk Tea',
  'Butterfly Milk Tea': 'Butterfly Milk Tea',
  'Green Lemon Tea': 'Green Lemon Tea',
  'Tea W/ Honey & Lemon': 'Tea W/ Honey & Lemon',
  'Lemon Tea W/ Syrup': 'Lemon Tea W/ Syrup',
  'Tea Selection': 'Tea Selection',
}

const RECIPES = [
  {
    recipe: 'Banana Sago in Coconut Milk',
    lines: [
      { ingredient: 'banana', grams: 86 },
      { ingredient: 'sago', grams: 9 },
      { ingredient: 'palm-sugar', grams: 13 },
      { ingredient: 'coconut-milk', grams: 71 },
    ],
  },
  {
    recipe: 'Mixed Seasonal Fruit Platter',
    lines: [{ ingredient: 'mixed-fruit', grams: 1370 }],
  },
  {
    recipe: 'Sweet Corn in Coconut Milk',
    lines: [
      { ingredient: 'corn', grams: 129 },
      { ingredient: 'coconut-milk', grams: 107 },
      { ingredient: 'white-sugar', grams: 14 },
      { ingredient: 'sago', grams: 6 },
    ],
  },
  {
    recipe: 'Sweet Bean Soup in Coconut Milk',
    lines: [
      { ingredient: 'dried-beans', grams: 57 },
      { ingredient: 'coconut-milk', grams: 71 },
      { ingredient: 'palm-sugar', grams: 21 },
      { ingredient: 'sago', grams: 9 },
    ],
  },
  {
    recipe: 'Wok Fried Morning Glory',
    lines: [
      { ingredient: 'morning-glory', grams: 280 },
      { ingredient: 'garlic', grams: 15 },
      { ingredient: 'red-chili', grams: 5 },
      { ingredient: 'oyster-sauce', grams: 20 },
      { ingredient: 'soy-sauce', grams: 10 },
      { ingredient: 'yellow-bean-paste', grams: 8 },
      { ingredient: 'cooking-oil', grams: 20 },
    ],
  },
  {
    recipe: 'Mixed Vegetables',
    lines: [
      { ingredient: 'salad-greens', grams: 80 },
      { ingredient: 'cabbage', grams: 90 },
      { ingredient: 'carrots', grams: 60 },
      { ingredient: 'cucumber', grams: 60 },
      { ingredient: 'salad-dressing', grams: 30 },
    ],
  },
  {
    recipe: 'Pok Choy with Oyster Sauce',
    lines: [
      { ingredient: 'bok-choy', grams: 260 },
      { ingredient: 'oyster-sauce', grams: 30 },
      { ingredient: 'garlic', grams: 12 },
      { ingredient: 'cooking-oil', grams: 15 },
    ],
  },
  {
    recipe: 'Fish or Chicken Sour Soup (Samlor Machu)',
    lines: [
      { ingredient: 'fish-chicken', grams: 200 },
      { ingredient: 'tamarind', grams: 25 },
      { ingredient: 'pineapple', grams: 60 },
      { ingredient: 'tomato', grams: 50 },
      { ingredient: 'garlic', grams: 10 },
      { ingredient: 'fish-sauce', grams: 20 },
      { ingredient: 'white-sugar', grams: 10 },
      { ingredient: 'stock-powder', grams: 5 },
    ],
  },
  {
    recipe: 'Beef Sour Soup with Morning Glory (Samlor Machu Trei/Sach Ko)',
    lines: [
      { ingredient: 'beef', grams: 180 },
      { ingredient: 'morning-glory', grams: 120 },
      { ingredient: 'kroeung', grams: 25 },
      { ingredient: 'tamarind', grams: 20 },
      { ingredient: 'prahok', grams: 10 },
      { ingredient: 'garlic', grams: 10 },
      { ingredient: 'white-sugar', grams: 8 },
      { ingredient: 'stock-powder', grams: 5 },
    ],
  },
  {
    recipe: 'Wintermelon Soup with Pork Ribs',
    lines: [
      { ingredient: 'pork-ribs', grams: 220 },
      { ingredient: 'winter-melon', grams: 180 },
      { ingredient: 'garlic', grams: 10 },
      { ingredient: 'fish-sauce', grams: 15 },
      { ingredient: 'stock-powder', grams: 6 },
    ],
  },
  {
    recipe: 'Fried Local Fish with Tamarind',
    lines: [
      { ingredient: 'local-fish', grams: 350 },
      { ingredient: 'tamarind', grams: 30 },
      { ingredient: 'palm-sugar', grams: 20 },
      { ingredient: 'fish-sauce', grams: 15 },
      { ingredient: 'garlic', grams: 12 },
      { ingredient: 'shallots', grams: 15 },
      { ingredient: 'red-chili', grams: 5 },
      { ingredient: 'cooking-oil', grams: 35 },
    ],
  },
  {
    recipe: 'Hot Basil Chicken',
    lines: [
      { ingredient: 'chicken-breast', grams: 180 },
      { ingredient: 'holy-basil', grams: 15 },
      { ingredient: 'garlic', grams: 15 },
      { ingredient: 'red-chili', grams: 8 },
      { ingredient: 'long-beans', grams: 40 },
      { ingredient: 'oyster-sauce', grams: 20 },
      { ingredient: 'dark-soy', grams: 8 },
      { ingredient: 'fish-sauce', grams: 12 },
      { ingredient: 'white-sugar', grams: 4 },
      { ingredient: 'cooking-oil', grams: 20 },
    ],
  },
  {
    recipe: 'Beef Lok Lak',
    lines: [
      { ingredient: 'beef', grams: 200 },
      { ingredient: 'tomato', grams: 80 },
      { ingredient: 'cucumber', grams: 60 },
      { ingredient: 'yellow-onion', grams: 50 },
      { ingredient: 'salad-greens', grams: 40 },
      { ingredient: 'oyster-sauce', grams: 20 },
      { ingredient: 'ketchup', grams: 15 },
      { ingredient: 'light-soy', grams: 10 },
      { ingredient: 'garlic', grams: 10 },
      { ingredient: 'cooking-oil', grams: 20 },
    ],
  },
  {
    recipe: 'Chicken Ginger or Pork',
    lines: [
      { ingredient: 'chicken-breast', grams: 180 },
      { ingredient: 'ginger', grams: 60 },
      { ingredient: 'garlic', grams: 12 },
      { ingredient: 'spring-onion', grams: 25 },
      { ingredient: 'yellow-bean-paste', grams: 15 },
      { ingredient: 'oyster-sauce', grams: 15 },
      { ingredient: 'white-sugar', grams: 6 },
      { ingredient: 'cooking-oil', grams: 20 },
    ],
  },
  {
    recipe: 'Chicken Wings or Breast',
    lines: [
      { ingredient: 'chicken-breast', grams: 250 },
      { ingredient: 'fish-sauce', grams: 15 },
      { ingredient: 'garlic', grams: 10 },
      { ingredient: 'cornstarch', grams: 25 },
      { ingredient: 'cooking-oil', grams: 25 },
    ],
  },
  {
    recipe: 'Steamed Fish',
    lines: [
      { ingredient: 'snapper', grams: 350 },
      { ingredient: 'ginger', grams: 30 },
      { ingredient: 'spring-onion', grams: 20 },
      { ingredient: 'light-soy', grams: 25 },
      { ingredient: 'red-chili', grams: 5 },
      { ingredient: 'white-sugar', grams: 5 },
    ],
  },
  {
    recipe: 'Red Snapper with Sour Sauce',
    lines: [
      { ingredient: 'snapper', grams: 400 },
      { ingredient: 'pineapple', grams: 50 },
      { ingredient: 'tomato', grams: 50 },
      { ingredient: 'tamarind', grams: 25 },
      { ingredient: 'palm-sugar', grams: 20 },
      { ingredient: 'fish-sauce', grams: 15 },
      { ingredient: 'cornstarch', grams: 8 },
      { ingredient: 'cooking-oil', grams: 35 },
    ],
  },
  {
    recipe: 'Fried Yellow Noodles',
    lines: [
      { ingredient: 'noodles', grams: 180 },
      { ingredient: 'beef', grams: 80 },
      { ingredient: 'bok-choy', grams: 60 },
      { ingredient: 'carrots', grams: 25 },
      { ingredient: 'bean-sprouts', grams: 40 },
      { ingredient: 'dark-soy', grams: 12 },
      { ingredient: 'oyster-sauce', grams: 15 },
      { ingredient: 'garlic', grams: 8 },
      { ingredient: 'cooking-oil', grams: 20 },
    ],
  },
  {
    recipe: 'Garlic and Egg Fried Rice',
    lines: [
      { ingredient: 'rice', grams: 100 },
      { ingredient: 'eggs', units: 2 },
      { ingredient: 'garlic', grams: 20 },
      { ingredient: 'spring-onion', grams: 15 },
      { ingredient: 'light-soy', grams: 12 },
      { ingredient: 'stock-powder', grams: 5 },
      { ingredient: 'cooking-oil', grams: 25 },
    ],
  },
  {
    recipe: 'Sweet and Sour Boneless Fish',
    lines: [
      { ingredient: 'fish-fillet', grams: 220 },
      { ingredient: 'bell-pepper', grams: 50 },
      { ingredient: 'pineapple', grams: 50 },
      { ingredient: 'yellow-onion', grams: 40 },
      { ingredient: 'cucumber', grams: 40 },
      { ingredient: 'ketchup', grams: 25 },
      { ingredient: 'vinegar', grams: 15 },
      { ingredient: 'white-sugar', grams: 18 },
      { ingredient: 'cornstarch', grams: 30 },
      { ingredient: 'cooking-oil', grams: 25 },
    ],
  },
  {
    recipe: 'Cambodian Fish Cake',
    lines: [
      { ingredient: 'fish-paste', grams: 180 },
      { ingredient: 'kroeung', grams: 25 },
      { ingredient: 'long-beans', grams: 20 },
      { ingredient: 'fish-sauce', grams: 10 },
      { ingredient: 'palm-sugar', grams: 8 },
      { ingredient: 'sweet-chili', grams: 30 },
      { ingredient: 'cooking-oil', grams: 20 },
    ],
  },
  {
    recipe: 'Deep Fried Spring Rolls',
    lines: [
      { ingredient: 'spring-wrappers', grams: 40 },
      { ingredient: 'minced-meat', grams: 80 },
      { ingredient: 'taro-jicama', grams: 35 },
      { ingredient: 'carrots', grams: 20 },
      { ingredient: 'glass-noodles', grams: 15 },
      { ingredient: 'wood-ear', grams: 5 },
      { ingredient: 'oyster-sauce', grams: 10 },
      { ingredient: 'sweet-chili', grams: 30 },
      { ingredient: 'cooking-oil', grams: 22 },
    ],
  },
  {
    recipe: 'Chicken Satay',
    lines: [
      { ingredient: 'chicken-breast', grams: 160 },
      { ingredient: 'coconut-milk', grams: 25 },
      { ingredient: 'satay-spice', grams: 10 },
      { ingredient: 'peanut-paste', grams: 25 },
      { ingredient: 'palm-sugar', grams: 10 },
      { ingredient: 'tamarind', grams: 10 },
      { ingredient: 'cooking-oil', grams: 10 },
    ],
  },
  {
    recipe: 'Beef Satay',
    lines: [
      { ingredient: 'beef', grams: 160 },
      { ingredient: 'kroeung', grams: 20 },
      { ingredient: 'light-soy', grams: 12 },
      { ingredient: 'peanut-paste', grams: 25 },
      { ingredient: 'coconut-milk', grams: 20 },
      { ingredient: 'palm-sugar', grams: 10 },
      { ingredient: 'cooking-oil', grams: 10 },
    ],
  },
  {
    recipe: 'Fresh Lime',
    lines: [
      { ingredient: 'limes', grams: 80 },
      { ingredient: 'syrup', grams: 30 },
    ],
  },
  {
    recipe: 'Fresh Pineapple',
    lines: [
      { ingredient: 'pineapple', grams: 250 },
      { ingredient: 'syrup', grams: 15 },
    ],
  },
  {
    recipe: 'Fresh Watermelon',
    lines: [
      { ingredient: 'watermelon', grams: 300 },
      { ingredient: 'syrup', grams: 10 },
    ],
  },
  {
    recipe: 'Fresh Mango',
    lines: [
      { ingredient: 'mango', grams: 250 },
      { ingredient: 'syrup', grams: 20 },
    ],
  },
  {
    recipe: 'Fresh Coconut',
    lines: [{ ingredient: 'coconut', units: 1 }],
  },
  {
    recipe: 'Ginger Ale',
    lines: [{ ingredient: 'ginger-ale', units: 1 }],
  },
  {
    recipe: 'Tonic Water',
    lines: [{ ingredient: 'tonic', units: 1 }],
  },
  {
    recipe: 'Cambodia Water (S)',
    lines: [{ ingredient: 'cambodia-water', units: 1 }],
  },
  {
    recipe: 'Kulen Water (1.5L)',
    lines: [{ ingredient: 'kulen-water', units: 1 }],
  },
  {
    recipe: 'Red Milk Tea',
    lines: [
      { ingredient: 'red-tea', grams: 15 },
      { ingredient: 'condensed-milk', grams: 30 },
      { ingredient: 'evaporated-milk', grams: 30 },
      { ingredient: 'syrup', grams: 15 },
    ],
  },
  {
    recipe: 'Green Milk Tea',
    lines: [
      { ingredient: 'green-tea', grams: 12 },
      { ingredient: 'condensed-milk', grams: 30 },
      { ingredient: 'evaporated-milk', grams: 40 },
      { ingredient: 'syrup', grams: 15 },
    ],
  },
  {
    recipe: 'Butterfly Milk Tea',
    lines: [
      { ingredient: 'butterfly-pea', grams: 5 },
      { ingredient: 'whole-milk', units: 0.1 },
      { ingredient: 'boba', grams: 30 },
      { ingredient: 'condensed-milk', grams: 25 },
    ],
  },
  {
    recipe: 'Green Lemon Tea',
    lines: [
      { ingredient: 'green-tea', grams: 10 },
      { ingredient: 'lemons', grams: 80 },
      { ingredient: 'syrup', grams: 30 },
    ],
  },
  {
    recipe: 'Tea W/ Honey & Lemon',
    lines: [
      { ingredient: 'black-tea', grams: 10 },
      { ingredient: 'honey', grams: 25 },
      { ingredient: 'lemons', grams: 60 },
    ],
  },
  {
    recipe: 'Lemon Tea W/ Syrup',
    lines: [
      { ingredient: 'black-tea', grams: 10 },
      { ingredient: 'lemons', grams: 80 },
      { ingredient: 'syrup', grams: 35 },
    ],
  },
  {
    recipe: 'Tea Selection',
    lines: [{ ingredient: 'tea-bags', units: 1 }],
  },
]

function thresholds(max) {
  return {
    low: Math.round(max * 0.2 * 1000) / 1000,
    critical: Math.round(max * 0.1 * 1000) / 1000,
  }
}

function relevantNear(names, ingredient) {
  const ignored = new Set((ingredient.ignoreNear || []).map((name) => String(name).trim().toLowerCase()))
  return nearInventoryNames(names, ingredient.name)
    .filter((row) => !ignored.has(String(row.item_name).trim().toLowerCase()))
}

function kgPerServing(grams) {
  return (grams / 1000).toFixed(3)
}

async function sugarSnapshot() {
  const [rows] = await db.execute(
    `SELECT id, item_name, category, section, unit_label, stock_quantity, max_stock
     FROM inventory WHERE item_name = 'Sugar'`,
  )
  return rows
}

async function ensureIngredient(ingredient, names) {
  const match = matchInventoryName(names, ingredient.name)
  if (match.exact.length > 1) {
    return { name: ingredient.name, action: 'skipped', reason: 'more than one stock row with this name' }
  }
  if (match.exact.length === 1) {
    return {
      name: ingredient.name,
      action: 'found',
      id: match.exact[0].id,
      stock_quantity: match.exact[0].stock_quantity,
      max_stock: match.exact[0].max_stock,
      reused: true,
    }
  }
  if (ingredient.existing) {
    const error = new Error(`Required stock row was not found: "${ingredient.name}"`)
    error.missingRequired = true
    throw error
  }
  const near = relevantNear(names, ingredient)
  if (near.length) {
    const error = new Error(`Near-duplicate stock name for "${ingredient.name}"`)
    error.near = near
    throw error
  }

  const { low, critical } = thresholds(ingredient.max)
  const created = await withTransaction(db, (conn) => saveNewInventoryItem(conn, {
    item_name: ingredient.name,
    category: ingredient.category,
    section: ingredient.section || 'uncountable',
    unit_label: ingredient.unit || 'kg',
    stock_quantity: ingredient.onHand,
    max_stock: ingredient.max,
    low_threshold: low,
    critical_threshold: critical,
  }, null, { allowSimilar: true }))
  names.push(created)
  return { name: ingredient.name, action: 'created', id: created.id }
}

async function ensureLink(menuItemId, inventoryId, quantity) {
  const [existing] = await db.execute(
    `SELECT id, quantity_per_unit FROM menu_item_stock_links
     WHERE menu_item_id = ? AND variant = '' AND option_key = ''
       AND option_value = '' AND inventory_id = ?`,
    [menuItemId, inventoryId],
  )
  if (existing.length) {
    return { action: 'existed', id: existing[0].id, quantity_per_unit: existing[0].quantity_per_unit }
  }
  const [result] = await db.execute(
    `INSERT INTO menu_item_stock_links
      (menu_item_id, variant, option_key, option_value, inventory_id, quantity_per_unit)
     VALUES (?, '', '', '', ?, ?)`,
    [menuItemId, inventoryId, quantity],
  )
  return { action: 'created', id: result.insertId, quantity_per_unit: quantity }
}

async function main() {
  const sugarBefore = await sugarSnapshot()
  await ensureStockSchema(db)

  const [names] = await db.execute(
    'SELECT id, item_name, stock_quantity, max_stock FROM inventory',
  )
  const blocked = []
  const missingRequired = []
  for (const ingredient of INGREDIENTS) {
    const match = matchInventoryName(names, ingredient.name)
    if (match.exact.length) continue
    if (ingredient.existing) {
      missingRequired.push({
        name: ingredient.name,
        closest: closestNames(names, ingredient.name).map((row) => row.name),
      })
      continue
    }
    const near = relevantNear(names, ingredient)
    if (near.length) blocked.push({ name: ingredient.name, near })
  }
  if (missingRequired.length) {
    console.log(JSON.stringify({
      stopped: true,
      reason: 'A required existing stock row was not found by its exact name. No rows were created.',
      missingRequired,
    }, null, 2))
    await db.end()
    process.exit(1)
  }
  if (blocked.length) {
    console.log(JSON.stringify({
      stopped: true,
      reason: 'A similar stock name already exists. No rows were created. Say which existing row to reuse.',
      blocked,
    }, null, 2))
    await db.end()
    process.exit(1)
  }

  const byKey = new Map()
  const ingredients = []
  for (const ingredient of INGREDIENTS) {
    const row = await ensureIngredient(ingredient, names)
    ingredients.push(row)
    if (row.id) byKey.set(ingredient.id, row.id)
  }

  const recipes = []
  for (const recipe of RECIPES) {
    const menuName = MENU_NAMES[recipe.recipe]
    const [menu] = await db.execute('SELECT id, name FROM menu_items WHERE name = ?', [menuName])
    if (menu.length !== 1) {
      const [allMenus] = await db.execute('SELECT name FROM menu_items')
      recipes.push({
        recipe: recipe.recipe,
        menuName,
        status: 'skipped',
        reason: menu.length === 0 ? 'no exact menu match' : 'more than one menu row',
        closestMenuNames: closestNames(allMenus, menuName).map((row) => row.name),
        links: [],
      })
      continue
    }

    const links = []
    for (const line of recipe.lines) {
      const inventoryId = byKey.get(line.ingredient)
      if (!inventoryId) {
        links.push({ ingredient: line.ingredient, action: 'skipped', reason: 'ingredient row missing' })
        continue
      }
      const quantity = line.units != null ? Number(line.units).toFixed(3) : kgPerServing(line.grams)
      const saved = await ensureLink(menu[0].id, inventoryId, quantity)
      links.push({
        ingredient: line.ingredient,
        grams: line.grams,
        units: line.units,
        ...saved,
      })
    }
    recipes.push({
      recipe: recipe.recipe,
      menuName: menu[0].name,
      menuItemId: menu[0].id,
      status: 'matched',
      links,
    })
  }

  const sugarAfter = await sugarSnapshot()
  const report = {
    ingredients,
    recipes,
    sugarBagsBefore: sugarBefore,
    sugarBagsAfter: sugarAfter,
    sugarBagsUnchanged: JSON.stringify(sugarBefore) === JSON.stringify(sugarAfter),
  }
  console.log(JSON.stringify(report, null, 2))
  await db.end()
}

main().catch(async (error) => {
  console.error(error.message)
  try { await db.end() } catch { /* already closed */ }
  process.exit(1)
})
