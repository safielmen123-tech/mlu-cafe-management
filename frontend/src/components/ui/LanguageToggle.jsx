import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function LanguageToggle({ className = '' }) {
  const { t, i18n } = useTranslation()
  const isKhmer = i18n.language === 'km'

  const toggleLanguage = () => {
    i18n.changeLanguage(isKhmer ? 'en' : 'km')
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={isKhmer ? t('a11y.switchToEnglish') : t('a11y.switchToKhmer')}
      className={`interactive-btn flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-wide transition-colors ${
        isKhmer
          ? 'border-cocoa-300 bg-cocoa-700 text-cocoa-50'
          : 'border-forest-200 bg-forest-50 text-forest-800 dark:border-forest-800/60 dark:bg-forest-950/40 dark:text-forest-100'
      } ${className}`}
    >
      <Languages className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="whitespace-nowrap">
        <span className={isKhmer ? 'text-cocoa-200' : 'text-forest-800 dark:text-forest-200'}>EN</span>
        <span className={isKhmer ? 'text-cocoa-400' : 'text-forest-400 dark:text-forest-700'}> / </span>
        <span className={isKhmer ? 'text-white' : 'text-forest-700/80 dark:text-forest-400/90'}>ខ្មែរ</span>
      </span>
    </button>
  )
}
