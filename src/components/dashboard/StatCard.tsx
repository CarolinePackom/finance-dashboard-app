import { memo, type ComponentType } from 'react'
import { type LucideProps } from 'lucide-react'
import { Card, Skeleton } from '@components/common'

interface StatCardProps {
  icon: ComponentType<LucideProps>
  iconColor: string
  label: string
  value: string
  valueColor: string
  isLoading?: boolean
  trend?: {
    value: number
    isPositive: boolean
  }
}

export const StatCard = memo(function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  valueColor,
  isLoading = false,
  trend,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="w-20 h-4" />
        </div>
        <Skeleton className="w-32 h-8" />
      </Card>
    )
  }

  return (
    <Card className="group">
      <div className="flex items-center gap-2 mb-2">
        <div className="transition-transform duration-200 group-hover:scale-110">
          <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
        </div>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-xl md:text-2xl font-bold ${valueColor} transition-colors`}>
          {value}
        </p>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </Card>
  )
})
