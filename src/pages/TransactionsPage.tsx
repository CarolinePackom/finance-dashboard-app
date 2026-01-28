import { useState, useCallback } from 'react'
import { useTransactions } from '@store/TransactionContext'
import { transactionService } from '@services/db'
import { TransactionList } from '@components/transactions'
import { useToast } from '@components/common'

export function TransactionsPage() {
  const { transactions, categories, bulkUpdateCategory } = useTransactions()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const toast = useToast()

  const handleClearCategory = useCallback(() => {
    setSelectedCategory(null)
  }, [])

  const handleCategoryChange = useCallback(async (transactionId: string, categoryId: string) => {
    await transactionService.update(transactionId, { category: categoryId, isManuallyEdited: true })
  }, [])

  const handleBudgetMonthChange = useCallback(async (transactionId: string, budgetMonth: string | undefined) => {
    await transactionService.update(transactionId, { budgetMonth })
    toast.success(
      'Mois budgétaire modifié',
      budgetMonth ? `Transaction comptée pour ${new Date(budgetMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : 'Transaction comptée pour son mois naturel'
    )
  }, [toast])

  const handleBulkCategoryChange = useCallback(async (transactionIds: string[], categoryId: string) => {
    const updated = await bulkUpdateCategory(transactionIds, categoryId)
    const categoryName = categories.find(c => c.id === categoryId)?.name || categoryId
    toast.success('Catégorie mise à jour', `${updated} transaction(s) déplacée(s) vers "${categoryName}"`)
  }, [bulkUpdateCategory, categories, toast])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          Toutes les transactions
        </h1>
        <p className="text-gray-400">
          {transactions.length} transactions au total
        </p>
      </div>

      <TransactionList
        transactions={transactions}
        categories={categories}
        selectedCategory={selectedCategory}
        onClearCategory={handleClearCategory}
        onCategoryChange={handleCategoryChange}
        onBudgetMonthChange={handleBudgetMonthChange}
        onBulkCategoryChange={handleBulkCategoryChange}
      />
    </div>
  )
}
