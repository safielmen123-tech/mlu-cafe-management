import { STORE } from '../../config/store'

export default function BrandLogo({ className = '', alt, src, glow = false, ...props }) {
  const imgProps = {
    src: src ?? STORE.logoUrl,
    alt: alt ?? STORE.officialName,
    draggable: false,
    decoding: 'async',
    ...props,
  }

  if (!glow) {
    return <img className={`object-contain ${className}`.trim()} {...imgProps} />
  }

  // Layout/size classes on the wrapper so .brand-logo-glow::before scales to the logo box.
  return (
    <span className={`brand-logo-glow ${className}`.trim()}>
      <img className="brand-logo-glow__img" {...imgProps} />
    </span>
  )
}
