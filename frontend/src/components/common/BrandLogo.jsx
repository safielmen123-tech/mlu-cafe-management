import { STORE } from '../../config/store'

export default function BrandLogo({ className = '', alt, src, ...props }) {
  return (
    <img
      src={src ?? STORE.logoUrl}
      alt={alt ?? STORE.officialName}
      className={`object-contain ${className}`.trim()}
      draggable={false}
      {...props}
    />
  )
}
