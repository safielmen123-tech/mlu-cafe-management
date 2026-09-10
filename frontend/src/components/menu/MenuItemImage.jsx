import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import {
  MENU_IMAGE_PLACEHOLDER,
  resolveMenuImageFallback,
  resolveMenuImageSrc,
} from '../../utils/menuItemImage'

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
  eager = false,
}) {
  const [src, setSrc] = useState(() => resolveMenuImageSrc(imageUrl))
  const [useIconFallback, setUseIconFallback] = useState(false)
  const [renderedUrl, setRenderedUrl] = useState(imageUrl)
  const [loaded, setLoaded] = useState(false)

  if (renderedUrl !== imageUrl) {
    setRenderedUrl(imageUrl)
    setSrc(resolveMenuImageSrc(imageUrl))
    setUseIconFallback(false)
    setLoaded(false)
  }

  if (useIconFallback) {
    return (
      <span className={fallbackClassName} aria-hidden={alt ? undefined : true}>
        <UtensilsCrossed className={iconClassName} />
      </span>
    )
  }

  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden ${className}`.trim()}>
      {!loaded ? (
        <span className="absolute inset-0 animate-pulse bg-slate-100 dark:bg-zinc-800" aria-hidden="true" />
      ) : null}
      <img
        src={src}
        alt={alt}
        width={128}
        height={128}
        sizes="80px"
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'low'}
        onLoad={() => setLoaded(true)}
        onError={() => {
          const original = resolveMenuImageFallback(imageUrl)
          if (src !== original && original !== MENU_IMAGE_PLACEHOLDER) {
            setSrc(original)
            setLoaded(false)
            return
          }
          if (src !== MENU_IMAGE_PLACEHOLDER) {
            setSrc(MENU_IMAGE_PLACEHOLDER)
            setLoaded(false)
            return
          }
          setUseIconFallback(true)
        }}
      />
    </span>
  )
}
