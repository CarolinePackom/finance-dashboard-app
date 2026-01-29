import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Check, Repeat } from 'lucide-react'
import { formatMoney } from '@utils/formatters'
import type { FixedCharge, Category, BudgetGroupType } from '@/types'

interface InlineFixedChargesProps {
  charges: FixedCharge[]
  budgetGroup: BudgetGroupType
  categories: Category[]
  onChange: (charges: FixedCharge[]) => void
  groupColor: string
}

// Suggested charges by group
const SUGGESTED_BY_GROUP: Record<BudgetGroupType, Array<{ name: string; categoryId: string }>> = {
  needs: [
    { name: 'Loyer', categoryId: 'housing' },
    { name: 'Électricité', categoryId: 'housing' },
    { name: 'Gaz', categoryId: 'housing' },
    { name: 'Eau', categoryId: 'housing' },
    { name: 'Internet', categoryId: 'telecom' },
    { name: 'Téléphone', categoryId: 'telecom' },
    { name: 'Assurance habitation', categoryId: 'bank-fees' },
    { name: 'Assurance auto', categoryId: 'transport' },
    { name: 'Mutuelle', categoryId: 'health' },
    { name: 'Transport (abonnement)', categoryId: 'transport' },
  ],
  wants: [
    { name: 'Netflix', categoryId: 'abonnements' },
    { name: 'Spotify', categoryId: 'abonnements' },
    { name: 'Disney+', categoryId: 'abonnements' },
    { name: 'Amazon Prime', categoryId: 'abonnements' },
    { name: 'Salle de sport', categoryId: 'entertainment' },
    { name: 'PlayStation Plus', categoryId: 'abonnements' },
    { name: 'Apple Music', categoryId: 'abonnements' },
    { name: 'YouTube Premium', categoryId: 'abonnements' },
  ],
  savings: [],
}

