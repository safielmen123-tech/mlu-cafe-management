import { useState, useCallback } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import ThemeToggle from '../ui/ThemeToggle'
import LanguageToggle from '../ui/LanguageToggle'
import NotificationBell from './NotificationBell'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'

function formatNavRoleLabel(user) {
  if (!user?.role) return 'Staff'
  const role = String(user.role).trim()
  if (/^admin$/i.test(role)) return 'System Administrator'
  return role
}

export default function DashboardLayout({ children, activePage, onNavigate }) {
  const { user } = useAuth()
  const { isDarkCanvas } = useSettings()
  const navRoleLabel = formatNavRoleLabel(user)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  return (
    <div
      className={`flex h-screen w-full max-w-[100vw] overflow-x-hidden bg-background text-foreground transition-colors duration-300${
        isDarkCanvas ? ' dark-canvas' : ''
      }`}
    >
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="modal-backdrop fixed inset-0 z-40 sm:hidden"
          onClick={closeMobileNav}
        />
      ) : null}

      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        mobileOpen={mobileNavOpen}
        onMobileClose={closeMobileNav}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-forest-500/[0.03] blur-3xl" />
          <div className="absolute -left-1/4 -bottom-1/4 h-1/2 w-1/2 rounded-full bg-olive-200/20 blur-3xl" />
        </div>

        <header className="relative z-40 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-md sm:px-8 dark:border-zinc-800 dark:bg-zinc-900/80">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-border bg-card text-foreground sm:hidden"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {navRoleLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell onNavigate={onNavigate} />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-5 sm:p-8">{children}</main>
      </div>
    </div>
  )
}
