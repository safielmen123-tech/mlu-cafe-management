import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import {
  applyItemsToBill,
  calculateTotals,
  formatInvoiceId,
  formatNow,
  mergeCartIntoItems,
  normalizeBillItem,
} from '../utils/posHelpers'
import { buildSalesHistoryQuery } from '../utils/salesHistoryAnalytics'
import { formatOrderDate, formatTime12Hour } from '../utils/dateTimeFormat'
import {
  readActiveOrdersSnapshot,
  writeActiveOrdersSnapshot,
  hydrateFromSnapshot,
  groupActiveRows,
  reconcileActiveOrders,
} from '../utils/activeOrdersStorage'
import { getFloorTableLabel } from '../data/tables'

import { apiFetch, getAuthToken } from '../services/apiClient'

const POSContext = createContext(null)

function statusForTarget(items) {
  return items.length > 0 ? 'occupied' : 'empty'
}

function getInitialState() {
  const snapshot = readActiveOrdersSnapshot()
  return hydrateFromSnapshot(snapshot)
}

function buildOrderTargetPayload(destinationId) {
  if (destinationId === 'takeout') {
    return { target_id: 'takeout', table_id: null }
  }

  const tableNumber = Number.parseInt(String(destinationId), 10)
  return {
    target_id: destinationId,
    table_id: Number.isNaN(tableNumber) ? null : tableNumber,
  }
}

function mapBillItemsForApi(items) {
  return items.map((item) => {
    const parsedId = Number.parseInt(item.menu_item_id ?? item.id, 10)
    return {
      menu_item_id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null,
      name: item.name,
      notes: item.notes || '',
      serving: item.serving || null,
      quantity: item.qty,
      price: item.unitPrice,
    }
  })
}

async function postOrderToServer(destinationId, safeCartItems) {
  const response = await apiFetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildOrderTargetPayload(destinationId),
      items: mapBillItemsForApi(safeCartItems),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || data.message || `Server status returned ${response.status}`)
  }
  return data
}

