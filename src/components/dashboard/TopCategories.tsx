import { memo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardTitle } from '@components/common'
import { CategoryIcon } from './CategoryIcon'
import { formatMoney } from '@utils/formatters'
import type { CategoryStat } from '@/types'

interface TopCategoriesProps {
  categories: CategoryStat[]
  maxItems?: number
  selectedCategory?: string | null
  onCategoryClick?: (categoryId: string) => void
  title?: string
  emptyMessage?: string
}

export const TopCategories = memo(function TopCategories({
  categories,
  maxItems = 8,
  selectedCategory,
  onCategoryClick,
  title = 'Top depenses par categorie',
  emptyMessage = 'Aucune depense ce mois',
}: TopCategoriesProps) {
  const [showAll, setShowAll] = useState(false)

  const displayCategories = showAll ? categories : categories.slice(0, maxItems)
  const hasMore = categories.length > maxItems
  const maxAmount = categories[0]?.amount || 1

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="space-y-3 mt-4">
        {displayCategories.map((cat) => {
          const isSelected = selectedCategory === cat.categoryId
          return (
            <button
              key={cat.categoryId}
              onClick={() => onCategoryClick?.(cat.categoryId)}
              className={`w-full flex items-center gap-3 p-2 -m-2 rounded-lg transition-all ${
                onCategoryClick ? 'hover:bg-gray-700/50 cursor-pointer' : ''
              } ${isSelected ? 'bg-gray-700/50 ring-2 ring-white/30' : ''}`}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <CategoryIcon categoryId={cat.categoryId} color={cat.color} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <span className="text-sm font-medium truncate">{cat.name}</span>
                  <span className="text-sm text-gray-400 flex-shrink-0">
                    {formatMoney(cat.amount)}
                    <span className="text-xs ml-1">({cat.transactionCount})</span>
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(cat.amount / maxAmount) * 100}%`,
                      backgroundColor: cat.color,
                    }}
                    role="progressbar"
                    aria-valuenow={Math.round((cat.amount / maxAmount) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${cat.name}: ${formatMoney(cat.amount)} (${Math.round((cat.amount / maxAmount) * 100)}%)`}
                  />
                </div>
              </div>
            </button>
          )
        })}
        {displayCategories.length === 0 && (
          <p className="text-gray-500 text-center py-4">{emptyMessage}</p>
        )}

        {/* Show more/less button */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Voir moins
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Voir tout ({categories.length} catégories)
              </>
            )}
          </button>
        )}
      </div>
    </Card>
  )
})
