// Règles d'analyse des dépenses

import type { Insight, AnalysisContext } from '../types'
import { formatMoney } from '@utils/formatters'

export function analyzeSpending(context: AnalysisContext): Insight[] {
  const insights: Insight[] = []
  const { currentMonthStats, previousMonthStats, currentMonthTransactions } = context

  if (!currentMonthStats) return insights

  // 1. Comparaison avec le mois précédent
  if (previousMonthStats && previousMonthStats.expenses > 0) {
    const expenseChange = ((currentMonthStats.expenses - previousMonthStats.expenses) / previousMonthStats.expenses) * 100

    if (expenseChange > 20) {
      insights.push({
        id: 'spending-increase',
        type: 'alert',
        priority: 'high',
        category: 'spending',
        title: 'Dépenses en hausse',
        description: `Tes dépenses ont augmenté de ${expenseChange.toFixed(0)}% par rapport au mois dernier.`,
        impact: `+${formatMoney(currentMonthStats.expenses - previousMonthStats.expenses)} ce mois`,
        action: 'Identifie les catégories responsables de cette hausse',
        data: { change: expenseChange, current: currentMonthStats.expenses, previous: previousMonthStats.expenses },
        createdAt: new Date().toISOString(),
      })
    } else if (expenseChange < -15) {
      insights.push({
        id: 'spending-decrease',
        type: 'success',
        priority: 'medium',
        category: 'spending',
        title: 'Dépenses maîtrisées',
        description: `Bravo ! Tes dépenses ont baissé de ${Math.abs(expenseChange).toFixed(0)}% ce mois.`,
        impact: `${formatMoney(previousMonthStats.expenses - currentMonthStats.expenses)} économisés`,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 2. Analyse par catégorie - Top dépenses
  if (currentMonthStats.byCategory.length > 0) {
    const topCategory = currentMonthStats.byCategory[0]

    if (topCategory.percentage > 40) {
      insights.push({
        id: 'category-concentration',
        type: 'alert',
        priority: 'medium',
        category: 'spending',
        title: `${topCategory.name} domine tes dépenses`,
        description: `Cette catégorie représente ${topCategory.percentage.toFixed(0)}% de tes dépenses totales.`,
        impact: formatMoney(topCategory.amount),
        action: 'Vérifie si c\'est normal ou si tu peux optimiser',
        data: { categoryId: topCategory.categoryId, percentage: topCategory.percentage },
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 3. Détection des petites dépenses fréquentes
  const smallExpenses = currentMonthTransactions.filter(t => t.amount < 0 && Math.abs(t.amount) < 20)
  const smallExpensesTotal = smallExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  if (smallExpenses.length > 20 && smallExpensesTotal > 200) {
    insights.push({
      id: 'small-expenses',
      type: 'optimization',
      priority: 'low',
      category: 'spending',
      title: 'Attention aux petites dépenses',
      description: `Tu as ${smallExpenses.length} petites dépenses (<20€) ce mois.`,
      impact: `Total: ${formatMoney(smallExpensesTotal)}`,
      action: 'Ces petits achats s\'accumulent vite !',
      data: { count: smallExpenses.length, total: smallExpensesTotal },
      createdAt: new Date().toISOString(),
    })
  }

  // 4. Dépenses le week-end vs semaine
  const weekendExpenses = currentMonthTransactions.filter(t => {
    if (t.amount >= 0) return false
    const day = new Date(t.date).getDay()
    return day === 0 || day === 6
  })
  const weekdayExpenses = currentMonthTransactions.filter(t => {
    if (t.amount >= 0) return false
    const day = new Date(t.date).getDay()
    return day >= 1 && day <= 5
  })

  const weekendTotal = weekendExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const weekdayTotal = weekdayExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Le week-end = 2 jours, semaine = 5 jours
  // Ratio normal serait ~40% (2/5)
  const weekendRatio = weekendTotal / (weekendTotal + weekdayTotal) * 100

  if (weekendRatio > 50 && weekendTotal > 100) {
    insights.push({
      id: 'weekend-spending',
      type: 'optimization',
      priority: 'low',
      category: 'spending',
      title: 'Week-ends coûteux',
      description: `${weekendRatio.toFixed(0)}% de tes dépenses sont le week-end (2 jours sur 7).`,
      impact: `${formatMoney(weekendTotal)} les week-ends`,
      action: 'Planifie tes sorties pour mieux contrôler',
      data: { weekendTotal, weekdayTotal, ratio: weekendRatio },
      createdAt: new Date().toISOString(),
    })
  }

  return insights
}
