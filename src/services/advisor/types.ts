// Types pour le système de conseils financiers

export type InsightType = 'alert' | 'optimization' | 'projection' | 'success'
export type InsightPriority = 'high' | 'medium' | 'low'
export type InsightCategory = 'spending' | 'savings' | 'budget' | 'trends' | 'patrimoine'

export interface Insight {
  id: string
  type: InsightType
  priority: InsightPriority
  category: InsightCategory
  title: string
  description: string
  impact?: string // Ex: "Économise 240€/an"
  action?: string // Ex: "Réduire les restos de 20%"
  data?: Record<string, unknown> // Données associées pour le détail
  createdAt: string
}

export interface HealthScore {
  overall: number // 0-100
  breakdown: {
    savingsRate: number // Score basé sur le taux d'épargne
    budgetAdherence: number // Respect du budget 50/30/20
    consistency: number // Régularité des revenus/dépenses
    diversification: number // Diversification du patrimoine
    trends: number // Tendances positives/négatives
  }
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
}

export interface AnalysisContext {
  // Transactions
  currentMonthTransactions: Transaction[]
  previousMonthTransactions: Transaction[]
  allTransactions: Transaction[]

  // Stats mensuelles
  currentMonthStats: MonthlyStats | null
  previousMonthStats: MonthlyStats | null

  // Patrimoine
  assetAccounts: AssetAccount[]
  totalAssets: number

  // Config
  monthlyBudgetConfig: MonthlyBudgetConfig | null
  categoryBudgets: CategoryBudget[]

  // Méta
  currentMonth: string // YYYY-MM
  previousMonth: string // YYYY-MM
}

// Re-export des types nécessaires
import type {
  Transaction,
  MonthlyStats,
  AssetAccount,
  MonthlyBudgetConfig,
  CategoryBudget
} from '@/types'
