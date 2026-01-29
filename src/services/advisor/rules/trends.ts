// Règles d'analyse des tendances

import type { Insight, AnalysisContext } from '../types'
import { formatMoney } from '@utils/formatters'
import type { Transaction } from '@/types'

export function analyzeTrends(context: AnalysisContext): Insight[] {
  const insights: Insight[] = []
  const { allTransactions, currentMonth } = context

  if (allTransactions.length < 30) return insights // Pas assez de données

  // Grouper par mois
  const byMonth = new Map<string, { income: number; expenses: number }>()

  for (const t of allTransactions) {
    const month = t.date.substring(0, 7)
    const existing = byMonth.get(month) || { income: 0, expenses: 0 }

    if (t.amount > 0) {
      existing.income += t.amount
    } else {
      existing.expenses += Math.abs(t.amount)
    }

    byMonth.set(month, existing)
  }

  const months = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6) // 6 derniers mois

  if (months.length < 3) return insights

  // 1. Tendance des dépenses sur 3 mois
  const lastThreeMonths = months.slice(-3)
  let increasingExpenses = true
  let decreasingExpenses = true

  for (let i = 1; i < lastThreeMonths.length; i++) {
    if (lastThreeMonths[i][1].expenses <= lastThreeMonths[i-1][1].expenses) {
      increasingExpenses = false
    }
    if (lastThreeMonths[i][1].expenses >= lastThreeMonths[i-1][1].expenses) {
      decreasingExpenses = false
    }
  }

  if (increasingExpenses) {
    const firstMonth = lastThreeMonths[0][1].expenses
    const lastMonth = lastThreeMonths[lastThreeMonths.length - 1][1].expenses
    const increase = ((lastMonth - firstMonth) / firstMonth) * 100

    insights.push({
      id: 'trend-expenses-up',
      type: 'alert',
      priority: 'high',
      category: 'trends',
      title: 'Dépenses en hausse continue',
      description: `Tes dépenses augmentent depuis 3 mois consécutifs (+${increase.toFixed(0)}%).`,
      impact: `De ${formatMoney(firstMonth)} à ${formatMoney(lastMonth)}/mois`,
      action: 'Identifie la cause de cette tendance',
      createdAt: new Date().toISOString(),
    })
  } else if (decreasingExpenses) {
    insights.push({
      id: 'trend-expenses-down',
      type: 'success',
      priority: 'medium',
      category: 'trends',
      title: 'Bonne dynamique',
      description: 'Tes dépenses baissent depuis 3 mois. Continue ainsi !',
      createdAt: new Date().toISOString(),
    })
  }

  // 2. Analyse des catégories récurrentes
  const categoryByMonth = new Map<string, Map<string, number>>()

  for (const t of allTransactions) {
    if (t.amount >= 0) continue
    const month = t.date.substring(0, 7)

    if (!categoryByMonth.has(month)) {
      categoryByMonth.set(month, new Map())
    }

    const monthMap = categoryByMonth.get(month)!
    const current = monthMap.get(t.category) || 0
    monthMap.set(t.category, current + Math.abs(t.amount))
  }

  // Trouver les catégories avec tendance haussière
  const recentMonths = Array.from(categoryByMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-4)

  if (recentMonths.length >= 4) {
    const allCategories = new Set<string>()
    recentMonths.forEach(([_, cats]) => cats.forEach((_, cat) => allCategories.add(cat)))

    for (const category of allCategories) {
      const values = recentMonths.map(([_, cats]) => cats.get(category) || 0)

      // Vérifier si tendance haussière sur 4 mois
      let allIncreasing = true
      for (let i = 1; i < values.length; i++) {
        if (values[i] <= values[i-1] * 1.05) { // Au moins 5% d'augmentation
          allIncreasing = false
          break
        }
      }

      if (allIncreasing && values[0] > 50 && values[values.length - 1] > values[0] * 1.5) {
        const increase = ((values[values.length - 1] - values[0]) / values[0]) * 100

        insights.push({
          id: `trend-category-${category}`,
          type: 'alert',
          priority: 'medium',
          category: 'trends',
          title: `Catégorie en forte hausse`,
          description: `"${category}" augmente depuis 4 mois (+${increase.toFixed(0)}%).`,
          impact: `De ${formatMoney(values[0])} à ${formatMoney(values[values.length - 1])}/mois`,
          data: { categoryId: category, values },
          createdAt: new Date().toISOString(),
        })
      }
    }
  }

  // 3. Régularité des revenus
  const incomes = months.map(([_, data]) => data.income)
  const avgIncome = incomes.reduce((a, b) => a + b, 0) / incomes.length
  const incomeVariance = incomes.reduce((sum, inc) => sum + Math.pow(inc - avgIncome, 2), 0) / incomes.length
  const incomeStdDev = Math.sqrt(incomeVariance)
  const incomeCV = avgIncome > 0 ? (incomeStdDev / avgIncome) * 100 : 0

  if (incomeCV < 10 && avgIncome > 1000) {
    insights.push({
      id: 'income-stable',
      type: 'success',
      priority: 'low',
      category: 'trends',
      title: 'Revenus stables',
      description: `Tes revenus sont très réguliers (variation de ${incomeCV.toFixed(0)}%).`,
      impact: `Moyenne: ${formatMoney(avgIncome)}/mois`,
      createdAt: new Date().toISOString(),
    })
  } else if (incomeCV > 30) {
    insights.push({
      id: 'income-variable',
      type: 'optimization',
      priority: 'medium',
      category: 'trends',
      title: 'Revenus variables',
      description: `Tes revenus varient beaucoup (${incomeCV.toFixed(0)}% de variation).`,
      action: 'Constitue une épargne de précaution de 3-6 mois de dépenses',
      createdAt: new Date().toISOString(),
    })
  }

  // 4. Mois consécutifs positifs (balance > 0)
  if (months.length >= 2) {
    const balances = months.map(([_, data]) => data.income - data.expenses)
    const consecutivePositive = balances.filter(b => b > 0).length

    if (consecutivePositive === months.length && months.length >= 3) {
      insights.push({
        id: 'consecutive-positive',
        type: 'success',
        priority: 'medium',
        category: 'trends',
        title: `${consecutivePositive} mois dans le vert`,
        description: `Tu as une balance positive depuis ${consecutivePositive} mois consécutifs.`,
        impact: 'Excellente discipline financière !',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 5. Projection basée sur la tendance
  if (months.length >= 3) {
    const avgMonthlyBalance = months.reduce((sum, [_, data]) => sum + (data.income - data.expenses), 0) / months.length

    if (avgMonthlyBalance > 0) {
      const yearlyProjection = avgMonthlyBalance * 12

      insights.push({
        id: 'yearly-projection',
        type: 'projection',
        priority: 'low',
        category: 'trends',
        title: 'Projection annuelle',
        description: `Basé sur les ${months.length} derniers mois, tu pourrais épargner ~${formatMoney(yearlyProjection)}/an.`,
        impact: `Moyenne mensuelle: ${formatMoney(avgMonthlyBalance)}`,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return insights
}
