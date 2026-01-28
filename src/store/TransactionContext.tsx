import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { transactionService, categoryService, db } from '@services/db'
import { createAutoBackup, checkAndRestoreIfNeeded } from '@services/storage/autoBackup'
import { learnFromCorrection } from '@services/categorizer/learningService'
import type { Transaction, Category, TransactionFilters, MonthlyStats, CategoryStat, Period } from '@/types'
import { getCurrentMonth } from '@utils/formatters'
import { DEFAULT_FILTERS, COLORS } from '@utils/constants'

// Helper to get month range
function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split('-')
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
  return {
    start: `${month}-01`,
    end: `${month}-${lastDay}`,
  }
}

// Get initial period from current month
function getInitialPeriod(): Period {
  const month = getCurrentMonth()
  const range = getMonthRange(month)
  return {
    type: 'month',
    label: new Date(month + '-01').toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    }),
    startDate: range.start,
    endDate: range.end,
  }
}

// State type
interface TransactionState {
  selectedMonth: string // Keep for backwards compatibility
  selectedPeriod: Period
  filters: TransactionFilters
  loading: boolean
  error: string | null
}

// Action types
type Action =
  | { type: 'SET_MONTH'; payload: string }
  | { type: 'SET_PERIOD'; payload: Period }
  | { type: 'SET_FILTERS'; payload: Partial<TransactionFilters> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

// Reducer
function transactionReducer(state: TransactionState, action: Action): TransactionState {
  switch (action.type) {
    case 'SET_MONTH': {
      const range = getMonthRange(action.payload)
      return {
        ...state,
        selectedMonth: action.payload,
        selectedPeriod: {
          type: 'month',
          label: new Date(action.payload + '-01').toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
          }),
          startDate: range.start,
          endDate: range.end,
        },
      }
    }
    case 'SET_PERIOD':
      return {
        ...state,
        selectedPeriod: action.payload,
        // Update selectedMonth to match the first month in the period
        selectedMonth: action.payload.startDate.substring(0, 7),
      }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    case 'CLEAR_FILTERS':
      return { ...state, filters: DEFAULT_FILTERS as TransactionFilters }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    default:
      return state
  }
}

// Initial state
const initialState: TransactionState = {
  selectedMonth: getCurrentMonth(),
  selectedPeriod: getInitialPeriod(),
  filters: DEFAULT_FILTERS as TransactionFilters,
  loading: false,
  error: null,
}

// Context type
interface TransactionContextType extends TransactionState {
  transactions: Transaction[]
  categories: Category[]
  months: string[]
  stats: MonthlyStats | null
  setMonth: (month: string) => void
  setPeriod: (period: Period) => void
  setFilters: (filters: Partial<TransactionFilters>) => void
  clearFilters: () => void
  addTransactions: (transactions: Transaction[]) => Promise<void>
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  bulkUpdateCategory: (transactionIds: string[], categoryId: string) => Promise<number>
}

// Create context
const TransactionContext = createContext<TransactionContextType | null>(null)

