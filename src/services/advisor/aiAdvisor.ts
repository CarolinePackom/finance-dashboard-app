// Service d'analyse IA avec Claude

import type { Insight, AnalysisContext, HealthScore } from './types'
import { formatMoney } from '@utils/formatters'

interface AIAdvisorConfig {
  apiKey: string
  model?: string
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>
}

/**
 * Génère des conseils personnalisés avec Claude
 */
export async function generateAIInsights(
  context: AnalysisContext,
  existingInsights: Insight[],
  healthScore: HealthScore | null,
  config: AIAdvisorConfig
): Promise<Insight[]> {
  if (!config.apiKey) {
    throw new Error('Clé API Claude non configurée')
  }

  // Préparer le résumé des données pour Claude
  const summary = buildFinancialSummary(context, healthScore)
  const existingInsightsSummary = existingInsights
    .slice(0, 5)
    .map(i => `- ${i.title}: ${i.description}`)
    .join('\n')

  const prompt = `Tu es un conseiller financier personnel expert. Analyse ces données financières et donne 3-5 conseils personnalisés, actionnables et spécifiques.

## Situation financière
${summary}

## Conseils déjà identifiés (évite les doublons)
${existingInsightsSummary || 'Aucun'}

## Instructions
- Donne des conseils CONCRETS et CHIFFRÉS
- Adapte-toi au contexte français (Livret A, PEA, assurance-vie...)
- Sois direct et pragmatique, pas de généralités
- Format de réponse: JSON array avec structure { title, description, impact, action, type }
- Types possibles: "optimization", "projection", "alert", "success"

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`

  try {
    const requestBody = {
      model: config.model || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    }

    console.log('Calling Claude API with model:', requestBody.model)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)

      // Parse error for better message
      try {
        const errorJson = JSON.parse(errorText)
        const errorMessage = errorJson.error?.message || errorText
        throw new Error(errorMessage)
      } catch {
        throw new Error(`Erreur API Claude: ${response.status} - ${errorText.substring(0, 100)}`)
      }
    }

    const data: ClaudeResponse = await response.json()
    const text = data.content[0]?.text || '[]'

    // Parser la réponse JSON
    const aiInsights = parseAIResponse(text)
    return aiInsights

  } catch (error) {
    console.error('AI Advisor error:', error)
    throw error
  }
}

/**
 * Demande une analyse approfondie sur un sujet spécifique
 */
export async function askAIAdvisor(
  question: string,
  context: AnalysisContext,
  config: AIAdvisorConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Clé API Claude non configurée')
  }

  const summary = buildFinancialSummary(context, null)

  const prompt = `Tu es un conseiller financier personnel. Voici la situation financière de l'utilisateur:

${summary}

Question de l'utilisateur: ${question}

Réponds de manière concise, pratique et adaptée au contexte français. Donne des conseils chiffrés quand c'est pertinent.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      try {
        const errorJson = JSON.parse(errorText)
        throw new Error(errorJson.error?.message || `Erreur API: ${response.status}`)
      } catch {
        throw new Error(`Erreur API: ${response.status}`)
      }
    }

    const data: ClaudeResponse = await response.json()
    return data.content[0]?.text || 'Pas de réponse'

  } catch (error) {
    console.error('AI Advisor error:', error)
    throw error
  }
}

/**
 * Construit un résumé financier pour Claude
 */
function buildFinancialSummary(context: AnalysisContext, healthScore: HealthScore | null): string {
  const { currentMonthStats, previousMonthStats, totalAssets, assetAccounts } = context

  const lines: string[] = []

  // Stats du mois
  if (currentMonthStats) {
    const savingsRate = currentMonthStats.income > 0
      ? ((currentMonthStats.balance / currentMonthStats.income) * 100).toFixed(1)
      : '0'

    lines.push(`### Ce mois (${context.currentMonth})`)
    lines.push(`- Revenus: ${formatMoney(currentMonthStats.income)}`)
    lines.push(`- Dépenses: ${formatMoney(currentMonthStats.expenses)}`)
    lines.push(`- Balance: ${formatMoney(currentMonthStats.balance)}`)
    lines.push(`- Taux d'épargne: ${savingsRate}%`)

    // Top catégories de dépenses
    if (currentMonthStats.byCategory.length > 0) {
      lines.push(`- Top dépenses: ${currentMonthStats.byCategory.slice(0, 3).map(c => `${c.name} (${formatMoney(c.amount)})`).join(', ')}`)
    }
  }

  // Comparaison mois précédent
  if (previousMonthStats && currentMonthStats) {
    const expenseChange = previousMonthStats.expenses > 0
      ? ((currentMonthStats.expenses - previousMonthStats.expenses) / previousMonthStats.expenses * 100).toFixed(1)
      : '0'
    lines.push(`\n### Évolution vs mois précédent`)
    lines.push(`- Variation dépenses: ${expenseChange}%`)
  }

  // Patrimoine
  if (assetAccounts.length > 0) {
    lines.push(`\n### Patrimoine`)
    lines.push(`- Total: ${formatMoney(totalAssets)}`)
    lines.push(`- Comptes: ${assetAccounts.map(a => `${a.name} (${formatMoney(a.currentBalance)})`).join(', ')}`)
  }

  // Score de santé
  if (healthScore) {
    lines.push(`\n### Score de santé financière`)
    lines.push(`- Note globale: ${healthScore.grade} (${healthScore.overall}/100)`)
    lines.push(`- Épargne: ${healthScore.breakdown.savingsRate}/100`)
    lines.push(`- Budget: ${healthScore.breakdown.budgetAdherence}/100`)
    lines.push(`- Diversification: ${healthScore.breakdown.diversification}/100`)
  }

  return lines.join('\n')
}

/**
 * Parse la réponse JSON de Claude
 */
function parseAIResponse(text: string): Insight[] {
  try {
    // Nettoyer le texte (enlever markdown si présent)
    let cleanText = text.trim()
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
    }

    const parsed = JSON.parse(cleanText)
    const insights: Insight[] = []

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.title && item.description) {
          insights.push({
            id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: item.type || 'optimization',
            priority: item.priority || 'medium',
            category: item.category || 'spending',
            title: item.title,
            description: item.description,
            impact: item.impact,
            action: item.action,
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    return insights
  } catch (error) {
    console.error('Failed to parse AI response:', error, text)
    return []
  }
}
