export const MENU_IMAGE_PLACEHOLDER = '/menu-images/placeholder.jpg'

export function resolveMenuImageSrc(imageUrl) {
  const trimmed = String(imageUrl ?? '').trim()
  return trimmed || MENU_IMAGE_PLACEHOLDER
}
