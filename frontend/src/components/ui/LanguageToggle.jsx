import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function LanguageToggle({ className = '' }) {
  const { i18n } = useTranslation()
  const isKhmer = i18n.language === 'km'

  const toggleLanguage = () => {
    i18n.changeLanguage(isKhmer ? 'en' : 'km')
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={isKhmer ? 'Switch to English' : 'Switch to Khmer'}
      className={`interactive-btn flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-wide transition-all duration-300 ${
        isKhmer
          ? 'border-zinc-600 bg-zinc-800 text-zinc-100 shadow-inner shadow-black/20'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100'
      } ${className}`}
    >
      <Languages className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className={isKhmer ? 'text-zinc-400' : 'text-emerald-800 dark:text-emerald-200'}>EN</span>
      <span className={isKhmer ? 'text-zinc-500' : 'text-emerald-400 dark:text-emerald-700'}>/</span>
      <span className={isKhmer ? 'text-zinc-100' : 'text-emerald-700/70 dark:text-emerald-400/80'}>ខ្មែរ</span>
    </button>
  )
}
