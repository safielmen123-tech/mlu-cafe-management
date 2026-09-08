export const MENU_IMAGE_PLACEHOLDER = '/menu-images/placeholder.jpg'
export const MENU_IMAGE_THUMB_DIR = '/menu-images/thumbs'

/**
 * POS cards display photos at ~64px. Originals in /menu-images are often 2–5 MB
 * each, so list views always request the matching 256px WebP thumb instead.
 * Remote URLs and already-thumb paths are left alone.
 */
export function resolveMenuImageSrc(imageUrl) {
  const trimmed = String(imageUrl ?? '').trim()
  if (!trimmed) return MENU_IMAGE_PLACEHOLDER

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith(MENU_IMAGE_THUMB_DIR)) return trimmed
  if (trimmed === MENU_IMAGE_PLACEHOLDER) return trimmed

  const menuMatch = trimmed.match(/^\/menu-images\/([^/]+)\.(jpe?g|png|webp)$/i)
  if (menuMatch) {
    return `${MENU_IMAGE_THUMB_DIR}/${menuMatch[1]}.webp`
  }

  return trimmed
}

export function resolveMenuImageFallback(imageUrl) {
  const trimmed = String(imageUrl ?? '').trim()
  return trimmed || MENU_IMAGE_PLACEHOLDER
}
