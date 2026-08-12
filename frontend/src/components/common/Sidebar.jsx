import { useMemo, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { useAuth } from '../../context/AuthContext'

import { STORE } from '../../config/store'

import {

  LayoutDashboard,

  ShoppingCart,

  Coffee,

  CreditCard,

  UtensilsCrossed,

  History,

  Layers,

  BarChart3,

  Users,

  Settings,

  HardDrive,

  FolderOpen,

  FileBarChart,

  Sparkles,

  ChevronDown,

  LogOut,

  X,

} from 'lucide-react'

import { canAccessView, filterAccessibleNavItems } from '../../utils/permissions'



const primaryNavigationItems = [

  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },

  { id: 'users', labelKey: 'nav.users', icon: Users, adminOnly: true },

  { id: 'order', labelKey: 'nav.order', icon: ShoppingCart },

  { id: 'table', labelKey: 'nav.table', icon: Coffee },

  { id: 'payment', labelKey: 'nav.payment', icon: CreditCard },

  { id: 'sales_history', labelKey: 'nav.salesHistory', icon: History },

  { id: 'inventory', labelKey: 'nav.inventoryStock', icon: Layers },

]



const menuNavigationItem = {

  id: 'menu',

  labelKey: 'nav.menuManagement',

  icon: UtensilsCrossed,

}



const reportsSubItems = [

  { id: 'reports_analysis', labelKey: 'nav.analysis', icon: BarChart3 },

  { id: 'reports_prediction', labelKey: 'nav.aiPrediction', icon: Sparkles },

]



const othersSubItems = [

  { id: 'settings', labelKey: 'nav.settings', icon: Settings },

  { id: 'backup_recovery', labelKey: 'nav.backupRecovery', icon: HardDrive },

]



function SidebarNavButton({ item, isActive, onNavigate, compact = false }) {

  const { t } = useTranslation()

  const IconComponent = item.icon

  const label = t(item.labelKey)



  return (

    <button

      type="button"

      onClick={() => onNavigate(item.id)}

      title={label}

      aria-label={label}

      aria-current={isActive ? 'page' : undefined}

      className={`group interactive-nav flex min-h-10 w-full cursor-pointer select-none items-center rounded-xl text-sm ${

        compact

          ? 'gap-2 py-2 pl-3 pr-2 lg:gap-3 lg:pl-4'

          : 'justify-center gap-0 px-2 py-2 sm:justify-center lg:justify-start lg:gap-3 lg:px-3'

      } ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}

    >

      <IconComponent

        className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-colors ${

          isActive ? 'text-forest-600 dark:text-forest-400' : 'text-olive-400 group-hover:text-olive-600'

        }`}

      />

      <span className={`truncate ${compact ? 'inline' : 'hidden max-sm:inline lg:inline'}`}>{label}</span>

    </button>

  )

}



