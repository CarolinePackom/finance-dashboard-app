import { memo, useState } from 'react'
import {
  Brain,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  Sparkles,
  Zap,
  Loader2,
  Send,
  Settings,
  MessageSquare,
} from 'lucide-react'
import { Card, CardTitle, Button } from '@components/common'
import { InsightCard } from './InsightCard'
import { HealthScoreCard } from './HealthScoreCard'
import type { Insight, HealthScore } from '@services/advisor'

interface AdvisorPanelProps {
  insights: Insight[]
  healthScore: HealthScore | null
  isLoading?: boolean
  // AI props
  aiEnabled?: boolean
  aiLoading?: boolean
  aiError?: string | null
  aiInsights?: Insight[]
  onToggleAI?: () => void
  onAskQuestion?: (question: string) => Promise<string>
  hasApiKey?: boolean
}

type FilterType = 'all' | 'alert' | 'optimization' | 'projection' | 'success'

const filterConfig: { type: FilterType; label: string; icon: typeof AlertTriangle; color: string }[] = [
  { type: 'all', label: 'Tous', icon: Sparkles, color: 'text-purple-400' },
  { type: 'alert', label: 'Alertes', icon: AlertTriangle, color: 'text-red-400' },
  { type: 'optimization', label: 'Optimisations', icon: Lightbulb, color: 'text-yellow-400' },
  { type: 'projection', label: 'Projections', icon: TrendingUp, color: 'text-blue-400' },
  { type: 'success', label: 'Succès', icon: CheckCircle, color: 'text-green-400' },
]

export const AdvisorPanel = memo(function AdvisorPanel({
  insights,
  healthScore,
  isLoading,
  aiEnabled = false,
  aiLoading = false,
  aiError = null,
  aiInsights = [],
  onToggleAI,
  onAskQuestion,
  hasApiKey = false,
}: AdvisorPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [question, setQuestion] = useState('')
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [askingQuestion, setAskingQuestion] = useState(false)

  // Combiner insights locaux et IA
  const allInsights = aiEnabled ? [...insights, ...aiInsights] : insights

  // Compter par type
  const counts = {
    all: allInsights.length,
    alert: allInsights.filter(i => i.type === 'alert').length,
    optimization: allInsights.filter(i => i.type === 'optimization').length,
    projection: allInsights.filter(i => i.type === 'projection').length,
    success: allInsights.filter(i => i.type === 'success').length,
  }

  // Filtrer les insights
  const filteredInsights = filter === 'all'
    ? allInsights
    : allInsights.filter(i => i.type === filter)

  // Insights prioritaires (high priority)
  const priorityInsights = allInsights.filter(i => i.priority === 'high')

  // Handle asking question
  const handleAskQuestion = async () => {
    if (!question.trim() || !onAskQuestion) return

    setAskingQuestion(true)
    setAiResponse(null)

    try {
      const response = await onAskQuestion(question)
      setAiResponse(response)
    } catch (error) {
      setAiResponse(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setAskingQuestion(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-700 rounded-full" />
          <div className="h-6 bg-gray-700 rounded w-48" />
        </div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-700 rounded-xl" />
          <div className="h-20 bg-gray-700 rounded-xl" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle icon={<Brain className="w-5 h-5 text-purple-400" />}>
          Conseiller Financier
          {priorityInsights.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
              {priorityInsights.length} alerte{priorityInsights.length > 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {!isExpanded && (
        <p className="text-sm text-gray-500 mt-2">
          {insights.length} conseil{insights.length > 1 ? 's' : ''} disponible{insights.length > 1 ? 's' : ''}
        </p>
      )}

      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* AI Toggle */}
          {onToggleAI && (
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${aiEnabled ? 'bg-purple-500/20' : 'bg-gray-700'}`}>
                  <Zap className={`w-4 h-4 ${aiEnabled ? 'text-purple-400' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Mode IA Claude</p>
                  <p className="text-xs text-gray-500">
                    {aiEnabled ? 'Conseils enrichis par IA' : 'Conseils basés sur règles locales'}
                  </p>
                </div>
              </div>
              <button
                onClick={onToggleAI}
                disabled={aiLoading}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  aiEnabled ? 'bg-purple-500' : 'bg-gray-600'
                } ${aiLoading ? 'opacity-50' : ''}`}
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 absolute left-1 top-1 text-white animate-spin" />
                ) : (
                  <div
                    className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform ${
                      aiEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                )}
              </button>
            </div>
          )}

          {/* AI Error */}
          {aiError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{aiError}</span>
                {!hasApiKey && (
                  <a href="/settings" className="ml-auto flex items-center gap-1 text-xs hover:text-red-300">
                    <Settings className="w-3 h-3" />
                    Configurer
                  </a>
                )}
              </div>
            </div>
          )}

          {/* AI Question Box */}
          {aiEnabled && onAskQuestion && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                    placeholder="Pose une question sur tes finances..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleAskQuestion}
                  disabled={askingQuestion || !question.trim()}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-400 disabled:bg-gray-600 disabled:text-gray-400 rounded-lg transition-colors"
                >
                  {askingQuestion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* AI Response */}
              {aiResponse && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Brain className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Score de santé */}
          {healthScore && (
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <HealthScoreCard score={healthScore} />
            </div>
          )}

          {/* Filtres */}
          {insights.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {filterConfig.map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFilter(type)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                    filter === type
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${filter === type ? color : ''}`} />
                  <span>{label}</span>
                  {counts[type] > 0 && (
                    <span className={`text-xs ${filter === type ? 'text-gray-300' : 'text-gray-500'}`}>
                      ({counts[type]})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Liste des conseils */}
          {filteredInsights.length > 0 ? (
            <div className="space-y-3">
              {filteredInsights.map(insight => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          ) : insights.length > 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Aucun conseil de type "{filterConfig.find(f => f.type === filter)?.label}"</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">Pas encore de conseils</p>
              <p className="text-sm text-gray-500 mt-1">
                Ajoute plus de transactions pour obtenir des recommandations personnalisées
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
})