// Provider component
export function TransactionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(transactionReducer, initialState)

  // Get all transactions from IndexedDB
  const allTransactions = useLiveQuery(() => transactionService.getAll()) ?? []

  // Filter transactions by period
  // Use budgetMonth if set, otherwise use the transaction's natural date
  const transactions = useMemo(() => {
    const { startDate, endDate } = state.selectedPeriod
    const periodMonth = startDate.substring(0, 7) // YYYY-MM

    return allTransactions.filter((t) => {
      // If budgetMonth is set, check if it matches the selected period's month
      if (t.budgetMonth) {
        return t.budgetMonth === periodMonth
      }
      // Otherwise, filter by actual transaction date
      return t.date >= startDate && t.date <= endDate
    })
  }, [allTransactions, state.selectedPeriod])

  const categories = useLiveQuery(() => categoryService.getAll()) ?? []

  const months = useLiveQuery(() => transactionService.getMonths()) ?? []

  // Calculate stats
  const stats = useMemo((): MonthlyStats | null => {
    if (!transactions.length || !categories.length) return null

    let income = 0
    let expenses = 0
    // Track expenses and income separately per category based on AMOUNT SIGN
    const expensesByCategory = new Map<string, { amount: number; count: number }>()
    const incomeByCategory = new Map<string, { amount: number; count: number }>()

    // Get excluded categories
    const excludedCategories = new Set(
      categories.filter((c) => c.isExcludedFromStats).map((c) => c.id)
    )

    for (const t of transactions) {
      if (excludedCategories.has(t.category)) continue

      // Use the AMOUNT SIGN to determine if it's income or expense
      if (t.amount > 0) {
        // POSITIVE = INCOME
        income += t.amount
        const existing = incomeByCategory.get(t.category) || { amount: 0, count: 0 }
        existing.amount += t.amount
        existing.count += 1
        incomeByCategory.set(t.category, existing)
      } else {
        // NEGATIVE = EXPENSE
        expenses += Math.abs(t.amount)
        const existing = expensesByCategory.get(t.category) || { amount: 0, count: 0 }
        existing.amount += Math.abs(t.amount)
        existing.count += 1
        expensesByCategory.set(t.category, existing)
      }
    }

    // Build category stats for expenses (based on actual negative transactions)
    const byCategory: CategoryStat[] = Array.from(expensesByCategory.entries())
      .map(([categoryId, data]) => {
        const category = categories.find((c) => c.id === categoryId)
        return {
          categoryId,
          name: category?.name || 'Inconnu',
          color: category?.color || COLORS.other || '#94a3b8',
          amount: data.amount,
          percentage: expenses > 0 ? (data.amount / expenses) * 100 : 0,
          transactionCount: data.count,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    // Build category stats for income (based on actual positive transactions)
    const byIncome: CategoryStat[] = Array.from(incomeByCategory.entries())
      .map(([categoryId, data]) => {
        const category = categories.find((c) => c.id === categoryId)
        return {
          categoryId,
          name: category?.name || 'Inconnu',
          color: category?.color || COLORS.other || '#94a3b8',
          amount: data.amount,
          percentage: income > 0 ? (data.amount / income) * 100 : 0,
          transactionCount: data.count,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    return {
      month: state.selectedPeriod.label,
      income,
      expenses,
      balance: income - expenses,
      byCategory,
      byIncome,
      transactionCount: transactions.length,
    }
  }, [transactions, categories, state.selectedPeriod])

  // Actions
  const setMonth = useCallback((month: string) => {
    dispatch({ type: 'SET_MONTH', payload: month })
  }, [])

  const setPeriod = useCallback((period: Period) => {
    dispatch({ type: 'SET_PERIOD', payload: period })
  }, [])

  const setFilters = useCallback((filters: Partial<TransactionFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }, [])

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' })
  }, [])

  const addTransactions = useCallback(async (newTransactions: Transaction[]) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      console.log(`💾 Saving ${newTransactions.length} transactions...`)
      await transactionService.add(newTransactions)
      const count = await transactionService.getAll().then(t => t.length)
      console.log(`✅ Saved! Total transactions in DB: ${count}`)

      // Auto-backup after import
      console.log('💾 Creating auto-backup...')
      await createAutoBackup()
    } catch (err) {
      console.error('❌ Error saving transactions:', err)
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    try {
      // If category is being changed, learn from the correction
      if (updates.category) {
        const transaction = await db.transactions.get(id)
        if (transaction && transaction.category !== updates.category) {
          // Learn from this correction for future categorization
          await learnFromCorrection(transaction, updates.category)
          console.log(`📚 Learned: "${transaction.description.substring(0, 30)}..." → ${updates.category}`)
        }
      }
      await transactionService.update(id, updates)
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message })
    }
  }, [])

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      await transactionService.delete(id)
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message })
    }
  }, [])

  const bulkUpdateCategory = useCallback(async (transactionIds: string[], categoryId: string) => {
    let updated = 0
    try {
      for (const id of transactionIds) {
        const transaction = await db.transactions.get(id)
        if (transaction && transaction.category !== categoryId) {
          // Learn from this correction for future categorization
          await learnFromCorrection(transaction, categoryId)
          await transactionService.update(id, {
            category: categoryId,
            isManuallyEdited: true,
          })
          updated++
        }
      }
      console.log(`📚 Bulk update: ${updated} transactions → ${categoryId}`)
      return updated
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message })
      return updated
    }
  }, [])

  // Check and restore from backup on startup if IndexedDB is empty
  useEffect(() => {
    checkAndRestoreIfNeeded().then((restored) => {
      if (restored) {
        console.log('🔄 Data restored from backup!')
        // Force a refresh by reloading
        window.location.reload()
      }
    })
  }, [])

  // Set initial period if we have data
  useEffect(() => {
    if (months.length > 0 && state.selectedPeriod.type === 'month') {
      const currentMonth = state.selectedPeriod.startDate.substring(0, 7)
      if (!months.includes(currentMonth)) {
        // Set to most recent month
        const range = getMonthRange(months[0])
        dispatch({
          type: 'SET_PERIOD',
          payload: {
            type: 'month',
            label: new Date(months[0] + '-01').toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric',
            }),
            startDate: range.start,
            endDate: range.end,
          },
        })
      }
    }
  }, [months, state.selectedPeriod])

  const value: TransactionContextType = {
    ...state,
    transactions,
    categories,
    months,
    stats,
    setMonth,
    setPeriod,
    setFilters,
    clearFilters,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    bulkUpdateCategory,
  }

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  )
}

// Hook to use the context
export function useTransactions() {
  const context = useContext(TransactionContext)
  if (!context) {
    throw new Error('useTransactions must be used within a TransactionProvider')
  }
  return context
}
