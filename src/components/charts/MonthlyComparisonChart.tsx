import { memo, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatMoney, formatMonth } from '@utils/formatters'
import { TOOLTIP_STYLE } from '@utils/constants'
import type { Transaction } from '@/types'

interface MonthlyComparisonChartProps {
  transactions: Transaction[]
  months: string[]
}

interface MonthlyData {
  month: string
  monthLabel: string
  revenus: number
  depenses: number
  balance: number
}

export const MonthlyComparisonChart = memo(function MonthlyComparisonChart({
  transactions,
  months,
}: MonthlyComparisonChartProps) {
  const data = useMemo((): MonthlyData[] => {
    // Group transactions by month
    const byMonth = new Map<string, { revenus: number; depenses: number }>()

    for (const t of transactions) {
      const month = t.date.substring(0, 7) // YYYY-MM
      const existing = byMonth.get(month) || { revenus: 0, depenses: 0 }
      if (t.amount > 0) {
        existing.revenus += t.amount
      } else {
        existing.depenses += Math.abs(t.amount)
      }
      byMonth.set(month, existing)
    }

    // Use the months array to maintain order and fill gaps
    return months
      .slice(0, 6) // Last 6 months max
      .reverse()
      .map((month) => {
        const stats = byMonth.get(month) || { revenus: 0, depenses: 0 }
        return {
          month,
          monthLabel: formatMonth(month),
          revenus: stats.revenus,
          depenses: stats.depenses,
          balance: stats.revenus - stats.depenses,
        }
      })
  }, [transactions, months])

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p className="text-center">
          Importez des données sur plusieurs mois
          <br />
          pour voir la comparaison
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          interval={0}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickFormatter={(value) => `${Math.round(value / 1000)}k`}
        />
        <Tooltip
          formatter={(value) => formatMoney(Number(value) || 0)}
          contentStyle={TOOLTIP_STYLE.contentStyle}
          itemStyle={TOOLTIP_STYLE.itemStyle}
          labelStyle={TOOLTIP_STYLE.labelStyle}
        />
        <Legend
          wrapperStyle={{ paddingTop: 10 }}
          formatter={(value) => (
            <span className="text-sm text-gray-300">
              {value === 'revenus' ? 'Revenus' : value === 'depenses' ? 'Dépenses' : 'Balance'}
            </span>
          )}
        />
        <Bar dataKey="revenus" fill="#22c55e" name="revenus" radius={[4, 4, 0, 0]} />
        <Bar dataKey="depenses" fill="#ef4444" name="depenses" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
