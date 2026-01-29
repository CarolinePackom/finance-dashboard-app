import { memo, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatMoney } from '@utils/formatters'
import type { Transaction } from '@/types'

interface MonthlyData {
  month: string
  monthLabel: string
  income: number
  expenses: number
  balance: number
  savingsRate: number
  incomeChange: number | null
  expensesChange: number | null
}

interface MonthlyOverviewTableProps {
  transactions: Transaction[]
  monthsToShow?: number
}

export const MonthlyOverviewTable = memo(function MonthlyOverviewTable({
  transactions,
  monthsToShow = 6,
}: MonthlyOverviewTableProps) {
  const monthlyData = useMemo(() => {
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

    // Calculate data with changes
    const data: MonthlyData[] = []

    for (let i = 0; i < sortedMonths.length; i++) {
      const [month, { income, expenses }] = sortedMonths[i]
      const balance = income - expenses
      const savingsRate = income > 0 ? (balance / income) * 100 : 0

      // Calculate change from previous month
      let incomeChange: number | null = null
      let expensesChange: number | null = null

      if (i > 0) {
        const prev = sortedMonths[i - 1][1]
        if (prev.income > 0) {
          incomeChange = ((income - prev.income) / prev.income) * 100
        }
        if (prev.expenses > 0) {
          expensesChange = ((expenses - prev.expenses) / prev.expenses) * 100
        }
      }

      // Format month label
      const date = new Date(month + '-01')
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

      data.push({
        month,
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        income,
        expenses,
        balance,
        savingsRate,
        incomeChange,
        expensesChange,
      })
    }

    return data
  }, [transactions, monthsToShow])

  if (monthlyData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucune donnée disponible
      </div>
    )
  }

  // Calculate averages
  const avgIncome = monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length
  const avgExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0) / monthlyData.length
  const avgBalance = monthlyData.reduce((sum, m) => sum + m.balance, 0) / monthlyData.length
  const avgSavingsRate = monthlyData.reduce((sum, m) => sum + m.savingsRate, 0) / monthlyData.length

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Mois</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Revenus</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Dépenses</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Balance</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Épargne</th>
          </tr>
        </thead>
        <tbody>
          {monthlyData.map((month, index) => (
            <tr
              key={month.month}
              className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                index === monthlyData.length - 1 ? 'bg-blue-500/10' : ''
              }`}
            >
              <td className="py-3 px-2">
                <span className="font-medium text-white">{month.monthLabel}</span>
                {index === monthlyData.length - 1 && (
                  <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                    En cours
                  </span>
                )}
              </td>
              <td className="py-3 px-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-green-400">{formatMoney(month.income)}</span>
                  {month.incomeChange !== null && (
                    <ChangeIndicator value={month.incomeChange} />
                  )}
                </div>
              </td>
              <td className="py-3 px-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-red-400">{formatMoney(month.expenses)}</span>
                  {month.expensesChange !== null && (
                    <ChangeIndicator value={month.expensesChange} inverted />
                  )}
                </div>
              </td>
              <td className="py-3 px-2 text-right">
                <span className={month.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {month.balance >= 0 ? '+' : ''}{formatMoney(month.balance)}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        month.savingsRate >= 20
                          ? 'bg-green-500'
                          : month.savingsRate >= 10
                          ? 'bg-yellow-500'
                          : month.savingsRate > 0
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, month.savingsRate))}%` }}
                    />
                  </div>
                  <span className={`text-xs w-10 text-right ${
                    month.savingsRate >= 20 ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {month.savingsRate.toFixed(0)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-600 bg-gray-800/30">
            <td className="py-3 px-2 font-medium text-gray-300">Moyenne</td>
            <td className="py-3 px-2 text-right text-green-400/70">{formatMoney(avgIncome)}</td>
            <td className="py-3 px-2 text-right text-red-400/70">{formatMoney(avgExpenses)}</td>
            <td className="py-3 px-2 text-right">
              <span className={avgBalance >= 0 ? 'text-green-400/70' : 'text-red-400/70'}>
                {avgBalance >= 0 ? '+' : ''}{formatMoney(avgBalance)}
              </span>
            </td>
            <td className="py-3 px-2 text-right text-gray-400">{avgSavingsRate.toFixed(0)}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
})

interface ChangeIndicatorProps {
  value: number
  inverted?: boolean // For expenses, lower is better
}

function ChangeIndicator({ value, inverted = false }: ChangeIndicatorProps) {
  const isPositive = inverted ? value < 0 : value > 0
  const isNegative = inverted ? value > 0 : value < 0

  if (Math.abs(value) < 1) {
    return (
      <span className="flex items-center text-gray-500">
        <Minus className="w-3 h-3" />
      </span>
    )
  }

  return (
    <span
      className={`flex items-center text-xs ${
        isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'
      }`}
      title={`${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs mois précédent`}
    >
      {value > 0 ? (
        <TrendingUp className="w-3 h-3" />
      ) : value < 0 ? (
        <TrendingDown className="w-3 h-3" />
      ) : (
        <Minus className="w-3 h-3" />
      )}
    </span>
  )
}
