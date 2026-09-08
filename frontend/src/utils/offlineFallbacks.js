import { menuItems as seedMenuItems } from '../data/menuItems'
import { inventoryItems as seedInventoryItems } from '../data/inventory'

const MENU_CACHE_KEY = 'mlu_kitchen_cafe_menu_cache_v1'
const INVENTORY_CACHE_KEY = 'mlu_kitchen_cafe_inventory_cache_v1'

function readCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCache(key, value) {
  try {
    if (Array.isArray(value) && value.length > 0) {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function cacheMenuItems(items) {
  writeCache(MENU_CACHE_KEY, items)
}

export function cacheInventoryItems(items) {
  writeCache(INVENTORY_CACHE_KEY, items)
}

export function getMenuFallback() {
  return readCache(MENU_CACHE_KEY) || seedMenuItems
}

export function mapInventorySeedToApiShape(items = seedInventoryItems) {
  return items.map((item) => ({
    id: item.id,
    item_name: item.name,
    category: item.category,
    section: item.section,
    stock_quantity: item.stock,
    max_stock: item.maxStock,
    unit_label: item.unitLabel,
    unit_singular: item.unitSingular,
    critical_threshold: item.criticalThreshold ?? null,
    low_threshold: item.lowThreshold ?? 0,
    is_weight: Boolean(item.isWeight),
    stock_status: null,
    unit_cost: 0,
  }))
}

export function getInventoryFallback() {
  return readCache(INVENTORY_CACHE_KEY) || mapInventorySeedToApiShape()
}
