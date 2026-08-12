export const TAKEOUT_ID = 'takeout'

export const TAKEOUT_BILL = {
  id: TAKEOUT_ID,
  name: 'Take Out',
  isTakeOut: true,
  status: 'empty',
  orderTotal: null,
  orderSummary: null,
  items: [],
}

export const floorTables = [
  {
    id: 1,
    name: 'Table 1',
    isTakeOut: false,
    status: 'empty',
    orderTotal: null,
    orderSummary: null,
    items: [],
  },
  {
    id: 2,
    name: 'Table 2',
    isTakeOut: false,
    status: 'occupied',
    orderTotal: 20.35,
    orderSummary: '2× Cappuccino, 1× Croissant',
    items: [
      { id: 1, name: 'Cappuccino', qty: 2, unitPrice: 4.25, lineTotal: 8.5 },
      { id: 5, name: 'Croissant', qty: 1, unitPrice: 3.5, lineTotal: 3.5 },
    ],
  },
  {
    id: 3,
    name: 'Table 3',
    isTakeOut: false,
    status: 'occupied',
    orderTotal: 36.03,
    orderSummary: '1× Latte, 2× Mocha, 1× Blueberry Muffin',
    items: [
      { id: 2, name: 'Latte', qty: 1, unitPrice: 4.25, lineTotal: 4.25 },
      { id: 4, name: 'Mocha', qty: 2, unitPrice: 4.5, lineTotal: 9.0 },
      { id: 7, name: 'Blueberry Muffin', qty: 1, unitPrice: 3.5, lineTotal: 3.5 },
    ],
  },
  {
    id: 4,
    name: 'Table 4',
    isTakeOut: false,
    status: 'empty',
    orderTotal: null,
    orderSummary: null,
    items: [],
  },
  {
    id: 5,
    name: 'Table 5',
    isTakeOut: false,
    status: 'occupied',
    orderTotal: 13.2,
    orderSummary: '3× Americano',
    items: [{ id: 3, name: 'Americano', qty: 3, unitPrice: 4.0, lineTotal: 12.0 }],
  },
  {
    id: 6,
    name: 'Table 6',
    isTakeOut: false,
    status: 'empty',
    orderTotal: null,
    orderSummary: null,
    items: [],
  },
  {
    id: 7,
    name: 'VIP Room 1',
    isTakeOut: false,
    status: 'occupied',
    orderTotal: 59.68,
    orderSummary: '4× Cappuccino, 2× Chocolate Cake, 1× Iced Coffee',
    items: [
      { id: 1, name: 'Cappuccino', qty: 4, unitPrice: 4.25, lineTotal: 17.0 },
      { id: 8, name: 'Chocolate Cake', qty: 2, unitPrice: 4.75, lineTotal: 9.5 },
      { id: 6, name: 'Iced Coffee', qty: 1, unitPrice: 4.75, lineTotal: 4.75 },
    ],
  },
  {
    id: 8,
    name: 'VIP Room 2',
    isTakeOut: false,
    status: 'empty',
    orderTotal: null,
    orderSummary: null,
    items: [],
  },
]

export const TABLE_STATUS_META = {
  empty: {
    label: 'Empty',
    badge:
      'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-700/50',
    card: 'border-emerald-300/80 bg-emerald-50/30 dark:border-emerald-700/40 dark:bg-emerald-950/15',
  },
  occupied: {
    label: 'Occupied',
    badge:
      'bg-amber-50 text-amber-800 ring-amber-300/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700/50',
    card: 'border-amber-300/70 bg-amber-50/35 dark:border-amber-700/40 dark:bg-amber-950/20',
  },
}

/** Cashier queue badge — all open unbilled orders display as awaiting checkout */
export const PAYMENT_QUEUE_STATUS = {
  label: 'Pending Bill',
  badge:
    'bg-orange-100 text-orange-900 ring-orange-400/80 dark:bg-orange-950/45 dark:text-orange-200 dark:ring-orange-600/50',
}

export const FLOOR_STATUS_KEYS = ['empty', 'occupied']
