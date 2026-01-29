// Hook pour accéder au conseiller financier

import { useMemo, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  generateInsights,
  calculateHealthScore,
  generateProjections,
  type Insight,
  type HealthScore,
  type AnalysisContext,
} from '@services/advisor'
import { generateAIInsights, askAIAdvisor } from '@services/advisor/aiAdvisor'
import {
  db,
  assetAccountService,
  monthlyBudgetConfigService,
  categoryBudgetService,
  settingsService,
} from '@services/db'
import type { Transaction, MonthlyStats, CategoryStat } from '@/types'

interface UseFinancialAdvisorResult {
  insights: Insight[]
  healthScore: HealthScore | null
  projections: ReturnType<typeof generateProjections>
  isLoading: boolean
  // AI features
  aiEnabled: boolean
  aiLoading: boolean
  aiError: string | null
  aiInsights: Insight[]
  toggleAI: () => Promise<void>
  askQuestion: (question: string) => Promise<string>
  hasApiKey: boolean
}

export function useFinancialAdvisor(
  allTransactions: Transaction[],
  categories: { id: string; name: string; color: string; isIncome: boolean }[]
): UseFinancialAdvisorResult {
  // Charger les données nécessaires
  const assetAccounts = useLiveQuery(() => db.assetAccounts.filter(a => a.isActive).toArray(), []) ?? []
  const monthlyBudgetConfig = useLiveQuery(() => monthlyBudgetConfigService.getLatest(), [])
  const categoryBudgets = useLiveQuery(() => categoryBudgetService.getAll(), []) ?? []

  // Calculer le mois courant et précédent
  const { currentMonth, previousMonth } = useMemo(() => {
    const now = new Date()
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previous = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

    return { currentMonth: current, previousMonth: previous }
  }, [])

  // Filtrer les transactions par mois
  const { currentMonthTransactions, previousMonthTransactions } = useMemo(() => {
    return {
      currentMonthTransactions: allTransactions.filter(t => t.date.startsWith(currentMonth)),
      previousMonthTransactions: allTransactions.filter(t => t.date.startsWith(previousMonth)),
    }
  }, [allTransactions, currentMonth, previousMonth])

  // Calculer les stats mensuelles
  const calculateStats = (transactions: Transaction[]): MonthlyStats | null => {
    if (transactions.length === 0) return null

    let income = 0
    let expenses = 0
    const categoryAmounts = new Map<string, number>()
    const incomeCategoryAmounts = new Map<string, number>()

    for (const t of transactions) {
      if (t.amount > 0) {
        income += t.amount
        const current = incomeCategoryAmounts.get(t.category) || 0
        incomeCategoryAmounts.set(t.category, current + t.amount)
      } else {
        expenses += Math.abs(t.amount)
        const current = categoryAmounts.get(t.category) || 0
        categoryAmounts.set(t.category, current + Math.abs(t.amount))
      }
    }

    const byCategory: CategoryStat[] = Array.from(categoryAmounts.entries())
      .map(([categoryId, amount]) => {
        const cat = categories.find(c => c.id === categoryId)
        return {
          categoryId,
          name: cat?.name || categoryId,
          color: cat?.color || '#888',
          amount,
          percentage: expenses > 0 ? (amount / expenses) * 100 : 0,
          transactionCount: transactions.filter(t => t.category === categoryId && t.amount < 0).length,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const byIncome: CategoryStat[] = Array.from(incomeCategoryAmounts.entries())
      .map(([categoryId, amount]) => {
        const cat = categories.find(c => c.id === categoryId)
        return {
          categoryId,
          name: cat?.name || categoryId,
          color: cat?.color || '#888',
          amount,
          percentage: income > 0 ? (amount / income) * 100 : 0,
          transactionCount: transactions.filter(t => t.category === categoryId && t.amount > 0).length,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    return {
      month: currentMonth,
      income,
      expenses,
      balance: income - expenses,
      byCategory,
      byIncome,
      transactionCount: transactions.length,
    }
  }

  const currentMonthStats = useMemo(
    () => calculateStats(currentMonthTransactions),
    [currentMonthTransactions, categories]
  )

  const previousMonthStats = useMemo(
    () => calculateStats(previousMonthTransactions),
    [previousMonthTransactions, categories]
  )

  // Calculer le total des actifs
  const totalAssets = useMemo(
    () => assetAccounts.reduce((sum, a) => sum + a.currentBalance, 0),
    [assetAccounts]
  )

  // Construire le contexte d'analyse
  const context: AnalysisContext | null = useMemo(() => {
    if (allTransactions.length === 0) return null

    return {
      currentMonthTransactions,
      previousMonthTransactions,
      allTransactions,
      currentMonthStats,
      previousMonthStats,
      assetAccounts,
      totalAssets,
      monthlyBudgetConfig: monthlyBudgetConfig ?? null,
      categoryBudgets,
      currentMonth,
      previousMonth,
    }
  }, [
    currentMonthTransactions,
    previousMonthTransactions,
    allTransactions,
    currentMonthStats,
    previousMonthStats,
    assetAccounts,
    totalAssets,
    monthlyBudgetConfig,
    categoryBudgets,
    currentMonth,
    previousMonth,
  ])

  // Générer les insights
  const insights = useMemo(() => {
    if (!context) return []
    return generateInsights(context)
  }, [context])

  // Calculer le score de santé
  const healthScore = useMemo(() => {
    if (!context) return null
    return calculateHealthScore(context)
  }, [context])

  // Générer les projections
  const projections = useMemo(() => {
    if (!context) return null
    return generateProjections(context)
  }, [context])

  // AI state
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiInsights, setAiInsights] = useState<Insight[]>([])

  // Check if API key is configured
  const apiKey = useLiveQuery(() => settingsService.get('claudeApiKey'), [])
  const hasApiKey = typeof apiKey === 'string' && apiKey.length > 0

  // Toggle AI mode
  const toggleAI = useCallback(async () => {
    if (!hasApiKey) {
      setAiError('Configure ta clé API Claude dans les Paramètres')
      return
    }

    if (aiEnabled) {
      setAiEnabled(false)
      setAiInsights([])
      setAiError(null)
      return
    }

    if (!context) return

    setAiLoading(true)
    setAiError(null)

    try {
      const newInsights = await generateAIInsights(
        context,
        insights,
        healthScore,
        { apiKey: apiKey as string }
      )
      setAiInsights(newInsights)
      setAiEnabled(true)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Erreur IA')
    } finally {
      setAiLoading(false)
    }
  }, [hasApiKey, aiEnabled, context, insights, healthScore, apiKey])

  // Ask a question to AI
  const askQuestion = useCallback(async (question: string): Promise<string> => {
    if (!hasApiKey || !context) {
      throw new Error('API non configurée ou données insuffisantes')
    }

    return askAIAdvisor(question, context, { apiKey: apiKey as string })
  }, [hasApiKey, context, apiKey])

  return {
    insights,
    healthScore,
    projections,
    isLoading: allTransactions.length === 0,
    // AI features
    aiEnabled,
    aiLoading,
    aiError,
    aiInsights,
    toggleAI,
    askQuestion,
    hasApiKey,
  }
}
