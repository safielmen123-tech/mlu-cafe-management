export default function SettingToggle({ enabled, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={() => onChange(!enabled)}
      className={`relative h-7 w-12 shrink-0 cursor-pointer select-none rounded-full transition-colors ${
        enabled ? 'bg-forest-500' : 'bg-olive-200 dark:bg-olive-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
