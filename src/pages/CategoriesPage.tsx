import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from 'lucide-react'
import { Card, CardTitle, Button } from '@components/common'
import { useTransactions } from '@store/TransactionContext'
import { categoryService } from '@services/db'
import type { Category } from '@/types'
const PRESET_COLORS = [
  '#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ec4899',
  '#eab308', '#14b8a6', '#ef4444', '#6b7280', '#10b981',
  '#22d3ee', '#84cc16', '#f43f5e', '#8b5cf6', '#94a3b8',
]

interface CategoryFormData {
  name: string
  color: string
  icon: string
  isIncome: boolean
  isExcludedFromStats: boolean
}

const defaultFormData: CategoryFormData = {
  name: '',
  color: '#3b82f6',
  icon: 'MoreHorizontal',
  isIncome: false,
  isExcludedFromStats: false,
}

export function CategoriesPage() {
  const { categories } = useTransactions()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const expenseCategories = categories.filter(c => !c.isIncome)
  const incomeCategories = categories.filter(c => c.isIncome)

  const handleEdit = useCallback((category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      color: category.color,
      icon: category.icon,
      isIncome: category.isIncome,
      isExcludedFromStats: category.isExcludedFromStats,
    })
    setIsAdding(false)
  }, [])

  const handleAdd = useCallback(() => {
    setIsAdding(true)
    setEditingId(null)
    setFormData(defaultFormData)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingId(null)
    setIsAdding(false)
    setFormData(defaultFormData)
  }, [])

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) return

    if (isAdding) {
      const newCategory: Category = {
        id: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color,
        isIncome: formData.isIncome,
        isExcludedFromStats: formData.isExcludedFromStats,
        order: categories.length + 1,
        isDefault: false,
        createdAt: new Date().toISOString(),
      }
      await categoryService.add(newCategory)
    } else if (editingId) {
      await categoryService.update(editingId, {
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color,
        isIncome: formData.isIncome,
        isExcludedFromStats: formData.isExcludedFromStats,
      })
    }

    handleCancel()
  }, [formData, isAdding, editingId, categories.length, handleCancel])

  const handleDelete = useCallback(async (id: string) => {
    await categoryService.delete(id)
    setDeleteConfirm(null)
  }, [])

  const handleToggleExcluded = useCallback(async (category: Category) => {
    await categoryService.update(category.id, {
      isExcludedFromStats: !category.isExcludedFromStats,
    })
  }, [])

  const renderCategoryRow = (category: Category) => {
    const isEditing = editingId === category.id

    if (isEditing) {
      return (
        <div key={category.id} className="bg-gray-700/50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.isIncome ? 'income' : 'expense'}
                onChange={(e) => setFormData(prev => ({ ...prev, isIncome: e.target.value === 'income' }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="expense">Depense</option>
                <option value="income">Revenu</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === color ? 'ring-2 ring-white scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Couleur ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`excluded-${category.id}`}
              checked={formData.isExcludedFromStats}
              onChange={(e) => setFormData(prev => ({ ...prev, isExcludedFromStats: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor={`excluded-${category.id}`} className="text-sm text-gray-400">
              Exclure des statistiques
            </label>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} leftIcon={<Check className="w-4 h-4" />}>
              Enregistrer
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} leftIcon={<X className="w-4 h-4" />}>
              Annuler
            </Button>
          </div>
        </div>
      )
    }

    if (deleteConfirm === category.id) {
      return (
        <div key={category.id} className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-sm text-gray-300 mb-3">
            Supprimer la categorie "{category.name}" ?
            {category.isDefault && (
              <span className="text-yellow-400 block mt-1">
                Cette categorie est utilisee par defaut.
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => handleDelete(category.id)}>
              Supprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div
        key={category.id}
        className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <span className="text-lg">{category.icon.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-white">{category.name}</p>
            <p className="text-xs text-gray-500">
              {category.isExcludedFromStats ? 'Exclu des stats' : 'Inclus dans les stats'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleExcluded(category)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={category.isExcludedFromStats ? 'Inclure dans les stats' : 'Exclure des stats'}
          >
            {category.isExcludedFromStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleEdit(category)}
            className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm(category.id)}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            Categories
          </h1>
          <p className="text-gray-400">Gerez vos categories de transactions</p>
        </div>
        <Button
          variant="primary"
          onClick={handleAdd}
          leftIcon={<Plus className="w-4 h-4" />}
          disabled={isAdding}
        >
          Ajouter
        </Button>
      </div>

      {/* Add new category form */}
      {isAdding && (
        <Card className="border-blue-500/50">
          <CardTitle>Nouvelle categorie</CardTitle>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Ex: Vacances"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  value={formData.isIncome ? 'income' : 'expense'}
                  onChange={(e) => setFormData(prev => ({ ...prev, isIncome: e.target.value === 'income' }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="expense">Depense</option>
                  <option value="income">Revenu</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      formData.color === color ? 'ring-2 ring-white scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Couleur ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="excluded-new"
                checked={formData.isExcludedFromStats}
                onChange={(e) => setFormData(prev => ({ ...prev, isExcludedFromStats: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="excluded-new" className="text-sm text-gray-400">
                Exclure des statistiques (ex: virements internes)
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSave} disabled={!formData.name.trim()}>
                Creer la categorie
              </Button>
              <Button variant="ghost" onClick={handleCancel}>
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Expense categories */}
      <Card>
        <CardTitle>Depenses ({expenseCategories.length})</CardTitle>
        <div className="space-y-2 mt-4">
          {expenseCategories.map(renderCategoryRow)}
        </div>
      </Card>

      {/* Income categories */}
      <Card>
        <CardTitle>Revenus ({incomeCategories.length})</CardTitle>
        <div className="space-y-2 mt-4">
          {incomeCategories.map(renderCategoryRow)}
        </div>
      </Card>

      {/* Help */}
      <Card>
        <h2 className="font-semibold mb-3">A propos des categories</h2>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <Eye className="w-4 h-4 mt-0.5 text-blue-400" />
            <span>Les categories incluses apparaissent dans les statistiques et graphiques</span>
          </li>
          <li className="flex items-start gap-2">
            <EyeOff className="w-4 h-4 mt-0.5 text-gray-500" />
            <span>Les categories exclues (virements internes) ne sont pas comptees</span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
