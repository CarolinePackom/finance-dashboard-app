import { memo } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { formatMoney, formatDate } from '@utils/formatters'
import type { Transaction, Category, FinancialInsights } from '@/types'

interface UnusualTransactionsListProps {
  transactions: Transaction[]
  insights: FinancialInsights | null
  categories: Category[]
}

export const UnusualTransactionsList = memo(function UnusualTransactionsList({
  transactions,
  insights,
  categories,
}: UnusualTransactionsListProps) {
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  // Combine unusual transactions with largest transactions
  const highlights: Array<{ transaction: Transaction; reason: string; icon: 'unusual' | 'largest-expense' | 'largest-income' }> = []

  // Add unusual transactions
  for (const t of transactions.slice(0, 3)) {
    highlights.push({
      transaction: t,
      reason: 'Inhabituelle',
      icon: 'unusual',
    })
  }

  // Add largest expense if not already included
  if (insights?.largestExpense && !highlights.find(h => h.transaction.id === insights.largestExpense!.id)) {
    highlights.push({
      transaction: insights.largestExpense,
      reason: 'Plus grosse dépense',
      icon: 'largest-expense',
    })
  }

  // Add largest income if not already included
  if (insights?.largestIncome && !highlights.find(h => h.transaction.id === insights.largestIncome!.id)) {
    highlights.push({
      transaction: insights.largestIncome,
      reason: 'Plus gros revenu',
      icon: 'largest-income',
    })
  }

  if (highlights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Aucune transaction remarquable</p>
        <p className="text-xs mt-1">Les montants inhabituels apparaîtront ici</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {highlights.slice(0, 5).map((item) => {
        const { transaction, reason, icon } = item
        const category = categoryMap.get(transaction.category)
        const isExpense = transaction.amount < 0

        return (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-1.5 rounded-lg ${
                icon === 'unusual' ? 'bg-yellow-500/20' :
                icon === 'largest-expense' ? 'bg-red-500/20' : 'bg-green-500/20'
              }`}>
                {icon === 'unusual' ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                ) : icon === 'largest-expense' ? (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {transaction.description.substring(0, 30)}
                  {transaction.description.length > 30 ? '...' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(transaction.date)} • {reason}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className={`text-sm font-medium ${isExpense ? 'text-red-400' : 'text-green-400'}`}>
                {isExpense ? '' : '+'}{formatMoney(transaction.amount)}
              </p>
              <p className="text-xs text-gray-500">
                {category?.name || 'Autre'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
})
