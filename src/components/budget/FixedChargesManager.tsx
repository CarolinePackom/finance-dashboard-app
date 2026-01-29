import { useState, useMemo } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Repeat,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardTitle, Button } from '@components/common'
import { formatMoney } from '@utils/formatters'
import type { FixedCharge, Category } from '@/types'

interface FixedChargesManagerProps {
  charges: FixedCharge[]
  categories: Category[]
  onChange: (charges: FixedCharge[]) => void
  isReadOnly?: boolean
}

// Suggested charges for quick add
const SUGGESTED_CHARGES = [
  { name: 'Loyer', categoryId: 'housing', icon: 'home' },
  { name: 'Électricité', categoryId: 'housing', icon: 'energy' },
  { name: 'Gaz', categoryId: 'housing', icon: 'energy' },
  { name: 'Internet', categoryId: 'telecom', icon: 'phone' },
  { name: 'Téléphone', categoryId: 'telecom', icon: 'phone' },
  { name: 'Assurance habitation', categoryId: 'bank-fees', icon: 'shield' },
  { name: 'Assurance auto', categoryId: 'transport', icon: 'car' },
  { name: 'Mutuelle', categoryId: 'health', icon: 'shield' },
  { name: 'Transport', categoryId: 'transport', icon: 'car' },
  { name: 'Abonnement salle de sport', categoryId: 'entertainment', icon: 'repeat' },
  { name: 'Netflix', categoryId: 'abonnements', icon: 'repeat' },
  { name: 'Spotify', categoryId: 'abonnements', icon: 'repeat' },
]

export function FixedChargesManager({
  charges,
  categories,
  onChange,
  isReadOnly = false,
}: FixedChargesManagerProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Form state for new/edit charge
  const [formName, setFormName] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')

  const expenseCategories = useMemo(() =>
    categories.filter(c => !c.isIncome),
    [categories]
  )

  const categoryMap = useMemo(() =>
    new Map(categories.map(c => [c.id, c])),
    [categories]
  )

  const totalEnabled = useMemo(() =>
    charges.filter(c => c.isEnabled).reduce((sum, c) => sum + c.amount, 0),
    [charges]
  )

  const totalDisabled = useMemo(() =>
    charges.filter(c => !c.isEnabled).reduce((sum, c) => sum + c.amount, 0),
    [charges]
  )

  const handleAdd = () => {
    if (!formName.trim() || !formAmount || !formCategory) return

    const newCharge: FixedCharge = {
      key: `custom-${Date.now()}`,
      name: formName.trim(),
      amount: parseFloat(formAmount),
      categoryId: formCategory,
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

    onChange(charges.map(c =>
      c.key === editingId
        ? { ...c, name: formName.trim(), amount: parseFloat(formAmount), categoryId: formCategory }
        : c
    ))
    resetForm()
  }

  const handleDelete = (key: string) => {
    onChange(charges.filter(c => c.key !== key))
  }

  const handleToggle = (key: string) => {
    onChange(charges.map(c =>
      c.key === key ? { ...c, isEnabled: !c.isEnabled } : c
    ))
  }

  const handleAddSuggestion = (suggestion: typeof SUGGESTED_CHARGES[0]) => {
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

  // Get suggestions that aren't already added
  const availableSuggestions = useMemo(() =>
    SUGGESTED_CHARGES.filter(s =>
      !charges.some(c => c.name.toLowerCase() === s.name.toLowerCase())
    ),
    [charges]
  )

  return (
    <Card>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle icon={<Repeat className="w-5 h-5 text-blue-400" />}>
          Charges fixes mensuelles
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({charges.filter(c => c.isEnabled).length} actives)
          </span>
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-red-400">
            -{formatMoney(totalEnabled)}
          </span>
          <button className="p-1 hover:bg-gray-700 rounded transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Charges list */}
          {charges.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Repeat className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune charge fixe configurée</p>
              <p className="text-sm mt-1">Ajoute tes dépenses récurrentes mensuelles</p>
            </div>
          ) : (
            <div className="space-y-2">
              {charges.map(charge => {
                const category = categoryMap.get(charge.categoryId)
                const isEditing = editingId === charge.key

                if (isEditing) {
                  return (
                    <div
                      key={charge.key}
                      className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Nom de la charge"
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                          autoFocus
                        />
                        <div className="relative">
                          <input
                            type="number"
                            value={formAmount}
                            onChange={(e) => setFormAmount(e.target.value)}
                            placeholder="Montant"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                        </div>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Catégorie...</option>
                          {expenseCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="ghost" size="sm" onClick={resetForm}>
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={!formName.trim() || !formAmount || !formCategory}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={charge.key}
                    className={`group p-3 rounded-xl border transition-all ${
                      charge.isEnabled
                        ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                        : 'bg-gray-900/30 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(charge.key)}
                        disabled={isReadOnly}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          charge.isEnabled
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        {charge.isEnabled && <Check className="w-3 h-3 text-white" />}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${charge.isEnabled ? 'text-white' : 'text-gray-500 line-through'}`}>
                            {charge.name}
                          </span>
                          {category && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${category.color}20`,
                                color: category.color,
                              }}
                            >
                              {category.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <span className={`font-bold ${charge.isEnabled ? 'text-red-400' : 'text-gray-600'}`}>
                        -{formatMoney(charge.amount)}
                      </span>

                      {/* Actions */}
                      {!isReadOnly && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(charge)}
                            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(charge.key)}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add form */}
          {showAddForm && !editingId && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-sm text-green-400 mb-3 font-medium">Nouvelle charge fixe</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nom (ex: Loyer)"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  autoFocus
                />
                <div className="relative">
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="Montant"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Catégorie...</option>
                  {expenseCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAdd}
                  disabled={!formName.trim() || !formAmount || !formCategory}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && availableSuggestions.length > 0 && (
            <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
              <p className="text-sm text-gray-400 mb-3">Suggestions de charges courantes :</p>
              <div className="flex flex-wrap gap-2">
                {availableSuggestions.slice(0, 8).map(suggestion => (
                  <button
                    key={suggestion.name}
                    onClick={() => handleAddSuggestion(suggestion)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3 text-green-400" />
                    {suggestion.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="mt-3 text-xs text-gray-500 hover:text-gray-400"
              >
                Fermer les suggestions
              </button>
            </div>
          )}

          {/* Add buttons */}
          {!isReadOnly && !showAddForm && !editingId && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAddForm(true)
                  setShowSuggestions(false)
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Ajouter une charge
              </Button>
              {availableSuggestions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSuggestions(!showSuggestions)
                    setShowAddForm(false)
                  }}
                >
                  {showSuggestions ? 'Masquer' : 'Suggestions'}
                </Button>
              )}
            </div>
          )}

          {/* Summary */}
          {charges.length > 0 && (
            <div className="pt-3 mt-3 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total des charges actives</span>
                <span className="text-xl font-bold text-red-400">-{formatMoney(totalEnabled)}</span>
              </div>
              {totalDisabled > 0 && (
                <div className="flex justify-between items-center mt-1 text-sm">
                  <span className="text-gray-500">Charges désactivées</span>
                  <span className="text-gray-500">-{formatMoney(totalDisabled)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