export function POSProvider({ children }) {
  const initialState = getInitialState()
  const [tables, setTables] = useState(initialState.tables)
  const [takeOut, setTakeOut] = useState(initialState.takeOut)
  const [salesHistory, setSalesHistory] = useState([])
  const [invoiceCounter, setInvoiceCounter] = useState(initialState.invoiceCounter)
  const [paymentTargetId, setPaymentTargetId] = useState(null)
  const [orderTargetId, setOrderTargetId] = useState(null)
  const navigateRef = useRef(null)
  const tablesRef = useRef(initialState.tables)
  const takeOutRef = useRef(initialState.takeOut)

  // Mirrored into refs so async handlers read current floor state without re-subscribing.
  useEffect(() => {
    tablesRef.current = tables
    takeOutRef.current = takeOut
  }, [tables, takeOut])

  const registerNavigate = useCallback((fn) => {
    navigateRef.current = fn
  }, [])

  const openPaymentFor = useCallback((targetId) => {
    setPaymentTargetId(targetId)
    navigateRef.current?.('payment')
  }, [])

  const openOrderFor = useCallback((targetId) => {
    setOrderTargetId(targetId)
    navigateRef.current?.('order')
  }, [])

  const clearOrderTarget = useCallback(() => {
    setOrderTargetId(null)
  }, [])

  const clearPaymentTarget = useCallback(() => {
    setPaymentTargetId(null)
  }, [])

  const loadSalesHistory = useCallback(async (options) => {
    const token = getAuthToken()
    if (!token) return null

    try {
      const query = buildSalesHistoryQuery(options)
      const response = await apiFetch(`/orders/history?${query}`, { token })
      if (response.status === 401) return null
      if (!response.ok) throw new Error(`Server status returned ${response.status}`)
      const historyRows = await response.json()

      if (historyRows && Array.isArray(historyRows)) {
        const formattedHistory = historyRows.map((row) => ({
          id: row.invoice_id || row.id,
          date: formatOrderDate(row.date || row.created_at),
          time: formatTime12Hour(row.time || row.created_at),
          monthKey: row.month_key || (row.date ? String(row.date).slice(0, 7) : null),
          payment: row.payment_method || 'Cash',
          subtotal: parseFloat(row.subtotal || 0),
          tax: parseFloat(row.tax || 0),
          total: parseFloat(row.total || 0),
          status: row.status || 'Completed',
          source:
            row.target_id === 'takeout' || row.source_type === 'Take Out'
              ? 'Take Out'
              : getFloorTableLabel(row.target_id),
          summary: row.summary || '',
          items: row.items || [],
        }))
        setSalesHistory(formattedHistory)
        return formattedHistory
      }
    } catch (err) {
      console.error('Error loading historical database entries:', err)
      setSalesHistory([])
    }
    return null
  }, [])

  useEffect(() => {
    writeActiveOrdersSnapshot({ tables, takeOut, invoiceCounter })
  }, [tables, takeOut, invoiceCounter])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) return undefined

    let cancelled = false
    apiFetch('/orders/active', { token })
      .then(async (res) => {
        if (cancelled || res.status === 401) return null
        if (!res.ok) throw new Error(`Server status returned ${res.status}`)
        return res.json()
      })
      .then((activeOrderRows) => {
        if (cancelled || !activeOrderRows || !Array.isArray(activeOrderRows)) return

        const groupedOrders = groupActiveRows(activeOrderRows)
        const reconciled = reconcileActiveOrders(
          tablesRef.current,
          takeOutRef.current,
          groupedOrders,
        )
        setTables(reconciled.tables)
        setTakeOut(reconciled.takeOut)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching live table states:', err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    loadSalesHistory()
  }, [loadSalesHistory])

  const getBillById = (id) => {
    if (id === 'takeout') return takeOut
    return tables.find((table) => table.id === id) ?? null
  }

  const getActiveBills = useCallback(() => {
    const tableBills = tables.filter((table) => table.status !== 'empty')
    const bills = [...tableBills]
    if (takeOut.status !== 'empty') {
      bills.push(takeOut)
    }
    return bills.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [tables, takeOut])

  const assignmentTargets = [
    ...tables.map((table) => ({
      id: table.id,
      name: table.name,
      status: table.status,
      section: table.section || 'standard',
      isTakeOut: false,
    })),
    {
      id: takeOut.id,
      name: takeOut.name,
      status: takeOut.status,
      isTakeOut: true,
    },
  ]

  const persistBillItems = async (targetId, items) => {
    const response = await apiFetch('/orders/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildOrderTargetPayload(targetId),
        items: mapBillItemsForApi(items),
      }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.detail || data.message || `Server status returned ${response.status}`)
    }
  }

  const updateBillState = (destinationId, items, statusOverride) => {
    if (destinationId === 'takeout') {
      setTakeOut((prev) => applyItemsToBill(prev, items, statusOverride))
    } else {
      setTables((prev) =>
        prev.map((table) =>
          table.id === destinationId ? applyItemsToBill(table, items, statusOverride) : table,
        ),
      )
    }
  }

  const assignOrder = (destinationId, cartItems) => {
    if (!cartItems.length) return false

    const safeCartItems = cartItems.map((item) =>
      normalizeBillItem({
        id: item.id,
        menu_item_id: item.menu_item_id ?? item.id,
        name: item.name,
        notes: item.notes || '',
        qty: item.qty || item.quantity || 1,
        unitPrice: item.unitPrice || item.price || 0,
        serving: item.serving || null,
      }),
    )

    const updateBill = (bill) => {
      const mergedItems = mergeCartIntoItems(bill.items, safeCartItems)
      const finalizedItems = mergedItems.map(normalizeBillItem)
      const status = statusForTarget(finalizedItems)
      return applyItemsToBill(bill, finalizedItems, status)
    }

    if (destinationId === 'takeout') {
      setTakeOut((prev) => updateBill(prev))
    } else {
      setTables((prev) =>
        prev.map((table) => (table.id === destinationId ? updateBill(table) : table)),
      )
    }

    postOrderToServer(destinationId, safeCartItems).catch((err) => {
      console.error('Failed to log order to MySQL (local state retained):', err.message)
    })

    return true
  }

  const updateBillItems = (destinationId, items) => {
    const status = statusForTarget(items)
    if (items.length === 0) {
      persistBillItems(destinationId, items)
        .then(() => updateBillState(destinationId, items, status))
        .catch((err) => {
          console.error('Failed to clear bill items:', err.message)
        })
      return
    }
    updateBillState(destinationId, items, status)
    persistBillItems(destinationId, items).catch((err) => {
      console.error('Failed to sync bill items:', err.message)
    })
  }

  const decrementBillItem = (destinationId, itemId) => {
    const bill = getBillById(destinationId)
    if (!bill) return

    const nextItems = bill.items
      .map((item) => {
        if (item.id !== itemId) return item
        const nextQty = item.qty - 1
        if (nextQty <= 0) return null
        return normalizeBillItem({ ...item, qty: nextQty })
      })
      .filter(Boolean)

    updateBillItems(destinationId, nextItems)
  }

  const updateBillItemPrice = (destinationId, itemId, newPrice) => {
    const bill = getBillById(destinationId)
    if (!bill) return

    const price = Math.max(0, parseFloat(newPrice) || 0)
    const nextItems = bill.items.map((item) =>
      item.id === itemId ? normalizeBillItem({ ...item, unitPrice: price }) : item,
    )
    updateBillItems(destinationId, nextItems)
  }

  const processPayment = async (destinationId, paymentMethod = 'Cash') => {
    const bill = getBillById(destinationId)
    if (!bill || bill.items.length === 0) return null

    const { subtotal, tax, total } = calculateTotals(bill.items)
    const { date, time } = formatNow()
    const invoiceId = formatInvoiceId(invoiceCounter)

    const transaction = {
      id: invoiceId,
      date,
      time,
      monthKey: date.slice(0, 7),
      payment: paymentMethod,
      subtotal,
      tax,
      total,
      status: 'Completed',
      source: bill.name,
      summary: bill.orderSummary,
      items: bill.items.map((item) => ({ ...item })),
    }

    let persistedToServer = false

    try {
      await persistBillItems(destinationId, bill.items)

      const response = await apiFetch('/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildOrderTargetPayload(destinationId),
          invoice_id: invoiceId,
          payment_method: paymentMethod,
          subtotal,
          tax,
          total,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || data.message || `Server status returned ${response.status}`)
      }
      persistedToServer = true
    } catch (err) {
      console.error('Failed logging transaction payment:', err.message)
    }

    setSalesHistory((prev) => [transaction, ...prev])
    if (persistedToServer) {
      loadSalesHistory().catch((err) => {
        console.error('Failed to refresh sales history after checkout:', err.message)
      })
    }
    setInvoiceCounter((prev) => prev + 1)

    const cleared = applyItemsToBill(bill, [])

    if (destinationId === 'takeout') {
      setTakeOut(cleared)
    } else {
      setTables((prev) => prev.map((table) => (table.id === destinationId ? cleared : table)))
    }

    return transaction
  }

  return (
    <POSContext.Provider
      value={{
        tables,
        takeOut,
        salesHistory,
        loadSalesHistory,
        assignmentTargets,
        paymentTargetId,
        orderTargetId,
        getBillById,
        getActiveBills,
        assignOrder,
        updateBillItems,
        decrementBillItem,
        updateBillItemPrice,
        processPayment,
        openPaymentFor,
        openOrderFor,
        clearOrderTarget,
        clearPaymentTarget,
        registerNavigate,
      }}
    >
      {children}
    </POSContext.Provider>
  )
}

export function usePOS() {
  const context = useContext(POSContext)
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider')
  }
  return context
}
