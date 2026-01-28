import { memo } from 'react'
import { TrendingUp } from 'lucide-react'
import { formatMoney, formatPercent } from '@utils/formatters'
import type { CategoryStat } from '@/types'

interface IncomeBreakdownProps {
  incomeStats: CategoryStat[]
  totalIncome: number
  selectedCategory?: string | null
  onCategoryClick?: (categoryId: string) => void
}

export const IncomeBreakdown = memo(function IncomeBreakdown({
  incomeStats,
  totalIncome,
  selectedCategory,
  onCategoryClick,
}: IncomeBreakdownProps) {
  if (incomeStats.length === 0 || totalIncome === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Aucun revenu cette période</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {incomeStats.slice(0, 6).map((stat) => {
        const isSelected = selectedCategory === stat.categoryId
        const isClickable = !!onCategoryClick

        return (
          <button
            key={stat.categoryId}
            onClick={() => onCategoryClick?.(stat.categoryId)}
            disabled={!isClickable}
            className={`w-full text-left space-y-1 p-2 -mx-2 rounded-lg transition-colors ${
              isClickable ? 'hover:bg-gray-700/50 cursor-pointer' : ''
            } ${isSelected ? 'bg-gray-700/50 ring-1 ring-green-500/50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full transition-transform ${isSelected ? 'scale-125' : ''}`}
                  style={{ backgroundColor: stat.color }}
                />
                <span className="text-sm font-medium">{stat.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-green-400">+{formatMoney(stat.amount)}</span>
                <span className="text-xs text-gray-500 ml-2">
                  ({formatPercent(stat.percentage, 0)})
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stat.percentage}%`,
                  backgroundColor: stat.color,
                  opacity: isSelected ? 1 : 0.7,
                }}
              />
            </div>
          </button>
        )
      })}

      {/* Total */}
      <div className="pt-3 border-t border-gray-700 mt-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Total revenus</span>
          <span className="text-lg font-bold text-green-400">+{formatMoney(totalIncome)}</span>
        </div>
      </div>
    </div>
  )
})
