// Service principal du conseiller financier

import type { Insight, HealthScore, AnalysisContext } from './types'
import { analyzeSpending } from './rules/spending'
import { analyzeSavings } from './rules/savings'
import { analyzeTrends } from './rules/trends'
import { analyzeAnomalies } from './rules/anomalies'

export type { Insight, HealthScore, AnalysisContext } from './types'

/**
 * Génère tous les conseils basés sur le contexte financier
 */
export function generateInsights(context: AnalysisContext): Insight[] {
  const allInsights: Insight[] = []

  // Exécuter toutes les règles d'analyse
  allInsights.push(...analyzeSpending(context))
  allInsights.push(...analyzeSavings(context))
  allInsights.push(...analyzeTrends(context))
  allInsights.push(...analyzeAnomalies(context))

  // Trier par priorité et type
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const typeOrder = { alert: 0, optimization: 1, projection: 2, success: 3 }

  allInsights.sort((a, b) => {
    // D'abord par priorité
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff

    // Puis par type
    return typeOrder[a.type] - typeOrder[b.type]
  })

  // Limiter à 10 insights pour ne pas surcharger
  return allInsights.slice(0, 10)
}

/**
 * Calcule le score de santé financière global
 */
export function calculateHealthScore(context: AnalysisContext): HealthScore {
  const { currentMonthStats, assetAccounts, totalAssets, allTransactions } = context

  let savingsRateScore = 50
  let budgetAdherenceScore = 50
  let consistencyScore = 50
  let diversificationScore = 50
  let trendsScore = 50

  // 1. Score taux d'épargne (0-100)
  if (currentMonthStats && currentMonthStats.income > 0) {
    const savingsRate = (currentMonthStats.balance / currentMonthStats.income) * 100

    if (savingsRate >= 30) savingsRateScore = 100
    else if (savingsRate >= 20) savingsRateScore = 85
    else if (savingsRate >= 10) savingsRateScore = 65
    else if (savingsRate >= 0) savingsRateScore = 40
    else savingsRateScore = 20
  }

  // 2. Score respect du budget 50/30/20
  if (currentMonthStats && currentMonthStats.income > 0) {
    const expenseRatio = currentMonthStats.expenses / currentMonthStats.income

    if (expenseRatio <= 0.7) budgetAdherenceScore = 100
    else if (expenseRatio <= 0.8) budgetAdherenceScore = 80
    else if (expenseRatio <= 0.9) budgetAdherenceScore = 60
    else if (expenseRatio <= 1.0) budgetAdherenceScore = 40
    else budgetAdherenceScore = 20
  }

  // 3. Score de consistance (régularité des revenus)
  if (allTransactions.length > 30) {
    const byMonth = new Map<string, number>()
    for (const t of allTransactions) {
      if (t.amount <= 0) continue
      const month = t.date.substring(0, 7)
      byMonth.set(month, (byMonth.get(month) || 0) + t.amount)
    }

    const incomes = Array.from(byMonth.values())
    if (incomes.length >= 3) {
      const avg = incomes.reduce((a, b) => a + b, 0) / incomes.length
      const variance = incomes.reduce((sum, inc) => sum + Math.pow(inc - avg, 2), 0) / incomes.length
      const cv = avg > 0 ? (Math.sqrt(variance) / avg) * 100 : 100

      if (cv < 10) consistencyScore = 100
      else if (cv < 20) consistencyScore = 80
      else if (cv < 30) consistencyScore = 60
      else if (cv < 50) consistencyScore = 40
      else consistencyScore = 20
    }
  }

  // 4. Score de diversification
  if (assetAccounts.length > 0) {
    const activeAccounts = assetAccounts.filter(a => a.isActive)
    const types = new Set(activeAccounts.map(a => a.type))

    if (types.size >= 4) diversificationScore = 100
    else if (types.size >= 3) diversificationScore = 80
    else if (types.size >= 2) diversificationScore = 60
    else diversificationScore = 40
  } else {
    diversificationScore = 30
  }

  // 5. Score des tendances
  if (allTransactions.length > 60) {
    const byMonth = new Map<string, { income: number; expenses: number }>()
    for (const t of allTransactions) {
      const month = t.date.substring(0, 7)
      const existing = byMonth.get(month) || { income: 0, expenses: 0 }
      if (t.amount > 0) existing.income += t.amount
      else existing.expenses += Math.abs(t.amount)
      byMonth.set(month, existing)
    }

    const months = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-3)

    if (months.length >= 3) {
      // Calculer la tendance des balances
      const balances = months.map(([_, data]) => data.income - data.expenses)
      const improving = balances[2] > balances[0]
      const allPositive = balances.every(b => b > 0)

      if (allPositive && improving) trendsScore = 100
      else if (allPositive) trendsScore = 80
      else if (improving) trendsScore = 60
      else if (balances[2] > 0) trendsScore = 50
      else trendsScore = 30
    }
  }

  // Calcul du score global (moyenne pondérée)
  const weights = {
    savingsRate: 0.30,
    budgetAdherence: 0.25,
    consistency: 0.15,
    diversification: 0.15,
    trends: 0.15,
  }

  const overall = Math.round(
    savingsRateScore * weights.savingsRate +
    budgetAdherenceScore * weights.budgetAdherence +
    consistencyScore * weights.consistency +
    diversificationScore * weights.diversification +
    trendsScore * weights.trends
  )

  // Déterminer le grade
  let grade: HealthScore['grade']
  if (overall >= 85) grade = 'A'
  else if (overall >= 70) grade = 'B'
  else if (overall >= 55) grade = 'C'
  else if (overall >= 40) grade = 'D'
  else grade = 'F'

  // Générer le résumé
  let summary: string
  if (grade === 'A') {
    summary = 'Excellente santé financière ! Continue sur cette lancée.'
  } else if (grade === 'B') {
    summary = 'Bonne gestion financière avec quelques points à améliorer.'
  } else if (grade === 'C') {
    summary = 'Situation correcte mais des optimisations sont possibles.'
  } else if (grade === 'D') {
    summary = 'Attention requise sur plusieurs aspects de tes finances.'
  } else {
    summary = 'Situation critique nécessitant une action immédiate.'
  }

  return {
    overall,
    breakdown: {
      savingsRate: savingsRateScore,
      budgetAdherence: budgetAdherenceScore,
      consistency: consistencyScore,
      diversification: diversificationScore,
      trends: trendsScore,
    },
    grade,
    summary,
  }
}

