import { memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatMoney } from '@utils/formatters'
import type { SpendingPattern } from '@/types'

interface SpendingPatternsChartProps {
  data: SpendingPattern[]
}

// Reorder to start with Monday
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon to Sun
const SHORT_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export const SpendingPatternsChart = memo(function SpendingPatternsChart({
  data,
}: SpendingPatternsChartProps) {
  // Reorder data to start with Monday
  const orderedData = WEEKDAY_ORDER.map(dayIndex => {
    const dayData = data.find(d => d.dayOfWeek === dayIndex)
    return {
      ...dayData,
      shortName: SHORT_NAMES[dayIndex],
      isWeekend: dayIndex === 0 || dayIndex === 6,
    }
  }).filter(Boolean) as (SpendingPattern & { shortName: string; isWeekend: boolean })[]

  // Find max for color intensity
  const maxExpense = Math.max(...orderedData.map(d => d.totalExpenses), 1)

  if (orderedData.every(d => d.totalExpenses === 0)) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Aucune dépense enregistrée
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={orderedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="shortName"
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(0)}€`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey="totalExpenses" radius={[4, 4, 0, 0]} maxBarSize={50}>
          {orderedData.map((entry, index) => {
            const intensity = entry.totalExpenses / maxExpense
            const baseColor = entry.isWeekend ? '#f59e0b' : '#ef4444'
            return (
              <Cell
                key={`cell-${index}`}
                fill={baseColor}
                fillOpacity={0.3 + intensity * 0.7}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: SpendingPattern & { shortName: string; isWeekend: boolean } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="font-medium text-white mb-2">{data.dayName}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Total dépensé:</span>
          <span className="text-red-400">{formatMoney(data.totalExpenses)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Transactions:</span>
          <span className="text-white">{data.transactionCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Moyenne:</span>
          <span className="text-gray-300">{formatMoney(data.avgExpense)}</span>
        </div>
      </div>
    </div>
  )
}
