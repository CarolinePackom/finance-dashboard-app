import { useState, useMemo } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { Card, CardTitle, Button } from '@components/common'
import { formatMoney } from '@utils/formatters'
import type { Transaction, Category } from '@/types'

interface EditTransactionModalProps {
  transaction: Transaction
  categories: Category[]
  onSave: (id: string, updates: Partial<Transaction>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export function EditTransactionModal({
  transaction,
  categories,
  onSave,
  onDelete,
  onClose,
}: EditTransactionModalProps) {
  const [description, setDescription] = useState(transaction.description)
  const [amount, setAmount] = useState(Math.abs(transaction.amount).toString())
  const [date, setDate] = useState(transaction.date)
  const [categoryId, setCategoryId] = useState(transaction.category)
  const [isExpense, setIsExpense] = useState(transaction.amount < 0)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const expenseCategories = useMemo(() =>
    categories.filter(c => !c.isIncome),
    [categories]
  )

  const incomeCategories = useMemo(() =>
    categories.filter(c => c.isIncome),
    [categories]
  )

  const currentCategories = isExpense ? expenseCategories : incomeCategories

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    setSaving(true)
    try {
      await onSave(transaction.id, {
        description,
        amount: isExpense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
        date,
        category: categoryId,
        isManuallyEdited: true,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await onDelete(transaction.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleTypeChange = (expense: boolean) => {
    setIsExpense(expense)
    // Reset category when switching type
    const cats = expense ? expenseCategories : incomeCategories
    if (cats.length > 0 && !cats.find(c => c.id === categoryId)) {
      setCategoryId(cats[0].id)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <CardTitle icon={<Save className="w-5 h-5 text-blue-400" />}>
            Modifier la transaction
          </CardTitle>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {showDeleteConfirm ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 font-medium mb-2">Confirmer la suppression</p>
              <p className="text-sm text-gray-400">
                Cette transaction sera définitivement supprimée :
              </p>
              <p className="text-sm text-white mt-2">
                {transaction.description} • {formatMoney(transaction.amount)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={saving}
                className="flex-1"
              >
                Supprimer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange(true)}
                className={`py-2 rounded-lg transition-all text-sm font-medium ${
                  isExpense
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Dépense
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange(false)}
                className={`py-2 rounded-lg transition-all text-sm font-medium ${
                  !isExpense
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Revenu
              </button>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Montant</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-8"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Catégorie</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
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
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={saving}
                disabled={!description.trim() || !amount || parseFloat(amount) <= 0}
                className="flex-1"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
