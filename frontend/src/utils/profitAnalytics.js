import {
  buildDailySalesForMonth,
  buildMonthlyTotalsChart,
  filterOrdersByMonth,
} from './salesHistoryAnalytics'

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function getExpenseMonthKey(expense) {
  return String(expense?.expense_date || '').slice(0, 7)
}

export function filterExpensesByMonth(expenses, monthKey) {
  if (!monthKey || monthKey === 'all') return expenses
  return expenses.filter((expense) => getExpenseMonthKey(expense) === monthKey)
}

export function summarizeExpenses(expenses) {
  const byCategory = {}
  let total = 0

  for (const expense of expenses) {
    const amount = Number.parseFloat(expense.amount || 0)
    total += amount
    const category = expense.category || 'Others'
    byCategory[category] = roundMoney((byCategory[category] || 0) + amount)
  }

  return {
    total: roundMoney(total),
    byCategory,
  }
}

export function summarizeProfit(orders, expenses) {
  const revenue = orders.reduce((sum, order) => sum + Number.parseFloat(order.total || 0), 0)
  const spending = expenses.reduce((sum, expense) => sum + Number.parseFloat(expense.amount || 0), 0)
  return {
    revenue: roundMoney(revenue),
    expenses: roundMoney(spending),
    profit: roundMoney(revenue - spending),
    orders: orders.length,
  }
}

export function buildDailyProfitForMonth(orders, expenses, monthKey) {
  const days = buildDailySalesForMonth(orders, monthKey)
  const spendByDay = {}

  for (const expense of expenses) {
    const dateKey = String(expense.expense_date || '').slice(0, 10)
    if (!dateKey.startsWith(monthKey)) continue
    spendByDay[dateKey] = (spendByDay[dateKey] || 0) + Number.parseFloat(expense.amount || 0)
  }

  return days.map((day) => {
    const expensesTotal = roundMoney(spendByDay[day.key] || 0)
    return {
      ...day,
      expenses: expensesTotal,
      profit: roundMoney(day.revenue - expensesTotal),
    }
  })
}

export function buildMonthlyProfitChart(orders, expenses, monthOptions) {
  return buildMonthlyTotalsChart(orders, monthOptions)
    .map((month) => {
      const monthExpenses = filterExpensesByMonth(expenses, month.monthKey)
      const expensesTotal = roundMoney(
        monthExpenses.reduce((sum, expense) => sum + Number.parseFloat(expense.amount || 0), 0),
      )
      return {
        ...month,
        expenses: expensesTotal,
        profit: roundMoney(month.revenue - expensesTotal),
        salesOrders: filterOrdersByMonth(orders, month.monthKey).length,
      }
    })
    .filter((month) => month.revenue > 0 || month.expenses > 0)
}
