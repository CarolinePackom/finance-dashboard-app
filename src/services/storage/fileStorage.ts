import { db } from '@services/db'
import type { Transaction, Category, CategorizationRule } from '@/types'

export interface DataFile {
  version: number
  exportedAt: string
  transactions: Transaction[]
  categories: Category[]
  rules: CategorizationRule[]
}

/**
 * Export all data to a JSON file that user can save locally
 */
export async function exportToFile(): Promise<void> {
  const transactions = await db.transactions.toArray()
  const categories = await db.categories.toArray()
  const rules = await db.rules.toArray()

  const data: DataFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    categories,
    rules,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-data.json`
  a.click()
  URL.revokeObjectURL(url)

  console.log(`📁 Exported ${transactions.length} transactions to file`)
}

/**
 * Import data from a JSON file
 */
export async function importFromFile(file: File): Promise<{ transactions: number; replaced: boolean }> {
  const text = await file.text()
  const data = JSON.parse(text) as DataFile

  if (!data.version || !data.transactions) {
    throw new Error('Format de fichier invalide')
  }

  // Clear existing data and import new
  await db.transactions.clear()
  await db.rules.clear()

  // Import categories (merge with defaults)
  if (data.categories && data.categories.length > 0) {
    // Fix: ensure prélèvements are included in stats (was wrongly excluded)
    const fixedCategories = data.categories.map(cat => {
      if (cat.id === 'internal') {
        return { ...cat, isExcludedFromStats: false }
      }
      return cat
    })
    await db.categories.clear()
    await db.categories.bulkAdd(fixedCategories)
  }

  // Import transactions
  if (data.transactions.length > 0) {
    await db.transactions.bulkAdd(data.transactions)
  }

  // Import rules
  if (data.rules && data.rules.length > 0) {
    await db.rules.bulkAdd(data.rules)
  }

  return {
    transactions: data.transactions.length,
    replaced: true,
  }
}

/**
 * Add transactions from a file without clearing existing data
 */
export async function mergeFromFile(file: File): Promise<{ added: number; skipped: number }> {
  const text = await file.text()
  const data = JSON.parse(text) as DataFile

  if (!data.version || !data.transactions) {
    throw new Error('Format de fichier invalide')
  }

  // Get existing transaction IDs
  const existingIds = new Set((await db.transactions.toArray()).map(t => t.id))

  // Filter out duplicates
  const newTransactions = data.transactions.filter(t => !existingIds.has(t.id))

  if (newTransactions.length > 0) {
    await db.transactions.bulkAdd(newTransactions)
  }

  console.log(`📁 Merged ${newTransactions.length} new transactions (${data.transactions.length - newTransactions.length} skipped)`)

  return {
    added: newTransactions.length,
    skipped: data.transactions.length - newTransactions.length,
  }
}

/**
 * Check if there's data in the database
 */
export async function hasData(): Promise<boolean> {
  const count = await db.transactions.count()
  return count > 0
}

/**
 * Get database stats
 */
export async function getStats(): Promise<{ transactions: number; categories: number; rules: number }> {
  return {
    transactions: await db.transactions.count(),
    categories: await db.categories.count(),
    rules: await db.rules.count(),
  }
}
