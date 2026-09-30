export default function StatusBadge({ children, className = '' }) {
  return (
    <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${className}`}>
      {children}
    </span>
  )
}