export function InlineFixedCharges({
  charges,
  budgetGroup,
  categories,
  onChange,
  groupColor,
}: InlineFixedChargesProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')

  // Show all charges (no filtering by group since fixed charges are only in Besoins)
  const groupCharges = charges

  const enabledCharges = useMemo(
    () => groupCharges.filter(c => c.isEnabled),
    [groupCharges]
  )

  const totalEnabled = useMemo(
    () => enabledCharges.reduce((sum, c) => sum + c.amount, 0),
    [enabledCharges]
  )

  const expenseCategories = useMemo(
    () => categories.filter(c => !c.isIncome),
    [categories]
  )

  const categoryMap = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories]
  )

  const availableSuggestions = useMemo(() => {
    const suggestions = SUGGESTED_BY_GROUP[budgetGroup] || []
    return suggestions.filter(
      s => !charges.some(c => c.name.toLowerCase() === s.name.toLowerCase())
    )
  }, [budgetGroup, charges])

  const handleAdd = () => {
    if (!formName.trim() || !formAmount || !formCategory) return

    // FixedCharge.budgetGroup only allows 'needs' | 'wants', not 'savings'
    const fixedChargeBudgetGroup = budgetGroup === 'savings' ? undefined : budgetGroup

    const newCharge: FixedCharge = {
      key: `${budgetGroup}-${Date.now()}`,
      name: formName.trim(),
      amount: parseFloat(formAmount),
      categoryId: formCategory,
      budgetGroup: fixedChargeBudgetGroup,
      isEnabled: true,
    }

    onChange([...charges, newCharge])
    resetForm()
  }

  const handleEdit = (charge: FixedCharge) => {
    setEditingId(charge.key)
    setFormName(charge.name)
    setFormAmount(charge.amount.toString())
    setFormCategory(charge.categoryId)
    setShowAddForm(false)
  }

  const handleSaveEdit = () => {
    if (!editingId || !formName.trim() || !formAmount || !formCategory) return

    onChange(
      charges.map(c =>
        c.key === editingId
          ? { ...c, name: formName.trim(), amount: parseFloat(formAmount), categoryId: formCategory }
          : c
      )
    )
    resetForm()
  }

  const handleDelete = (key: string) => {
    onChange(charges.filter(c => c.key !== key))
  }

  const handleToggle = (key: string) => {
    onChange(charges.map(c => (c.key === key ? { ...c, isEnabled: !c.isEnabled } : c)))
  }

  const handleAddSuggestion = (suggestion: { name: string; categoryId: string }) => {
    setFormName(suggestion.name)
    setFormCategory(suggestion.categoryId)
    setFormAmount('')
    setShowSuggestions(false)
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormName('')
    setFormAmount('')
    setFormCategory('')
    setEditingId(null)
    setShowAddForm(false)
    setShowSuggestions(false)
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4" style={{ color: groupColor }} />
          <span className="text-sm font-medium text-gray-300">Charges fixes</span>
          {enabledCharges.length > 0 && (
            <span className="text-xs text-gray-500">({enabledCharges.length})</span>
          )}
        </div>
        {totalEnabled > 0 && (
          <span className="text-sm font-semibold text-red-400">-{formatMoney(totalEnabled)}</span>
        )}
      </div>

      {/* Charges list */}
      {groupCharges.length > 0 ? (
        <div className="space-y-1.5">
          {groupCharges.map(charge => {
            const category = categoryMap.get(charge.categoryId)
            const isEditing = editingId === charge.key

            if (isEditing) {
              return (
                <div key={charge.key} className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Nom"
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                      autoFocus
                    />
                    <div className="relative">
                      <input
                        type="number"
                        value={formAmount}
                        onChange={e => setFormAmount(e.target.value)}
                        placeholder="Montant"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm pr-6"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                        €
                      </span>
                    </div>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="">Catégorie</option>
                      {expenseCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={resetForm}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!formName.trim() || !formAmount || !formCategory}
                      className="p-1 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 text-green-400" />
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={charge.key}
                className={`group flex items-center gap-2 p-2 rounded-lg transition-all ${
                  charge.isEnabled
                    ? 'bg-gray-800/50 hover:bg-gray-800'
                    : 'bg-gray-900/30 opacity-50'
                }`}
              >
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(charge.key)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                    charge.isEnabled ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                  }`}
                >
                  {charge.isEnabled && <Check className="w-2.5 h-2.5 text-white" />}
                </button>

                {/* Name & category */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${charge.isEnabled ? 'text-white' : 'text-gray-500 line-through'}`}
                  >
                    {charge.name}
                  </span>
                  {category && (
                    <span
                      className="ml-2 text-xs px-1 py-0.5 rounded"
                      style={{ backgroundColor: `${category.color}20`, color: category.color }}
                    >
                      {category.name}
                    </span>
                  )}
                </div>

                {/* Amount */}
                <span
                  className={`text-sm font-medium flex-shrink-0 ${
                    charge.isEnabled ? 'text-red-400' : 'text-gray-600'
                  }`}
                >
                  -{formatMoney(charge.amount)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(charge)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="w-3 h-3 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(charge.key)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : !showAddForm && !showSuggestions ? (
        <p className="text-xs text-gray-500 italic">Aucune charge fixe</p>
      ) : null}

      {/* Add form */}
      {showAddForm && !editingId && (
        <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Nom"
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
              autoFocus
            />
            <div className="relative">
              <input
                type="number"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                placeholder="Montant"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm pr-6"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">€</span>
            </div>
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
            >
              <option value="">Catégorie</option>
              {expenseCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={resetForm} className="p-1 hover:bg-gray-700 rounded transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={handleAdd}
              disabled={!formName.trim() || !formAmount || !formCategory}
              className="p-1 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-green-400" />
            </button>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableSuggestions.slice(0, 6).map(suggestion => (
            <button
              key={suggestion.name}
              onClick={() => handleAddSuggestion(suggestion)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3 text-green-400" />
              {suggestion.name}
            </button>
          ))}
        </div>
      )}

      {/* Add buttons */}
      {!showAddForm && !editingId && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              setShowAddForm(true)
              setShowSuggestions(false)
            }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
          {availableSuggestions.length > 0 && (
            <button
              onClick={() => {
                setShowSuggestions(!showSuggestions)
                setShowAddForm(false)
              }}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              {showSuggestions ? 'Masquer' : 'Suggestions'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
