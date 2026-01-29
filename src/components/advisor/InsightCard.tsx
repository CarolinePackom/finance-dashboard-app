import { memo } from 'react'
import {
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  ChevronRight,
  Zap,
} from 'lucide-react'
import type { Insight } from '@services/advisor'

interface InsightCardProps {
  insight: Insight
  onClick?: () => void
}

const typeConfig = {
  alert: {
    icon: AlertTriangle,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    label: 'Alerte',
  },
  optimization: {
    icon: Lightbulb,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
    label: 'Optimisation',
  },
  projection: {
    icon: TrendingUp,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    label: 'Projection',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    iconColor: 'text-green-400',
    label: 'Succès',
  },
}

const priorityBadge = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-gray-500/20 text-gray-400',
}

export const InsightCard = memo(function InsightCard({ insight, onClick }: InsightCardProps) {
  const config = typeConfig[insight.type]
  const Icon = config.icon

  return (
    <div
      className={`p-4 rounded-xl border ${config.bgColor} ${config.borderColor}
        ${onClick ? 'cursor-pointer hover:border-opacity-50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${config.bgColor} shrink-0`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-medium text-white">{insight.title}</h4>
            {insight.priority === 'high' && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge[insight.priority]} shrink-0`}>
                <Zap className="w-3 h-3 inline mr-1" />
                Important
              </span>
            )}
          </div>

          <p className="text-sm text-gray-400 mb-2">{insight.description}</p>

          {/* Impact */}
          {insight.impact && (
            <p className={`text-sm font-medium ${config.iconColor}`}>
              {insight.impact}
            </p>
          )}

          {/* Action */}
          {insight.action && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <ChevronRight className="w-3 h-3" />
              <span>{insight.action}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
