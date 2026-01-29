import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { CreditCard, X, CheckSquare, Tag, XCircle, Calendar } from 'lucide-react'
import type { Transaction, Category } from '@/types'
import { Card, CardTitle, Button, EmptyTransactions, EmptySearch, useToast } from '@components/common'
import { TransactionRow } from './TransactionRow'
import { EditTransactionModal } from './EditTransactionModal'
import { transactionService } from '@services/db'

type ViewMode = 'all' | 'expenses' | 'income'

interface TransactionListProps {
  transactions: Transaction[]
  categories: Category[]
  selectedCategory?: string | null
  householdMembers?: string[]
  onClearCategory?: () => void
  onCategoryChange?: (transactionId: string, categoryId: string) => void
  onBudgetMonthChange?: (transactionId: string, budgetMonth: string | undefined) => void
  onAssignedToChange?: (transactionId: string, assignedTo: string | undefined) => void
  onBulkCategoryChange?: (transactionIds: string[], categoryId: string) => void
}

export const TransactionList = memo(function TransactionList({
  transactions,
  categories,
  selectedCategory,
  householdMembers = [],
  onClearCategory,
  onCategoryChange,
  onBudgetMonthChange,
  onAssignedToChange,
  onBulkCategoryChange,
}: TransactionListProps) {
  const toast = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all') // 'all' or 'YYYY-MM'
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [showBulkDropdown, setShowBulkDropdown] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const bulkDropdownRef = useRef<HTMLDivElement>(null)

  // Get unique months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    for (const t of transactions) {
      months.add(t.date.substring(0, 7))
    }
    return Array.from(months).sort().reverse()
  }, [transactions])

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]))
  }, [categories])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showBulkDropdown) return

    const handleClickOutside = (e: MouseEvent) => {
      if (bulkDropdownRef.current && !bulkDropdownRef.current.contains(e.target as Node)) {
        setShowBulkDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBulkDropdown])

  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    if (selectedCategory) {
      filtered = filtered.filter((t) => t.category === selectedCategory)
    }

    if (selectedMonth !== 'all') {
      filtered = filtered.filter((t) => t.date.startsWith(selectedMonth))
    }

    if (viewMode === 'expenses') {
      filtered = filtered.filter((t) => t.amount < 0)
    } else if (viewMode === 'income') {
      filtered = filtered.filter((t) => t.amount > 0)
    }

    return [...filtered].sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, selectedCategory, selectedMonth, viewMode])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [])

  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        setSelectedIds(new Set())
      }
      return !prev
    })
  }, [])

  const handleSelectTransaction = useCallback((transactionId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(transactionId)
      } else {
        newSet.delete(transactionId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [filteredTransactions])

  const handleBulkCategoryChange = useCallback((categoryId: string) => {
    if (onBulkCategoryChange && selectedIds.size > 0) {
      onBulkCategoryChange(Array.from(selectedIds), categoryId)
      setSelectedIds(new Set())
      setShowBulkDropdown(false)
      setIsSelectionMode(false)
    }
  }, [onBulkCategoryChange, selectedIds])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction)
  }, [])

  const handleSaveEdit = useCallback(async (id: string, updates: Partial<Transaction>) => {
    await transactionService.update(id, updates)
    toast.success('Transaction modifiée', 'Les modifications ont été enregistrées')
  }, [toast])

  const handleDelete = useCallback(async (id: string) => {
    await transactionService.delete(id)
    toast.success('Transaction supprimée', 'La transaction a été supprimée')
  }, [toast])

  const isAllSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length
  const isSomeSelected = selectedIds.size > 0

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <CardTitle icon={<CreditCard className="w-5 h-5 text-green-400" />}>
          Transactions
          {selectedCategory && (
            <span className="text-sm font-normal text-gray-400 ml-2">
              Filtre: {categoryMap.get(selectedCategory)?.name || selectedCategory}
              <button
                onClick={onClearCategory}
                className="ml-2 text-red-400 hover:text-red-300 inline-flex items-center"
                aria-label="Effacer le filtre"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2 flex-wrap items-center" role="group" aria-label="Filtrer par type">
          {/* Month filter */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les mois</option>
              {availableMonths.map(month => {
                const [year, m] = month.split('-')
                const date = new Date(parseInt(year), parseInt(m) - 1)
                const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                return (
                  <option key={month} value={month}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </option>
                )
              })}
            </select>
          </div>

          {(['all', 'expenses', 'income'] as const).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleViewModeChange(mode)}
              aria-pressed={viewMode === mode}
            >
              {mode === 'all' ? 'Tout' : mode === 'expenses' ? 'Dépenses' : 'Revenus'}
            </Button>
          ))}
          <Button
            variant={isSelectionMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={handleToggleSelectionMode}
            leftIcon={<CheckSquare className="w-4 h-4" />}
            aria-pressed={isSelectionMode}
          >
            {isSelectionMode ? 'Annuler' : 'Sélectionner'}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {isSelectionMode && isSomeSelected && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 font-medium">
              {selectedIds.size} sélectionnée(s)
            </span>
            <button
              onClick={handleClearSelection}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Désélectionner tout"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="relative" ref={bulkDropdownRef}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowBulkDropdown(!showBulkDropdown)}
              leftIcon={<Tag className="w-4 h-4" />}
            >
              Changer catégorie
            </Button>
            {showBulkDropdown && (
              <div className="absolute z-50 top-full right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[200px]">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleBulkCategoryChange(cat.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyTransactions />
      ) : filteredTransactions.length === 0 ? (
        <EmptySearch onClear={onClearCategory} />
      ) : (
        <>
          <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full" role="table">
              <caption className="sr-only">Liste des transactions bancaires</caption>
              <thead className="text-left text-gray-400 text-sm border-b border-gray-700 sticky top-0 bg-gray-800">
                <tr>
                  {isSelectionMode && (
                    <th className="pb-3 pl-2 pr-1 w-10" scope="col">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        aria-label="Sélectionner toutes les transactions"
                      />
                    </th>
                  )}
                  <th className="pb-3 font-medium" scope="col">
                    Date
                  </th>
                  <th className="pb-3 font-medium" scope="col">
                    Description
                  </th>
                  <th className="pb-3 font-medium" scope="col">
                    Catégorie
                  </th>
                  <th className="pb-3 font-medium text-right" scope="col">
                    Montant
                  </th>
                  {householdMembers.length > 0 && (
                    <th className="pb-3 font-medium text-center" scope="col">
                      Imputé à
                    </th>
                  )}
                  <th className="pb-3 w-10" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredTransactions.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={categoryMap.get(t.category)}
                    allCategories={categories}
                    householdMembers={householdMembers}
                    onCategoryChange={onCategoryChange}
                    onBudgetMonthChange={onBudgetMonthChange}
                    onAssignedToChange={onAssignedToChange}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isSelected={selectedIds.has(t.id)}
                    onSelect={handleSelectTransaction}
                    showCheckbox={isSelectionMode}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-gray-500 text-sm mt-4" aria-live="polite">
            {filteredTransactions.length} transaction(s) affichée(s)
          </p>
        </>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          categories={categories}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </Card>
  )
})
