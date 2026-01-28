import { memo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { clsx } from 'clsx'

interface TrendIndicatorProps {
  current: number
  previous: number
  label?: string
  format?: (value: number) => string
  invertColors?: boolean
}

export const TrendIndicator = memo(function TrendIndicator({
  current,
  previous,
  label,
  format = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  invertColors = false,
}: TrendIndicatorProps) {
  if (previous === 0) {
    return null
  }

  const change = ((current - previous) / previous) * 100
  const isPositive = change > 0
  const isNeutral = Math.abs(change) < 1

  // For expenses, positive change (increase) is bad, negative is good
  // invertColors reverses this logic
  const isGood = invertColors ? !isPositive : isPositive

  return (
    <div
      className={clsx(
        'flex items-center gap-1 text-xs font-medium',
        isNeutral
          ? 'text-gray-400'
          : isGood
            ? 'text-green-400'
            : 'text-red-400'
      )}
    >
      {isNeutral ? (
        <Minus className="w-3 h-3" />
      ) : isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      <span>{format(change)}</span>
      {label && <span className="text-gray-500">{label}</span>}
    </div>
  )
})
