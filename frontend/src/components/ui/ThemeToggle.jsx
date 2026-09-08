import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`interactive-btn relative flex h-10 min-w-[3.75rem] items-center rounded-full border border-slate-200 bg-slate-100 p-1 transition-colors duration-300 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      <span
        className={`absolute flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300 dark:bg-zinc-950 ${
          isDark ? 'translate-x-[1.65rem]' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-zinc-100" />
        ) : (
          <Sun className="h-4 w-4 text-forest-600" />
        )}
      </span>
    </button>
  )
}
