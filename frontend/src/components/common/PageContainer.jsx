export default function PageContainer({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full min-w-0 max-w-[1400px] ${className}`.trim()}>
      {children}
    </div>
  )
}