function NavFolder({

  labelKey,

  folderIcon: FolderIcon,

  activePage,

  onNavigate,

  items,

  expanded,

  onToggleExpanded,

}) {

  const { t } = useTranslation()



  if (!items.length) return null

  const isChildActive = items.some((item) => item.id === activePage)



  return (

    <>

      <div className="hidden lg:block">

        <div className="space-y-1">

          <button

            type="button"

            onClick={onToggleExpanded}

            aria-expanded={expanded}

            className={`interactive-nav flex min-h-10 w-full cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-sm ${

              isChildActive ? 'nav-item-active font-medium' : 'nav-item-inactive'

            }`}

          >

            <FolderIcon className="h-[1.125rem] w-[1.125rem] shrink-0" />

            <span className="flex-1 truncate text-left">{t(labelKey)}</span>

            <ChevronDown

              className={`h-4 w-4 shrink-0 text-olive-400 transition-transform duration-300 ${

                expanded ? 'rotate-180' : ''

              }`}

            />

          </button>

          <div className={`grid transition-[grid-template-rows] duration-300 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>

            <div className="overflow-hidden">

              <div className="space-y-0.5 border-l border-border py-1 pl-2 ml-3">

                {items.map((item) => (

                  <SidebarNavButton

                    key={item.id}

                    item={item}

                    isActive={activePage === item.id}

                    onNavigate={onNavigate}

                    compact

                  />

                ))}

              </div>

            </div>

          </div>

        </div>

      </div>

      <div className="space-y-1 lg:hidden">

        {items.map((item) => (

          <SidebarNavButton

            key={item.id}

            item={item}

            isActive={activePage === item.id}

            onNavigate={onNavigate}

          />

        ))}

      </div>

    </>

  )

}



export default function Sidebar({ activePage, onNavigate, mobileOpen = false, onMobileClose }) {

  const { user, logout } = useAuth()

  const [reportsExpanded, setReportsExpanded] = useState(false)

  const [othersExpanded, setOthersExpanded] = useState(false)



  const visiblePrimaryItems = useMemo(

    () => filterAccessibleNavItems(primaryNavigationItems, user),

    [user],

  )



  const canAccessMenu = canAccessView(user, 'menu')

  const visibleReportsItems = useMemo(

    () => filterAccessibleNavItems(reportsSubItems, user),

    [user],

  )

  const visibleOthersItems = useMemo(

    () => filterAccessibleNavItems(othersSubItems, user),

    [user],

  )



  const isReportsChildActive = visibleReportsItems.some((item) => item.id === activePage)

  const isOthersChildActive = visibleOthersItems.some((item) => item.id === activePage)



  // Reveal the group that owns the current page whenever navigation changes.
  const [syncedPage, setSyncedPage] = useState(null)

  if (syncedPage !== activePage) {
    setSyncedPage(activePage)
    if (isReportsChildActive) setReportsExpanded(true)
    if (isOthersChildActive) setOthersExpanded(true)
  }



  const handleNavigate = (pageId) => {

    onNavigate(pageId)

    onMobileClose?.()

  }



  return (

    <aside

      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(18rem,88vw)] flex-col border-r border-[#e5e5e7] bg-white/80 p-3 backdrop-blur-md transition-transform duration-300 ease-out dark:border-border dark:bg-card/90 sm:relative sm:z-auto sm:w-[4.5rem] sm:translate-x-0 sm:p-2 lg:w-60 lg:p-4 ${

        mobileOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'

      }`}

    >

      <div className="mb-4 flex items-start justify-between gap-2 lg:mb-8 lg:px-1">

        <div className="min-w-0 flex-1">

          <div className="hidden lg:block">

            <h2 className="text-base font-semibold tracking-tight text-foreground">{STORE.officialName}</h2>

            <p className="mt-0.5 text-xs text-muted-foreground">{STORE.location}</p>

          </div>

          <div className="hidden justify-center sm:flex lg:hidden">

            <div

              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-xs font-semibold text-forest-600 ring-1 ring-forest-100"

              title={STORE.officialName}

            >

              RC

            </div>

          </div>

          <div className="sm:hidden">

            <h2 className="text-base font-semibold tracking-tight text-foreground">{STORE.officialName}</h2>

            <p className="text-xs text-muted-foreground">{STORE.location}</p>

          </div>

        </div>

        <button

          type="button"

          onClick={onMobileClose}

          className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-olive-400 hover:bg-olive-50 sm:hidden"

          aria-label="Close navigation menu"

        >

          <X className="h-5 w-5" />

        </button>

      </div>



      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden pb-2">

        {visiblePrimaryItems.map((item) => (

          <SidebarNavButton

            key={item.id}

            item={item}

            isActive={activePage === item.id}

            onNavigate={handleNavigate}

          />

        ))}



        {canAccessMenu && (

          <SidebarNavButton

            item={menuNavigationItem}

            isActive={activePage === menuNavigationItem.id}

            onNavigate={handleNavigate}

          />

        )}



        {visibleReportsItems.length > 0 && (

          <NavFolder

            labelKey="nav.reports"

            folderIcon={FileBarChart}

            activePage={activePage}

            onNavigate={handleNavigate}

            items={visibleReportsItems}

            expanded={reportsExpanded}

            onToggleExpanded={() => setReportsExpanded((prev) => !prev)}

          />

        )}



        {visibleOthersItems.length > 0 && (

          <NavFolder

            labelKey="nav.others"

            folderIcon={FolderOpen}

            activePage={activePage}

            onNavigate={handleNavigate}

            items={visibleOthersItems}

            expanded={othersExpanded}

            onToggleExpanded={() => setOthersExpanded((prev) => !prev)}

          />

        )}

      </nav>



      <div className="mt-2 border-t border-border pt-3 lg:mt-3 lg:pt-4">

        <button

          type="button"

          onClick={() => {

            onMobileClose?.()

            logout()

          }}

          className="interactive-nav flex min-h-10 w-full cursor-pointer select-none items-center justify-center gap-0 rounded-xl px-2 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 lg:justify-start lg:gap-3 lg:px-3 dark:hover:bg-red-950/30"

        >

          <LogOut className="h-[1.125rem] w-[1.125rem] shrink-0" />

          <span className="hidden max-sm:inline lg:inline">Sign Out</span>

        </button>

      </div>

    </aside>

  )

}


