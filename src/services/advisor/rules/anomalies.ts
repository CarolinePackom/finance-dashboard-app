// Règles de détection des anomalies et optimisations

import type { Insight, AnalysisContext } from '../types'
import { formatMoney } from '@utils/formatters'
import type { Transaction } from '@/types'

export function analyzeAnomalies(context: AnalysisContext): Insight[] {
  const insights: Insight[] = []
  const { currentMonthTransactions, allTransactions } = context

  // 1. Détection des dépenses anormalement élevées
  const expenses = allTransactions.filter(t => t.amount < 0)
  if (expenses.length > 10) {
    const amounts = expenses.map(t => Math.abs(t.amount))
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length
    )
    const threshold = avg + 2 * stdDev

    const unusualExpenses = currentMonthTransactions.filter(
      t => t.amount < 0 && Math.abs(t.amount) > threshold && Math.abs(t.amount) > 100
    )

    for (const expense of unusualExpenses.slice(0, 3)) {
      insights.push({
        id: `anomaly-${expense.id}`,
        type: 'alert',
        priority: 'medium',
        category: 'spending',
        title: 'Dépense inhabituelle',
        description: `${expense.description}: ${formatMoney(Math.abs(expense.amount))}`,
        impact: `${((Math.abs(expense.amount) / avg - 1) * 100).toFixed(0)}x plus que ta moyenne`,
        data: { transaction: expense },
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 2. Détection des abonnements potentiels
  const subscriptionPatterns = detectSubscriptions(allTransactions)

  if (subscriptionPatterns.length > 0) {
    const totalMonthly = subscriptionPatterns.reduce((sum, s) => sum + s.amount, 0)

    insights.push({
      id: 'subscriptions-detected',
      type: 'optimization',
      priority: 'medium',
      category: 'spending',
      title: `${subscriptionPatterns.length} abonnements détectés`,
      description: `Tu paies environ ${formatMoney(totalMonthly)}/mois en abonnements.`,
      impact: `${formatMoney(totalMonthly * 12)}/an`,
      action: 'Vérifie si tu utilises tous ces services',
      data: { subscriptions: subscriptionPatterns },
      createdAt: new Date().toISOString(),
    })

    // Détecter les doublons potentiels (streaming, etc.)
    const streamingKeywords = ['netflix', 'disney', 'prime', 'spotify', 'deezer', 'apple music', 'canal', 'ocs', 'hbo', 'paramount']
    const streamingSubscriptions = subscriptionPatterns.filter(s =>
      streamingKeywords.some(kw => s.description.toLowerCase().includes(kw))
    )

    if (streamingSubscriptions.length >= 3) {
      const streamingTotal = streamingSubscriptions.reduce((sum, s) => sum + s.amount, 0)
      insights.push({
        id: 'streaming-multiple',
        type: 'optimization',
        priority: 'low',
        category: 'spending',
        title: 'Plusieurs services de streaming',
        description: `Tu as ${streamingSubscriptions.length} abonnements streaming.`,
        impact: `${formatMoney(streamingTotal)}/mois - ${formatMoney(streamingTotal * 12)}/an`,
        action: 'Envisage de réduire ou partager des comptes',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 3. Frais bancaires
  const bankFees = currentMonthTransactions.filter(t =>
    t.amount < 0 &&
    (t.category === 'bank-fees' ||
     t.description.toLowerCase().includes('frais') ||
     t.description.toLowerCase().includes('commission') ||
     t.description.toLowerCase().includes('cotisation'))
  )

  const totalBankFees = bankFees.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  if (totalBankFees > 10) {
    insights.push({
      id: 'bank-fees',
      type: 'optimization',
      priority: 'low',
      category: 'spending',
      title: 'Frais bancaires',
      description: `Tu paies ${formatMoney(totalBankFees)} de frais ce mois.`,
      impact: `${formatMoney(totalBankFees * 12)}/an`,
      action: 'Une banque en ligne pourrait réduire ces frais',
      createdAt: new Date().toISOString(),
    })
  }

  // 4. Transactions en attente (futures)
  const today = new Date().toISOString().split('T')[0]
  const futureTransactions = currentMonthTransactions.filter(t => t.date > today)

  if (futureTransactions.length > 0) {
    const futureTotal = futureTransactions.reduce((sum, t) => sum + t.amount, 0)
    insights.push({
      id: 'future-transactions',
      type: 'projection',
      priority: 'low',
      category: 'budget',
      title: `${futureTransactions.length} transactions à venir`,
      description: 'Des transactions sont prévues pour les prochains jours.',
      impact: formatMoney(futureTotal),
      createdAt: new Date().toISOString(),
    })
  }

  return insights
}

interface SubscriptionPattern {
  description: string
  amount: number
  occurrences: number
  dates: string[]
}

function detectSubscriptions(transactions: Transaction[]): SubscriptionPattern[] {
  const patterns = new Map<string, { amounts: number[]; dates: string[] }>()

  for (const t of transactions) {
    if (t.amount >= 0) continue

    // Normaliser la description
    const normalized = t.description
      .toLowerCase()
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
      .replace(/\d{2}\/\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 30)

    if (!patterns.has(normalized)) {
      patterns.set(normalized, { amounts: [], dates: [] })
    }

    const pattern = patterns.get(normalized)!
    pattern.amounts.push(Math.abs(t.amount))
    pattern.dates.push(t.date)
  }

  // Filtrer les patterns qui ressemblent à des abonnements
  const subscriptions: SubscriptionPattern[] = []

  for (const [description, data] of patterns) {
    if (data.amounts.length < 2) continue

    // Vérifier si les montants sont similaires
    const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
    const allSimilar = data.amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.1)

    if (allSimilar && avgAmount > 5 && avgAmount < 100) {
      // Vérifier si les dates sont espacées régulièrement (~30 jours)
      const sortedDates = data.dates.sort()
      let isMonthly = true

      for (let i = 1; i < sortedDates.length && isMonthly; i++) {
        const diff = (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i-1]).getTime()) / (1000 * 60 * 60 * 24)
        if (diff < 25 || diff > 35) {
          isMonthly = false
        }
      }

      if (isMonthly || data.amounts.length >= 3) {
        subscriptions.push({
          description,
          amount: avgAmount,
          occurrences: data.amounts.length,
          dates: sortedDates,
        })
      }
    }
  }

  return subscriptions.sort((a, b) => b.amount - a.amount)
}
