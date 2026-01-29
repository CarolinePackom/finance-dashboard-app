import { memo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatMoney } from '@utils/formatters'
import type { CashFlowPoint } from '@/types'

interface CashFlowChartProps {
  data: CashFlowPoint[]
}

export const CashFlowChart = memo(function CashFlowChart({ data }: CashFlowChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Aucune donnée disponible
      </div>
    )
  }

  // Find min/max for better visualization
  const values = data.map(d => d.cumulativeBalance)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const padding = Math.max(Math.abs(maxValue - minValue) * 0.1, 100)

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="cashFlowGradientPositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cashFlowGradientNegative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="dateLabel"
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          domain={[minValue - padding, maxValue + padding]}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="5 5" />
        <Area
          type="monotone"
          dataKey="cumulativeBalance"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#cashFlowGradientPositive)"
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: CashFlowPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="font-medium text-white mb-2">{data.dateLabel}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Revenus:</span>
          <span className="text-green-400">+{formatMoney(data.income)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Dépenses:</span>
          <span className="text-red-400">-{formatMoney(data.expenses)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-gray-700 pt-1 mt-1">
          <span className="text-gray-400">Flux net:</span>
          <span className={data.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}>
            {data.netFlow >= 0 ? '+' : ''}{formatMoney(data.netFlow)}
          </span>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <span className="text-gray-300">Solde cumulé:</span>
          <span className={data.cumulativeBalance >= 0 ? 'text-blue-400' : 'text-red-400'}>
            {formatMoney(data.cumulativeBalance)}
          </span>
        </div>
      </div>
    </div>
  )
}
