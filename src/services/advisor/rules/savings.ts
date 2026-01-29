// Règles d'analyse de l'épargne et du budget

import type { Insight, AnalysisContext } from '../types'
import { formatMoney } from '@utils/formatters'

export function analyzeSavings(context: AnalysisContext): Insight[] {
  const insights: Insight[] = []
  const { currentMonthStats, monthlyBudgetConfig, totalAssets, assetAccounts } = context

  if (!currentMonthStats) return insights

  const { income, expenses, balance } = currentMonthStats
  const savingsRate = income > 0 ? (balance / income) * 100 : 0

  // 1. Analyse du taux d'épargne
  if (income > 0) {
    if (savingsRate >= 30) {
      insights.push({
        id: 'savings-excellent',
        type: 'success',
        priority: 'medium',
        category: 'savings',
        title: 'Taux d\'épargne excellent',
        description: `Tu épargnes ${savingsRate.toFixed(0)}% de tes revenus ce mois. Continue comme ça !`,
        impact: `${formatMoney(balance)} mis de côté`,
        createdAt: new Date().toISOString(),
      })
    } else if (savingsRate >= 20) {
      insights.push({
        id: 'savings-good',
        type: 'success',
        priority: 'low',
        category: 'savings',
        title: 'Bon taux d\'épargne',
        description: `Tu épargnes ${savingsRate.toFixed(0)}% de tes revenus, conforme à la règle 50/30/20.`,
        impact: `${formatMoney(balance)} mis de côté`,
        createdAt: new Date().toISOString(),
      })
    } else if (savingsRate >= 10) {
      insights.push({
        id: 'savings-low',
        type: 'optimization',
        priority: 'medium',
        category: 'savings',
        title: 'Épargne à améliorer',
        description: `Ton taux d'épargne est de ${savingsRate.toFixed(0)}%. L'objectif recommandé est 20%.`,
        impact: `Il te manque ${formatMoney(income * 0.2 - balance)}/mois pour atteindre 20%`,
        action: 'Identifie des dépenses à réduire',
        createdAt: new Date().toISOString(),
      })
    } else if (savingsRate > 0) {
      insights.push({
        id: 'savings-critical',
        type: 'alert',
        priority: 'high',
        category: 'savings',
        title: 'Épargne insuffisante',
        description: `Attention, tu n'épargnes que ${savingsRate.toFixed(0)}% de tes revenus.`,
        impact: `Objectif: ${formatMoney(income * 0.2)}/mois (20%)`,
        action: 'Revois ton budget pour dégager de l\'épargne',
        createdAt: new Date().toISOString(),
      })
    } else {
      insights.push({
        id: 'savings-negative',
        type: 'alert',
        priority: 'high',
        category: 'savings',
        title: 'Tu dépenses plus que tu gagnes',
        description: `Ce mois, tes dépenses dépassent tes revenus de ${formatMoney(Math.abs(balance))}.`,
        impact: 'Tu puises dans ton épargne ou tu t\'endettes',
        action: 'Réduis tes dépenses immédiatement',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 2. Analyse du budget 50/30/20
  if (monthlyBudgetConfig && income > 0) {
    const targetNeeds = income * 0.5
    const targetWants = income * 0.3
    const targetSavings = income * 0.2

    // Calculer les dépenses par groupe (simplifié)
    const actualExpenses = expenses
    const actualSavings = balance

    if (actualExpenses > targetNeeds + targetWants) {
      const excess = actualExpenses - (targetNeeds + targetWants)
      insights.push({
        id: 'budget-exceeded',
        type: 'alert',
        priority: 'medium',
        category: 'budget',
        title: 'Budget dépassé',
        description: `Tes dépenses dépassent le budget 50/30 (80% des revenus).`,
        impact: `${formatMoney(excess)} au-dessus du budget`,
        action: 'Rééquilibre besoins vs envies',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 3. Analyse du patrimoine
  if (assetAccounts.length > 0) {
    // Vérifier si un Livret A est plein (22 950€ max)
    const livretA = assetAccounts.find(a =>
      a.type === 'livret' &&
      a.name.toLowerCase().includes('livret a') &&
      a.currentBalance >= 22000
    )

    if (livretA) {
      insights.push({
        id: 'livret-a-full',
        type: 'optimization',
        priority: 'medium',
        category: 'patrimoine',
        title: 'Livret A bientôt plein',
        description: `Ton Livret A approche du plafond (22 950€). Solde actuel: ${formatMoney(livretA.currentBalance)}`,
        impact: 'L\'excédent ne rapporte plus d\'intérêts',
        action: 'Envisage une assurance-vie ou un PEA pour l\'excédent',
        createdAt: new Date().toISOString(),
      })
    }

    // Diversification
    const typeCount = new Set(assetAccounts.filter(a => a.isActive).map(a => a.type)).size

    if (totalAssets > 10000 && typeCount === 1) {
      insights.push({
        id: 'diversification-needed',
        type: 'optimization',
        priority: 'medium',
        category: 'patrimoine',
        title: 'Diversifie ton patrimoine',
        description: 'Tout ton patrimoine est sur un seul type de compte.',
        impact: 'Risque de concentration et rendement sous-optimal',
        action: 'Explore PEA, assurance-vie ou autres supports',
        createdAt: new Date().toISOString(),
      })
    } else if (totalAssets > 50000 && typeCount <= 2) {
      insights.push({
        id: 'diversification-low',
        type: 'optimization',
        priority: 'low',
        category: 'patrimoine',
        title: 'Pense à diversifier',
        description: `Avec ${formatMoney(totalAssets)}, tu pourrais mieux répartir tes actifs.`,
        action: 'Ajoute 1-2 types de placements différents',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 4. Progression vers objectifs - TOUJOURS afficher une projection
  if (totalAssets > 0) {
    const milestones = [10000, 25000, 50000, 100000, 250000, 500000, 1000000]
    const nextMilestone = milestones.find(m => m > totalAssets)
    const lastMilestone = [...milestones].reverse().find(m => m <= totalAssets)

    // Succès si on a dépassé un palier
    if (lastMilestone && lastMilestone >= 10000) {
      insights.push({
        id: 'milestone-reached',
        type: 'success',
        priority: 'low',
        category: 'patrimoine',
        title: `Palier de ${formatMoney(lastMilestone)} atteint`,
        description: `Ton patrimoine a dépassé ${formatMoney(lastMilestone)}. Bravo !`,
        impact: `Patrimoine actuel: ${formatMoney(totalAssets)}`,
        createdAt: new Date().toISOString(),
      })
    }

    // Projection vers le prochain palier
    if (nextMilestone) {
      const remaining = nextMilestone - totalAssets
      const progress = (totalAssets / nextMilestone) * 100

      // Calculer le temps estimé si on a des données d'épargne
      const monthlySavings = balance > 0 ? balance : 500 // Estimation par défaut
      const monthsNeeded = Math.ceil(remaining / monthlySavings)

      insights.push({
        id: 'milestone-projection',
        type: 'projection',
        priority: progress > 50 ? 'medium' : 'low',
        category: 'patrimoine',
        title: `Objectif: ${formatMoney(nextMilestone)}`,
        description: `Tu es à ${progress.toFixed(0)}% de ce palier (${formatMoney(remaining)} restants).`,
        impact: balance > 0
          ? `À ton rythme actuel: ~${monthsNeeded} mois (${(monthsNeeded / 12).toFixed(1)} ans)`
          : `Épargne ${formatMoney(remaining / 12)}/mois pour l'atteindre en 1 an`,
        createdAt: new Date().toISOString(),
      })
    }
  } else if (income > 0) {
    // Même sans patrimoine, donner une projection
    const potentialYearlySavings = balance * 12
    if (balance > 0) {
      insights.push({
        id: 'savings-projection',
        type: 'projection',
        priority: 'medium',
        category: 'savings',
        title: 'Potentiel d\'épargne annuel',
        description: `À ce rythme, tu pourrais épargner ${formatMoney(potentialYearlySavings)} cette année.`,
        impact: `${formatMoney(balance)}/mois × 12 mois`,
        action: 'Ajoute tes comptes épargne dans Patrimoine pour suivre ta progression',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 5. Succès supplémentaires
  // Balance positive ce mois
  if (balance > 0 && income > 0) {
    const isFirstPositiveMonth = context.previousMonthStats
      ? context.previousMonthStats.balance <= 0 && balance > 0
      : false

    if (isFirstPositiveMonth) {
      insights.push({
        id: 'first-positive-month',
        type: 'success',
        priority: 'high',
        category: 'savings',
        title: 'Retour dans le vert',
        description: 'Ce mois, tu as plus de revenus que de dépenses. Continue !',
        impact: `+${formatMoney(balance)} ce mois`,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Patrimoine croissant
  if (assetAccounts.length > 0 && totalAssets > 50000) {
    insights.push({
      id: 'patrimoine-growing',
      type: 'success',
      priority: 'low',
      category: 'patrimoine',
      title: 'Patrimoine en construction',
      description: `Tu as accumulé ${formatMoney(totalAssets)} sur ${assetAccounts.length} compte(s).`,
      action: 'Continue à diversifier et à épargner régulièrement',
      createdAt: new Date().toISOString(),
    })
  }

  return insights
}
