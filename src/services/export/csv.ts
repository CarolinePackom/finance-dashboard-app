import type { Transaction, Category } from '@/types'
import { formatFullDate } from '@utils/formatters'

/**
 * Export transactions to CSV format
 */
export function exportToCSV(
  transactions: Transaction[],
  categories: Category[],
  filename = 'transactions.csv'
): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  // CSV header
  const headers = ['Date', 'Description', 'Type', 'Catégorie', 'Montant']

  // CSV rows
  const rows = transactions.map((t) => [
    formatFullDate(t.date),
    `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
    t.type,
    categoryMap.get(t.category) || t.category,
    t.amount.toFixed(2).replace('.', ','), // French decimal separator
  ])

  // Combine header and rows
  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n')

  // Create and download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Export monthly summary to CSV
 */
export function exportMonthlySummaryCSV(
  stats: { month: string; income: number; expenses: number; balance: number }[],
  filename = 'resume-mensuel.csv'
): void {
  const headers = ['Mois', 'Revenus', 'Dépenses', 'Balance']

  const rows = stats.map((s) => [
    s.month,
    s.income.toFixed(2).replace('.', ','),
    s.expenses.toFixed(2).replace('.', ','),
    s.balance.toFixed(2).replace('.', ','),
  ])

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
