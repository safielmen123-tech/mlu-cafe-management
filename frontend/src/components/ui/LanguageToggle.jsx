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
          ? 'border-olive-700/50 bg-obsidian-800 text-mint-100 shadow-inner shadow-black/20'
          : 'border-olive-200 bg-mint-100 text-forest-800 shadow-sm'
      } ${className}`}
    >
      <Languages className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className={isKhmer ? 'text-mint-300/70' : 'text-forest-600'}>EN</span>
      <span className="text-stone-400 dark:text-stone-500">/</span>
      <span className={isKhmer ? 'text-mint-100' : 'text-stone-500'}>ខ្មែរ</span>
    </button>
  )
}
