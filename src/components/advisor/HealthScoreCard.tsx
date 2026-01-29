import { memo } from 'react'
import { Activity, TrendingUp, Wallet, PiggyBank, BarChart3, Target } from 'lucide-react'
import type { HealthScore } from '@services/advisor'

interface HealthScoreCardProps {
  score: HealthScore
}

const gradeColors = {
  A: { bg: 'bg-green-500', text: 'text-green-400', ring: 'ring-green-500/30' },
  B: { bg: 'bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/30' },
  C: { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  D: { bg: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/30' },
  F: { bg: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30' },
}

const breakdownConfig = [
  { key: 'savingsRate', label: 'Taux d\'épargne', icon: PiggyBank },
  { key: 'budgetAdherence', label: 'Respect budget', icon: Target },
  { key: 'consistency', label: 'Régularité', icon: Activity },
  { key: 'diversification', label: 'Diversification', icon: Wallet },
  { key: 'trends', label: 'Tendances', icon: TrendingUp },
] as const

export const HealthScoreCard = memo(function HealthScoreCard({ score }: HealthScoreCardProps) {
  const gradeConfig = gradeColors[score.grade]

  return (
    <div className="space-y-4">
      {/* Score principal */}
      <div className="flex items-center gap-6">
        {/* Cercle de score */}
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-700"
            />
            {/* Progress circle */}
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${score.overall * 2.64} 264`}
              className={gradeConfig.text}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${gradeConfig.text}`}>{score.grade}</span>
            <span className="text-xs text-gray-500">{score.overall}/100</span>
          </div>
        </div>

        {/* Résumé */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">Santé Financière</h3>
          <p className="text-sm text-gray-400">{score.summary}</p>
        </div>
      </div>

      {/* Détail par critère */}
      <div className="grid grid-cols-1 gap-2">
        {breakdownConfig.map(({ key, label, icon: Icon }) => {
          const value = score.breakdown[key]
          const color = value >= 80 ? 'bg-green-500' :
                       value >= 60 ? 'bg-blue-500' :
                       value >= 40 ? 'bg-yellow-500' :
                       'bg-red-500'

          return (
            <div key={key} className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-400 w-28 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 w-10 text-right">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
