import { useState, useMemo } from 'react'
import { Plus, X, ShoppingBag, Home, TrendingUp, TrendingDown, User } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Card, CardTitle, Button } from '@components/common'
import { transactionService } from '@services/db'
import { formatMoney } from '@utils/formatters'
import type { Category, Transaction, CategoryBudget } from '@/types'

interface QuickAddExpenseProps {
  categories: Category[]
  categoryBudgets: CategoryBudget[]
  onTransactionAdded: () => void
  budgetMonth: string // YYYY-MM
  householdMembers?: string[]
}

type TransactionMode = 'expense' | 'income'

export function QuickAddExpense({
  categories,
  categoryBudgets,
  onTransactionAdded,
  budgetMonth,
  householdMembers = [],
}: QuickAddExpenseProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<TransactionMode>('expense')
  const [amount, setAmount] = useState('')
  const [budgetGroup, setBudgetGroup] = useState<'needs' | 'wants'>('needs')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get categories based on mode
  const expenseCategories = useMemo(() => {
    return categories.filter(c => !c.isIncome)
  }, [categories])

  const incomeCategories = useMemo(() => {
    return categories.filter(c => c.isIncome)
  }, [categories])

  const currentCategories = mode === 'expense' ? expenseCategories : incomeCategories

  // Reset category when mode changes
  const handleModeChange = (newMode: TransactionMode) => {
    setMode(newMode)
    setCategoryId('')
  }

  const handleSubmit = async () => {
    if (!amount || !categoryId) return

    setIsSubmitting(true)

    try {
      const now = new Date().toISOString()
      const parsedAmount = parseFloat(amount)

      const transaction: Transaction = {
        id: uuidv4(),
        date,
        type: mode === 'income' ? 'VIREMENT_RECU' : 'PAIEMENT_CARTE',
        description: description || (mode === 'income' ? 'Revenu manuel' : 'Dépense manuelle'),
        amount: mode === 'income' ? Math.abs(parsedAmount) : -Math.abs(parsedAmount),
        category: categoryId,
        importId: `manual-${budgetMonth}`,
        isManuallyEdited: false,
        source: 'manual',
        budgetGroup: mode === 'expense' ? budgetGroup : undefined,
        assignedTo: assignedTo || undefined,
        createdAt: now,
        updatedAt: now,
      }

      await transactionService.add([transaction])

      // Reset form
      setAmount('')
      setDescription('')
      setDate(new Date().toISOString().split('T')[0])
      setCategoryId('')
      setAssignedTo('')
      setIsOpen(false)

      onTransactionAdded()
    } catch (error) {
      console.error('Failed to add transaction:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Initialize when opening
  const handleOpen = () => {
    setIsOpen(true)
  }

  // Get selected category for preview
  const selectedCategory = useMemo(() => {
    return currentCategories.find(c => c.id === categoryId)
  }, [currentCategories, categoryId])

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        aria-label="Ajouter une transaction"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <CardTitle icon={
                mode === 'expense'
                  ? <TrendingDown className="w-5 h-5 text-red-400" />
                  : <TrendingUp className="w-5 h-5 text-green-400" />
              }>
                {mode === 'expense' ? 'Nouvelle dépense' : 'Nouveau revenu'}
              </CardTitle>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Mode Toggle - Expense / Income */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleModeChange('expense')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                    mode === 'expense'
                      ? 'bg-red-500/20 text-red-400 shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-5 h-5" />
                  <span className="font-medium">Dépense</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('income')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                    mode === 'income'
                      ? 'bg-green-500/20 text-green-400 shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">Revenu</span>
                </button>
              </div>

              {/* Amount - Large input */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Montant</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full bg-gray-700 border rounded-xl px-4 py-4 text-2xl font-bold text-center focus:ring-2 focus:border-transparent ${
                      mode === 'expense'
                        ? 'border-gray-600 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-green-500'
                    }`}
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">€</span>
                </div>
              </div>

              {/* Budget Group selector - Only for expenses */}
              {mode === 'expense' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type de dépense</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBudgetGroup('needs')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        budgetGroup === 'needs'
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <Home className="w-5 h-5" />
                      <span className="font-medium">Besoins</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBudgetGroup('wants')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        budgetGroup === 'wants'
                          ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                          : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <ShoppingBag className="w-5 h-5" />
                      <span className="font-medium">Envies</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Category selector */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Catégorie</label>
                {currentCategories.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {currentCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryId(cat.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                          categoryId === cat.id
                            ? 'border-white/50 bg-white/10'
                            : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm truncate">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4 bg-gray-700/30 rounded-lg">
                    Aucune catégorie {mode === 'expense' ? 'de dépense' : 'de revenu'} disponible
                    <br />
                    <span className="text-xs">Créez des catégories dans la page Catégories</span>
                  </p>
                )}
              </div>

              {/* Description (optional) */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Description <span className="text-gray-500">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={mode === 'expense' ? 'Ex: Courses Carrefour' : 'Ex: Salaire janvier'}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Assigned To - Only show if household members exist */}
              {householdMembers.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Imputer à <span className="text-gray-500">(optionnel)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignedTo('')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm ${
                        assignedTo === ''
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                          : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Personne
                    </button>
                    {householdMembers.map(member => (
                      <button
                        key={member}
                        type="button"
                        onClick={() => setAssignedTo(member)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm ${
                          assignedTo === member
                            ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                            : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <User className="w-4 h-4" />
                        {member}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {amount && parseFloat(amount) > 0 && (
                <div className={`p-3 rounded-lg ${
                  mode === 'expense' ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 text-sm">
                        {mode === 'expense' ? 'Dépense' : 'Revenu'} à ajouter
                      </span>
                      {mode === 'expense' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          budgetGroup === 'needs'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {budgetGroup === 'needs' ? 'Besoins' : 'Envies'}
                        </span>
                      )}
                      {selectedCategory && (
                        <span className="text-xs text-gray-500">
                          • {selectedCategory.name}
                        </span>
                      )}
                      {assignedTo && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                          → {assignedTo}
                        </span>
                      )}
                    </div>
                    <span className={`font-bold text-lg ${mode === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
                      {mode === 'expense' ? '-' : '+'}{formatMoney(parseFloat(amount))}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!amount || parseFloat(amount) <= 0 || !categoryId || isSubmitting}
                  className={`flex-1 ${mode === 'income' ? '!bg-green-600 hover:!bg-green-500' : ''}`}
                >
                  {isSubmitting ? 'Ajout...' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
