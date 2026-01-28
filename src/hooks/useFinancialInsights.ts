import { useMemo } from 'react'
import type {
  Transaction,
  FinancialInsights,
  SpendingPattern,
  RecurringTransaction,
  CashFlowPoint,
} from '@/types'

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/**
 * Calculate advanced financial insights from transactions
 */
export function useFinancialInsights(
  transactions: Transaction[],
  previousPeriodTransactions?: Transaction[]
): FinancialInsights | null {
  return useMemo(() => {
    if (transactions.length === 0) return null

    // Calculate current period stats
    let income = 0
    let expenses = 0
    let largestExpense: Transaction | null = null
    let largestIncome: Transaction | null = null

    for (const t of transactions) {
      if (t.amount > 0) {
        income += t.amount
        if (!largestIncome || t.amount > largestIncome.amount) {
          largestIncome = t
        }
      } else {
        expenses += Math.abs(t.amount)
        if (!largestExpense || Math.abs(t.amount) > Math.abs(largestExpense.amount)) {
          largestExpense = t
        }
      }
    }

    // Calculate days in period
    const dates = transactions.map(t => t.date).sort()
    const startDate = new Date(dates[0])
    const endDate = new Date(dates[dates.length - 1])
    const daysInPeriod = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    // Savings rate
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0

    // Average daily
    const avgDailyExpense = expenses / daysInPeriod
    const avgDailyIncome = income / daysInPeriod

    // Previous period comparison
    let previousPeriodComparison = null
    if (previousPeriodTransactions && previousPeriodTransactions.length > 0) {
      let prevIncome = 0
      let prevExpenses = 0

      for (const t of previousPeriodTransactions) {
        if (t.amount > 0) {
          prevIncome += t.amount
        } else {
          prevExpenses += Math.abs(t.amount)
        }
      }

      const prevBalance = prevIncome - prevExpenses
      const currentBalance = income - expenses

      previousPeriodComparison = {
        expenseChange: prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0,
        incomeChange: prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0,
        balanceChange: prevBalance !== 0 ? ((currentBalance - prevBalance) / Math.abs(prevBalance)) * 100 : 0,
      }
    }

    return {
      savingsRate,
      avgDailyExpense,
      avgDailyIncome,
      daysInPeriod,
      largestExpense,
      largestIncome,
      previousPeriodComparison,
    }
  }, [transactions, previousPeriodTransactions])
}

/**
 * Analyze spending patterns by day of week
 */
export function useSpendingPatterns(transactions: Transaction[]): SpendingPattern[] {
  return useMemo(() => {
    const patterns: Map<number, { total: number; count: number }> = new Map()

    // Initialize all days
    for (let i = 0; i < 7; i++) {
      patterns.set(i, { total: 0, count: 0 })
    }

    // Aggregate expenses by day of week
    for (const t of transactions) {
      if (t.amount >= 0) continue // Only expenses

      const date = new Date(t.date)
      const dayOfWeek = date.getDay()
      const existing = patterns.get(dayOfWeek)!
      existing.total += Math.abs(t.amount)
      existing.count += 1
    }

    return Array.from(patterns.entries()).map(([dayOfWeek, data]) => ({
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      totalExpenses: data.total,
      transactionCount: data.count,
      avgExpense: data.count > 0 ? data.total / data.count : 0,
    }))
  }, [transactions])
}

/**
 * Identify recurring transactions (same description pattern)
 */
export function useRecurringTransactions(transactions: Transaction[]): RecurringTransaction[] {
  return useMemo(() => {
    const patternMap = new Map<string, Transaction[]>()

    // Group transactions by normalized description
    for (const t of transactions) {
      const pattern = normalizeDescription(t.description)
      if (!pattern) continue

      const existing = patternMap.get(pattern) || []
      existing.push(t)
      patternMap.set(pattern, existing)
    }

    // Filter to only recurring (2+ occurrences)
    const recurring: RecurringTransaction[] = []

    for (const [pattern, txs] of patternMap) {
      if (txs.length < 2) continue

      const totalAmount = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0)
      const isExpense = txs[0].amount < 0

      recurring.push({
        description: txs[0].description,
        pattern,
        occurrences: txs.length,
        totalAmount,
        avgAmount: totalAmount / txs.length,
        category: txs[0].category,
        isExpense,
        transactions: txs,
      })
    }

    // Sort by total amount (descending)
    return recurring.sort((a, b) => b.totalAmount - a.totalAmount)
  }, [transactions])
}

/**
 * Calculate cash flow over time with cumulative balance
 */
export function useCashFlow(transactions: Transaction[], initialBalance = 0): CashFlowPoint[] {
  return useMemo(() => {
    if (transactions.length === 0) return []

    // Group by date
    const dailyData = new Map<string, { income: number; expenses: number }>()

    for (const t of transactions) {
      const existing = dailyData.get(t.date) || { income: 0, expenses: 0 }
      if (t.amount > 0) {
        existing.income += t.amount
      } else {
        existing.expenses += Math.abs(t.amount)
      }
      dailyData.set(t.date, existing)
    }

    // Sort by date and calculate cumulative
    const sortedDates = Array.from(dailyData.keys()).sort()
    let cumulative = initialBalance
    const result: CashFlowPoint[] = []

    for (const date of sortedDates) {
      const data = dailyData.get(date)!
      const netFlow = data.income - data.expenses
      cumulative += netFlow

      result.push({
        date,
        dateLabel: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        income: data.income,
        expenses: data.expenses,
        netFlow,
        cumulativeBalance: cumulative,
      })
    }

    return result
  }, [transactions, initialBalance])
}

/**
 * Find unusual transactions (significantly larger than average)
 */
export function useUnusualTransactions(
  transactions: Transaction[],
  threshold = 2 // Standard deviations
): Transaction[] {
  return useMemo(() => {
    const expenses = transactions.filter(t => t.amount < 0)
    if (expenses.length < 5) return [] // Need enough data

    // Calculate mean and std dev
    const amounts = expenses.map(t => Math.abs(t.amount))
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
    const stdDev = Math.sqrt(variance)

    // Find transactions above threshold
    const unusual = expenses.filter(t => Math.abs(t.amount) > mean + threshold * stdDev)

    return unusual.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [transactions, threshold])
}

/**
 * Normalize description for pattern matching
 */
function normalizeDescription(description: string): string {
  return description
    .toUpperCase()
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // Remove dates
    .replace(/\d{10,}/g, '') // Remove long numbers
    .replace(/\*{2,}/g, '') // Remove asterisks
    .replace(/CB\s*\*\d+/gi, 'CB') // Normalize card numbers
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30) // Limit length for comparison
}
