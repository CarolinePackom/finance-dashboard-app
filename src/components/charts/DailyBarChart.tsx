import { memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { formatMoney } from '@utils/formatters'
import { TOOLTIP_STYLE } from '@utils/constants'

interface DailyData {
  date: string
  dateLabel: string
  depenses: number
  revenus: number
}

interface DailyBarChartProps {
  data: DailyData[]
}

export const DailyBarChart = memo(function DailyBarChart({ data }: DailyBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Aucune donnée à afficher
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          interval={Math.max(0, Math.floor(data.length / 7))}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <Tooltip
          formatter={(value) => formatMoney(Number(value) || 0)}
          contentStyle={TOOLTIP_STYLE.contentStyle}
          itemStyle={TOOLTIP_STYLE.itemStyle}
          labelStyle={TOOLTIP_STYLE.labelStyle}
        />
        <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" radius={[4, 4, 0, 0]} />
        <Bar dataKey="revenus" fill="#22c55e" name="Revenus" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