/**
 * Génère des projections financières
 */
export function generateProjections(context: AnalysisContext) {
  const { currentMonthStats, totalAssets } = context

  if (!currentMonthStats) return null

  const monthlySavings = currentMonthStats.balance
  const projections = []

  // Projection à 1 an
  if (monthlySavings > 0) {
    const oneYear = totalAssets + monthlySavings * 12
    projections.push({
      period: '1 an',
      amount: oneYear,
      savings: monthlySavings * 12,
    })

    // Projection à 5 ans (avec intérêts composés à 5%)
    const rate = 0.05
    let fiveYear = totalAssets
    for (let year = 0; year < 5; year++) {
      fiveYear = (fiveYear + monthlySavings * 12) * (1 + rate)
    }
    projections.push({
      period: '5 ans',
      amount: fiveYear,
      savings: monthlySavings * 60,
      withInterest: true,
    })

    // Temps pour atteindre des objectifs
    const milestones = [50000, 100000, 250000, 500000, 1000000]
    const nextMilestone = milestones.find(m => m > totalAssets)

    if (nextMilestone) {
      const monthsNeeded = Math.ceil((nextMilestone - totalAssets) / monthlySavings)
      projections.push({
        milestone: nextMilestone,
        monthsNeeded,
        yearsNeeded: (monthsNeeded / 12).toFixed(1),
      })
    }
  }

  return projections
}
