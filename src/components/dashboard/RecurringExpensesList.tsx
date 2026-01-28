import { memo, useState } from 'react'
import { Repeat, ChevronDown, ChevronUp } from 'lucide-react'
import { formatMoney } from '@utils/formatters'
import type { RecurringTransaction, Category } from '@/types'

interface RecurringExpensesListProps {
  recurring: RecurringTransaction[]
  categories: Category[]
  maxItems?: number
}

export const RecurringExpensesList = memo(function RecurringExpensesList({
  recurring,
  categories,
  maxItems = 5,
}: RecurringExpensesListProps) {
  const [showAll, setShowAll] = useState(false)

  // Filter only expenses
  const expenses = recurring.filter(r => r.isExpense)
  const displayItems = showAll ? expenses : expenses.slice(0, maxItems)
  const hasMore = expenses.length > maxItems

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Repeat className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Aucune dépense récurrente détectée</p>
        <p className="text-xs mt-1">Les transactions similaires apparaîtront ici</p>
      </div>
    )
  }

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  return (
    <div className="space-y-2">
      {displayItems.map((item, index) => {
        const category = categoryMap.get(item.category)
        return (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: category?.color || '#94a3b8' }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {truncateDescription(item.description)}
                </p>
                <p className="text-xs text-gray-500">
                  {item.occurrences}x • {category?.name || 'Autre'}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-sm font-medium text-red-400">
                -{formatMoney(item.totalAmount)}
              </p>
              <p className="text-xs text-gray-500">
                ~{formatMoney(item.avgAmount)}/fois
              </p>
            </div>
          </div>
        )
      })}

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Voir moins
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Voir {expenses.length - maxItems} de plus
            </>
          )}
        </button>
      )}

      {/* Summary */}
      <div className="pt-2 border-t border-gray-700 mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total récurrent</span>
          <span className="text-red-400 font-medium">
            -{formatMoney(expenses.reduce((sum, r) => sum + r.totalAmount, 0))}
          </span>
        </div>
      </div>
    </div>
  )
})

function truncateDescription(desc: string): string {
  // Clean up and truncate
  const cleaned = desc
    .replace(/CB\s*\*\d+/gi, '')
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 35 ? cleaned.substring(0, 35) + '...' : cleaned
}
