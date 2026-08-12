import { Moon, Sun } from 'lucide-react'

import { useTheme } from '../../context/ThemeContext'



export default function ThemeToggle({ className = '' }) {

  const { isDark, toggleTheme } = useTheme()



  return (

    <button

      type="button"

      onClick={toggleTheme}

      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}

      className={`interactive-btn relative flex h-10 min-w-[3.75rem] items-center rounded-full border border-border bg-olive-50 p-1 transition-colors duration-300 dark:bg-obsidian-850 ${className}`}

    >

      <span

        className={`absolute flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300 dark:bg-obsidian-800 ${

          isDark ? 'translate-x-[1.65rem]' : 'translate-x-0'

        }`}

      >

        {isDark ? (

          <Moon className="h-4 w-4 text-olive-400" />

        ) : (

          <Sun className="h-4 w-4 text-forest-500" />

        )}

      </span>

    </button>

  )

}


