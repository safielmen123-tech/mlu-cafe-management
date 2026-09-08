import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const STORAGE_KEY = 'mlu_kitchen_cafe_lang'

/**
 * UI localization. Do NOT translate brand titles (Mlu Kitchen & Cafe Siem Reap),
 * or technical acronyms: POS, VIP, USD, $, ID.
 */
const resources = {
  en: {
    translation: {
      nav: {
        dashboard: 'Dashboard',
        users: 'Users',
        order: 'Order',
        table: 'Table',
        reservations: 'Reservations',
        payment: 'Payment',
        salesHistory: 'Sales History',
        inventoryStock: 'Inventory & Stock',
        menuManagement: 'Menu Management',
        reports: 'Reports',
        analysis: 'Analysis',
        others: 'Others',
        settings: 'Settings',
        backupRecovery: 'Backup & Recovery',
      },
      common: {
        source: 'Source',
        dateTime: 'Date / Time',
        payment: 'Payment',
        total: 'Total',
        status: 'Status',
        actions: 'Actions',
        loading: 'Loading...',
        updating: 'Updating…',
        save: 'Save',
        cancel: 'Cancel',
        search: 'Search',
        enabled: 'Enabled',
        disabled: 'Disabled',
      },
      dashboard: {
        todaySales: "Today's Sales",
        todaySpending: "Today's Spending",
        netProfit: 'Net Profit',
        netProfitHint: 'Income − Spending',
        spendingHint: 'Logged expenses',
        ordersToday: 'orders today',
        activeCashier: 'Active Cashier',
        onDuty: 'On duty',
      },
      sales: {
        subtitle: 'Review completed orders and print receipts',
        tabs: {
          logs: 'Order Logs',
          expenses: 'Expenses',
        },
        period: 'Period',
        orders: 'Orders',
        grossRevenue: 'Gross revenue',
        searchPlaceholder: 'Search by invoice, source, payment, or status...',
        emptyLogs: 'No completed orders found for this month and search filter.',
        printReceipt: 'Print Receipt',
      },
      payment: {
        receivedTitle: 'Payment Received',
        receivedMessage: 'Payment Received for {{source}} / Invoice #{{invoice}}',
        subtitle: 'Manage active bills, apply adjustments, and complete checkout transactions',
      },
      settings: {
        subtitle: 'Manage appearance, notifications, and system preferences',
        appearance: 'Appearance',
        colorTheme: 'Color Theme',
        colorThemeDesc: 'Switch between light and dark mode across the entire management dashboard.',
        dark: 'Dark',
        light: 'Light',
        darkCanvas: 'Dark Canvas',
        darkCanvasDesc:
          'Dashboard uses deep backgrounds and glass-effect cards in dark mode for high contrast readability.',
        active: 'Active',
        inactive: 'Inactive',
        notifications: 'Notifications',
        lowStockAlerts: 'Low Stock Alerts',
        lowStockAlertsDesc: 'Receive alerts when inventory items fall below safe thresholds.',
        enabled: 'Enabled',
        disabled: 'Disabled',
        security: 'Security',
        session: 'Session Management',
        sessionDesc: 'Your session expires 8 hours after sign-in for security.',
        standard: 'Standard',
        auditSection: 'Security History',
      },
      expenses: {
        title: 'Expense / Spending',
        add: 'Add Expense',
        empty: 'No spending logged yet.',
      },
      audit: {
        title: 'Audit Logs / Security History',
        subtitle: 'Administrator-only trail of logins, orders, menu edits, and payments',
      },
    },
  },
  km: {
    translation: {
      nav: {
        dashboard: 'ផ្ទាំងគ្រប់គ្រង',
        users: 'អ្នកប្រើប្រាស់',
        order: 'ការកុម្មង់',
        table: 'តុ',
        reservations: 'ការកក់តុ',
        payment: 'ការទូទាត់',
        salesHistory: 'ប្រវត្តិនៃការលក់',
        inventoryStock: 'ស្តុក & អីវ៉ាន់',
        menuManagement: 'ការគ្រប់គ្រងមុខម្ហូប',
        reports: 'របាយការណ៍',
        analysis: 'ការវិភាគ',
        others: 'ផ្សេងៗ',
        settings: 'ការកំណត់',
        backupRecovery: 'បម្រុងទុក & ស្តារ',
      },
      common: {
        source: 'ប្រភព',
        dateTime: 'កាលបរិច្ឆេទ / ម៉ោង',
        payment: 'ការទូទាត់',
        total: 'សរុប',
        status: 'ស្ថានភាព',
        actions: 'សកម្មភាព',
        loading: 'កំពុងផ្ទុក...',
        updating: 'កំពុងធ្វើបច្ចុប្បន្នភាព…',
        save: 'រក្សាទុក',
        cancel: 'បោះបង់',
        search: 'ស្វែងរក',
        enabled: 'បើក',
        disabled: 'បិទ',
      },
      dashboard: {
        todaySales: 'ការលក់ថ្ងៃនេះ',
        todaySpending: 'ចំណាយថ្ងៃនេះ',
        netProfit: 'ប្រាក់ចំណេញសុទ្ធ',
        netProfitHint: 'ចំណូល − ចំណាយ',
        spendingHint: 'ចំណាយដែលបានកត់ត្រា',
        ordersToday: 'ការកុម្មង់ថ្ងៃនេះ',
        activeCashier: 'អ្នកគិតលុយកំពុងបម្រើ',
        onDuty: 'កំពុងធ្វើការ',
      },
      sales: {
        subtitle: 'ពិនិត្យការកុម្មង់ដែលបានបញ្ចប់ និងបោះពុម្ពបង្កាន់ដៃ',
        tabs: {
          logs: 'កំណត់ហេតុការកុម្មង់',
          expenses: 'ចំណាយ',
        },
        period: 'រយៈពេល',
        orders: 'ការកុម្មង់',
        grossRevenue: 'ចំណូលសរុប',
        searchPlaceholder: 'ស្វែងរកតាមវិក្កយបត្រ ប្រភព ការទូទាត់ ឬស្ថានភាព...',
        emptyLogs: 'រកមិនឃើញការកុម្មង់ដែលបានបញ្ចប់សម្រាប់ខែ និងតម្រងនេះទេ។',
        printReceipt: 'បោះពុម្ពបង្កាន់ដៃ',
      },
      payment: {
        receivedTitle: 'បានទទួលការទូទាត់',
        receivedMessage: 'បានទទួលការទូទាត់សម្រាប់ {{source}} / Invoice #{{invoice}}',
        subtitle: 'គ្រប់គ្រងវិក្កយបត្រសកម្ម កែតម្រូវ និងបញ្ចប់ការទូទាត់',
      },
      settings: {
        subtitle: 'គ្រប់គ្រងរូបរាង ការជូនដំណឹង និងការកំណត់ប្រព័ន្ធ',
        appearance: 'រូបរាង',
        colorTheme: 'ពណ៌ស្បែក',
        colorThemeDesc: 'ប្តូររវាងរបៀបភ្លឺ និងងងឹតនៅទូទាំងផ្ទាំងគ្រប់គ្រង។',
        dark: 'ងងឹត',
        light: 'ភ្លឺ',
        darkCanvas: 'ផ្ទៃងងឹត',
        darkCanvasDesc: 'ផ្ទាំងគ្រប់គ្រងប្រើផ្ទៃងងឹតសម្រាប់ភាពច្បាស់ខ្ពស់។',
        active: 'សកម្ម',
        inactive: 'អសកម្ម',
        notifications: 'ការជូនដំណឹង',
        lowStockAlerts: 'ការជូនដំណឹងស្តុកទាប',
        lowStockAlertsDesc: 'ទទួលការជូនដំណឹងនៅពេលស្តុកធ្លាក់ក្រោមកម្រិតសុវត្ថិភាព។',
        enabled: 'បើក',
        disabled: 'បិទ',
        security: 'សុវត្ថិភាព',
        session: 'ការគ្រប់គ្រងសម័យ',
        sessionDesc: 'សម័យរបស់អ្នកផុតកំណត់ ៨ ម៉ោង បន្ទាប់ពីចូលប្រើ ដើម្បីសុវត្ថិភាព។',
        standard: 'ស្តង់ដារ',
        auditSection: 'ប្រវត្តិសុវត្ថិភាព',
      },
      expenses: {
        title: 'ចំណាយ / ការចំណាយ',
        add: 'បន្ថែមចំណាយ',
        empty: 'មិនទាន់មានការកត់ត្រាចំណាយទេ។',
      },
      audit: {
        title: 'កំណត់ហេតុសវនកម្ម / ប្រវត្តិសុវត្ថិភាព',
        subtitle: 'សម្រាប់អ្នកគ្រប់គ្រងប្រព័ន្ធ — ការចូល ការកុម្មង់ ការកែម៉ឺនុយ និងការទូទាត់',
      },
    },
  },
}

const savedLang =
  typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang === 'km' ? 'km' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lng)
  }
})

export default i18n
