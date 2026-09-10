import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import AlertCenter from '../alerts/AlertCenter'
import { useAlerts } from '../../hooks/useAlerts'
import { useAuth } from '../../context/AuthContext'

export default function NotificationBell({ onNavigate }) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const {
    alerts,
    counts,
    badgeCount,
    isLoading,
    error,
    refresh,
    markNotificationRead,
    lowStockAlertsEnabled,
  } = useAlerts()
  const hasSecurityAlerts = alerts.some((alert) => alert.category === 'password_reset')
  const hasReservationAlerts = alerts.some((alert) => alert.category === 'reservation')
  const showNotifications = isAdmin || hasSecurityAlerts || hasReservationAlerts || lowStockAlertsEnabled
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const handleClickOutside = (event) => {
      if (
        panelRef.current?.contains(event.target) ||
        buttonRef.current?.contains(event.target)
      ) {
        return
      }
      setIsOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleAction = (alert) => {
    const target = alert?.action?.navigateTo || (alert?.category === 'password_reset' ? 'users' : alert?.category === 'reservation' ? 'reservations' : 'inventory')
    onNavigate?.(target)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) refresh()
        }}
        aria-label={
          badgeCount
            ? t('a11y.notificationsActive', { count: badgeCount })
            : t('a11y.notifications')
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border/50 bg-card/50 text-foreground backdrop-blur-sm transition-all hover:border-border hover:bg-card active:scale-95 dark:bg-card/40"
      >
        <Bell className="h-5 w-5 text-foreground/90" />
        {showNotifications && badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-900/40 ring-2 ring-background">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {isOpen && showNotifications && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl dark:bg-[#121816]/95 dark:shadow-black/40 dark:backdrop-blur-md sm:w-[26rem]"
        >
          <AlertCenter
            alerts={alerts}
            counts={counts}
            isLoading={isLoading}
            error={error}
            onAction={handleAction}
            onDismiss={markNotificationRead}
            onViewAll={() => {
              onNavigate?.(hasSecurityAlerts ? 'users' : hasReservationAlerts ? 'reservations' : 'inventory')
              setIsOpen(false)
            }}
            variant="panel"
            maxItems={8}
          />
        </div>
      )}
    </div>
  )
}
