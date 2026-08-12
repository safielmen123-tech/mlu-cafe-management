import { useState, useEffect, useCallback, useMemo } from 'react'
import Login from './pages/Login'
import DashboardLayout from './components/common/DashboardLayout'
import ErrorBoundary from './components/common/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { POSProvider, usePOS } from './context/POSContext'
import { AlertsProvider } from './context/AlertsContext'
import { NotificationProvider } from './context/NotificationContext'
import { readActiveView, writeActiveView, VALID_VIEWS } from './utils/activeViewStorage'
import { getDefaultViewForUser } from './utils/permissions'

import Dashboard from './pages/Dashboard'
import Order from './pages/Order'
import Table from './pages/Table'
import Payment from './pages/Payment'
import MenuManagement from './pages/MenuManagement'
import SalesHistory from './pages/SalesHistory'
import InventoryStock from './pages/InventoryStock'
import ReportsAnalysis from './pages/ReportsAnalysis'
import ReportsAIPrediction from './pages/ReportsAIPrediction'
import Users from './pages/Users'
import Settings from './pages/Settings'
import BackupRecovery from './pages/BackupRecovery'

function AccessDenied({ onGoHome }) {
  return (
    <div className="surface-card mx-auto flex max-w-lg flex-col items-center px-8 py-12 text-center">
      <h3 className="text-heading text-lg font-semibold">Access restricted</h3>
      <p className="text-muted mt-2 text-sm">
        Your account does not have permission to open this section.
      </p>
      <button type="button" onClick={onGoHome} className="btn-primary mt-6 px-4 py-2 text-sm">
        Go to allowed page
      </button>
    </div>
  )
}

function AuthenticatedApp() {
  const { user, canAccess, setActivePage: persistSessionActivePage } = useAuth()
  const { registerNavigate } = usePOS()
  const [activePage, setActivePage] = useState(() => readActiveView())

  const resolvedPage = useMemo(() => {
    if (!user) return activePage
    return canAccess(activePage) ? activePage : getDefaultViewForUser(user)
  }, [user, activePage, canAccess])

  const handleNavigate = useCallback(
    (page) => {
      if (!VALID_VIEWS.has(page)) return
      if (!canAccess(page)) return
      setActivePage(page)
      writeActiveView(page)
      persistSessionActivePage(page)
    },
    [canAccess, persistSessionActivePage],
  )

  useEffect(() => {
    registerNavigate(handleNavigate)
  }, [registerNavigate, handleNavigate])

  useEffect(() => {
    if (!user || resolvedPage === activePage) return
    setActivePage(resolvedPage)
    writeActiveView(resolvedPage)
    persistSessionActivePage(resolvedPage)
  }, [user, resolvedPage, activePage, persistSessionActivePage])

  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        const saved = readActiveView()
        if (saved && canAccess(saved)) {
          setActivePage(saved)
        }
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [canAccess])

  const renderContentPage = () => {
    if (!canAccess(resolvedPage)) {
      return (
        <AccessDenied
          onGoHome={() => handleNavigate(getDefaultViewForUser(user))}
        />
      )
    }

    switch (resolvedPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />
      case 'order':
        return <Order />
      case 'table':
        return <Table />
      case 'payment':
        return <Payment />
      case 'menu':
        return <MenuManagement />
      case 'sales_history':
        return <SalesHistory />
      case 'inventory':
        return <InventoryStock />
      case 'reports_analysis':
        return <ReportsAnalysis />
      case 'reports_prediction':
        return <ReportsAIPrediction />
      case 'users':
        return <Users />
      case 'settings':
        return <Settings />
      case 'backup_recovery':
        return <BackupRecovery />
      default:
        return <Dashboard />
    }
  }

  return (
    <div key="dashboard" className="page-enter">
      <DashboardLayout activePage={resolvedPage} onNavigate={handleNavigate}>
        <ErrorBoundary resetKey={resolvedPage}>{renderContentPage()}</ErrorBoundary>
      </DashboardLayout>
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, login } = useAuth()

  if (!isAuthenticated) {
    return (
      <div key="login" className="page-enter">
        <Login onLogin={login} />
      </div>
    )
  }

  return (
    <POSProvider>
      <AlertsProvider>
        <NotificationProvider>
          <AuthenticatedApp />
        </NotificationProvider>
      </AlertsProvider>
    </POSProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
