import { memo } from 'react'
import { TrendingUp, TrendingDown, Minus, Calendar, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card } from '@components/common'
import { formatMoney, formatPercent } from '@utils/formatters'
import type { FinancialInsights } from '@/types'

interface FinancialSummaryProps {
  insights: FinancialInsights | null
  income: number
  expenses: number
  balance: number
  bankBalance?: number | null // Real bank balance (initial + all transactions)
}

export const FinancialSummary = memo(function FinancialSummary({
  insights,
  income,
  expenses,
  balance,
  bankBalance,
}: FinancialSummaryProps) {
  if (!insights) return null

  const comparison = insights.previousPeriodComparison
  const hasBankBalance = bankBalance !== null && bankBalance !== undefined

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Bank Balance - Real balance */}
      <Card className="relative overflow-hidden border-blue-500/30">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {hasBankBalance ? 'Solde compte' : 'Balance mois'}
            </p>
            <p className={`text-xl md:text-2xl font-bold mt-1 ${(hasBankBalance ? bankBalance : balance) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatMoney(hasBankBalance ? bankBalance : balance)}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${(hasBankBalance ? bankBalance : balance) >= 0 ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
            <Wallet className={`w-5 h-5 ${(hasBankBalance ? bankBalance : balance) >= 0 ? 'text-blue-400' : 'text-red-400'}`} />
          </div>
        </div>
        {hasBankBalance && (
          <p className="text-xs text-gray-500 mt-2">
            Ce mois: {balance >= 0 ? '+' : ''}{formatMoney(balance)}
          </p>
        )}
        {!hasBankBalance && comparison && (
          <TrendBadge value={comparison.balanceChange} label="vs préc." />
        )}
      </Card>

      {/* Income */}
      <Card className="relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Revenus</p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-green-400">
              +{formatMoney(income)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-green-500/20">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
        </div>
        {comparison && (
          <TrendBadge value={comparison.incomeChange} label="vs préc." />
        )}
      </Card>

      {/* Expenses */}
      <Card className="relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Dépenses</p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-red-400">
              -{formatMoney(expenses)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/20">
            <TrendingDown className="w-5 h-5 text-red-400" />
          </div>
        </div>
        {comparison && (
          <TrendBadge value={comparison.expenseChange} label="vs préc." inverted />
        )}
      </Card>

      {/* Avg Daily Expense */}
      <Card className="relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Moy./jour</p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-red-400">
              -{formatMoney(insights.avgDailyExpense)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/20">
            <Calendar className="w-5 h-5 text-red-400" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Sur {insights.daysInPeriod} jours
        </p>
      </Card>
    </div>
  )
})

interface TrendBadgeProps {
  value: number
  label: string
  inverted?: boolean // For expenses, lower is better
}

function TrendBadge({ value, label, inverted = false }: TrendBadgeProps) {
  const isPositive = inverted ? value < 0 : value > 0
  const isNegative = inverted ? value > 0 : value < 0
  const absValue = Math.abs(value)

  if (absValue < 0.1) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <Minus className="w-3 h-3 text-gray-400" />
        <span className="text-xs text-gray-400">Stable {label}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      {isPositive ? (
        <ArrowUpRight className="w-3 h-3 text-green-400" />
      ) : (
        <ArrowDownRight className="w-3 h-3 text-red-400" />
      )}
      <span className={`text-xs ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'}`}>
        {isPositive ? '+' : ''}{formatPercent(value, 1)} {label}
      </span>
    </div>
  )
}
