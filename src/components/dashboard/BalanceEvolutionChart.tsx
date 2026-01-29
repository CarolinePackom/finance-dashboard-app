import { memo, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { formatMoney } from '@utils/formatters'
import type { Transaction } from '@/types'

interface MonthlyBalance {
  month: string
  monthLabel: string
  income: number
  expenses: number
  balance: number
  cumulativeBalance: number
}

interface BalanceEvolutionChartProps {
  transactions: Transaction[]
  initialBalance?: number
  monthsToShow?: number
}

export const BalanceEvolutionChart = memo(function BalanceEvolutionChart({
  transactions,
  initialBalance = 0,
  monthsToShow = 12,
}: BalanceEvolutionChartProps) {
  const chartData = useMemo(() => {
    // Group transactions by month (use budgetMonth if set, otherwise use date)
    const byMonth = new Map<string, { income: number; expenses: number }>()

    for (const t of transactions) {
      // Use budgetMonth if explicitly set, otherwise use the transaction date
      const month = t.budgetMonth || t.date.substring(0, 7)
      const existing = byMonth.get(month) || { income: 0, expenses: 0 }

      if (t.amount > 0) {
        existing.income += t.amount
      } else {
        existing.expenses += Math.abs(t.amount)
      }

      byMonth.set(month, existing)
    }

    // Sort months and take the last N
    const sortedMonths = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-monthsToShow)

    // Calculate cumulative balance
    let cumulative = initialBalance

    // Add balance from transactions before the displayed period
    const firstDisplayedMonth = sortedMonths[0]?.[0]
    if (firstDisplayedMonth) {
      for (const t of transactions) {
        const tMonth = t.budgetMonth || t.date.substring(0, 7)
        if (tMonth < firstDisplayedMonth) {
          cumulative += t.amount
        }
      }
    }

    const data: MonthlyBalance[] = []

    for (const [month, { income, expenses }] of sortedMonths) {
      const balance = income - expenses
      cumulative += balance

      // Format month label
      const date = new Date(month + '-01')
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' })

      data.push({
        month,
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        income,
        expenses,
        balance,
        cumulativeBalance: cumulative,
      })
    }

    return data
  }, [transactions, initialBalance, monthsToShow])

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Aucune donnée disponible
      </div>
    )
  }

  // Find min/max for better visualization
  const balances = chartData.map(d => d.cumulativeBalance)
  const minBalance = Math.min(...balances)
  const maxBalance = Math.max(...balances)
  const padding = Math.max(Math.abs(maxBalance - minBalance) * 0.1, 500)

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="monthLabel"
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => {
            if (Math.abs(value) >= 1000) {
              return `${(value / 1000).toFixed(0)}k`
            }
            return value.toString()
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => {
            if (Math.abs(value) >= 1000) {
              return `${(value / 1000).toFixed(0)}k`
            }
            return value.toString()
          }}
          domain={[minBalance - padding, maxBalance + padding]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value) => {
            const labels: Record<string, string> = {
              income: 'Revenus',
              expenses: 'Dépenses',
              cumulativeBalance: 'Solde',
            }
            return <span className="text-gray-400 text-xs">{labels[value] || value}</span>
          }}
        />
        <ReferenceLine yAxisId="right" y={0} stroke="#6b7280" strokeDasharray="5 5" />

        {/* Bars for income/expenses */}
        <Bar
          yAxisId="left"
          dataKey="income"
          fill="#22c55e"
          opacity={0.8}
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />
        <Bar
          yAxisId="left"
          dataKey="expenses"
          fill="#ef4444"
          opacity={0.8}
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />

        {/* Line for cumulative balance */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulativeBalance"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#3b82f6' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
})

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: MonthlyBalance; dataKey: string; color: string }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  const monthDate = new Date(data.month + '-01')
  const fullMonthLabel = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="font-medium text-white mb-2 capitalize">{fullMonthLabel}</p>
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
          <span className="text-gray-400">Balance mois:</span>
          <span className={data.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
            {data.balance >= 0 ? '+' : ''}{formatMoney(data.balance)}
          </span>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <span className="text-gray-300">Solde cumulé:</span>
          <span className="text-blue-400">{formatMoney(data.cumulativeBalance)}</span>
        </div>
      </div>
    </div>
  )
}
