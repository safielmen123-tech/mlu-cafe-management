import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { MENU_IMAGE_PLACEHOLDER, resolveMenuImageSrc } from '../../utils/menuItemImage'

const DEFAULT_IMG_CLASS =
  'h-16 w-16 shrink-0 rounded-xl border border-slate-100 object-cover dark:border-zinc-800'

const DEFAULT_FALLBACK_CLASS =
  'flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500'

export default function MenuItemImage({
  imageUrl,
  alt = '',
  className = DEFAULT_IMG_CLASS,
  fallbackClassName = DEFAULT_FALLBACK_CLASS,
  iconClassName = 'h-6 w-6',
}) {
  const [src, setSrc] = useState(() => resolveMenuImageSrc(imageUrl))
  const [useIconFallback, setUseIconFallback] = useState(false)
  const [renderedUrl, setRenderedUrl] = useState(imageUrl)

  // Reset the retry/fallback chain when the caller points at a different photo.
  if (renderedUrl !== imageUrl) {
    setRenderedUrl(imageUrl)
    setSrc(resolveMenuImageSrc(imageUrl))
    setUseIconFallback(false)
  }

  if (useIconFallback) {
    return (
      <span className={fallbackClassName} aria-hidden={alt ? undefined : true}>
        <UtensilsCrossed className={iconClassName} />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (src !== MENU_IMAGE_PLACEHOLDER) {
          setSrc(MENU_IMAGE_PLACEHOLDER)
          return
        }
        setUseIconFallback(true)
      }}
    />
  )
}
