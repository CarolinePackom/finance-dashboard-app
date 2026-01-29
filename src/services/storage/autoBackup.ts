import { db } from '@services/db'
import type { Transaction, Category, CategorizationRule, CategoryBudget, MonthlyBudgetConfig, SavingsGoal, AssetAccount } from '@/types'

const BACKUP_KEY = 'finance-tracker-backup'
const BACKUP_VERSION = 2
const UNSAVED_CHANGES_KEY = 'finance-unsaved-changes'

interface BackupData {
  version: number
  savedAt: string
  transactions: Transaction[]
  categories: Category[]
  rules: CategorizationRule[]
  categoryBudgets?: CategoryBudget[]
  monthlyBudgetConfigs?: MonthlyBudgetConfig[]
  savingsGoals?: SavingsGoal[]
  assetAccounts?: AssetAccount[]
  settings?: { key: string; value: unknown }[]
}

// Store the file handle for auto-save
let fileHandle: FileSystemFileHandle | null = null

/**
 * Compress string using LZ-based compression for localStorage
 */
function compress(str: string): string {
  // Simple compression: store as base64 of JSON
  // For larger datasets, could use lz-string library
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    return str
  }
}

/**
 * Decompress string
 */
function decompress(str: string): string {
  try {
    return decodeURIComponent(escape(atob(str)))
  } catch {
    return str
  }
}

/**
 * Save current database state to localStorage as backup
 */
export async function createAutoBackup(): Promise<void> {
  try {
    const transactions = await db.transactions.toArray()
    const categories = await db.categories.toArray()
    const rules = await db.rules.toArray()
    const categoryBudgets = await db.categoryBudgets.toArray()
    const monthlyBudgetConfigs = await db.monthlyBudgetConfigs.toArray()
    const savingsGoals = await db.savingsGoals.toArray()
    const assetAccounts = await db.assetAccounts.toArray()
    const settings = await db.settings.toArray()

    // Only backup if there's data (transactions OR patrimoine)
    if (transactions.length === 0 && assetAccounts.length === 0) {
      console.log('⏭️ No data to backup')
      return
    }

    const backup: BackupData = {
      version: BACKUP_VERSION,
      savedAt: new Date().toISOString(),
      transactions,
      categories,
      rules,
      categoryBudgets,
      monthlyBudgetConfigs,
      savingsGoals,
      assetAccounts,
      settings: settings.map(s => ({ key: s.key, value: s.value })),
    }

    const json = JSON.stringify(backup)
    const compressed = compress(json)

    // Check if it fits in localStorage (usually 5-10MB limit)
    const sizeInMB = (compressed.length * 2) / (1024 * 1024)
    if (sizeInMB > 4) {
      console.warn(`⚠️ Backup too large (${sizeInMB.toFixed(2)}MB), skipping localStorage backup`)
      return
    }

    localStorage.setItem(BACKUP_KEY, compressed)
    console.log(`✅ Auto-backup created: ${transactions.length} transactions, ${assetAccounts.length} accounts (${sizeInMB.toFixed(2)}MB)`)
  } catch (err) {
    console.error('❌ Failed to create auto-backup:', err)
  }
}

/**
 * Check if a backup exists in localStorage
 */
export function hasBackup(): boolean {
  return localStorage.getItem(BACKUP_KEY) !== null
}

/**
 * Get backup info without fully parsing
 */
export function getBackupInfo(): { savedAt: string; transactionCount: number; accountCount?: number } | null {
  try {
    const compressed = localStorage.getItem(BACKUP_KEY)
    if (!compressed) return null

    const json = decompress(compressed)
    const backup = JSON.parse(json) as BackupData

    return {
      savedAt: backup.savedAt,
      transactionCount: (backup.transactions?.length || 0) + (backup.assetAccounts?.length || 0),
      accountCount: backup.assetAccounts?.length || 0,
    }
  } catch {
    return null
  }
}

/**
 * Restore database from localStorage backup
 */
export async function restoreFromBackup(): Promise<{ transactions: number; restored: boolean }> {
  try {
    const compressed = localStorage.getItem(BACKUP_KEY)
    if (!compressed) {
      return { transactions: 0, restored: false }
    }

    const json = decompress(compressed)
    const backup = JSON.parse(json) as BackupData

    if (!backup.version) {
      console.error('❌ Invalid backup format')
      return { transactions: 0, restored: false }
    }

    // Clear and restore core tables
    await db.transactions.clear()
    await db.categories.clear()
    await db.rules.clear()

    if (backup.categories && backup.categories.length > 0) {
      await db.categories.bulkAdd(backup.categories)
    }

    if (backup.transactions && backup.transactions.length > 0) {
      await db.transactions.bulkAdd(backup.transactions)
    }

    if (backup.rules && backup.rules.length > 0) {
      await db.rules.bulkAdd(backup.rules)
    }

    // Restore budget data
    if (backup.categoryBudgets && backup.categoryBudgets.length > 0) {
      await db.categoryBudgets.clear()
      await db.categoryBudgets.bulkAdd(backup.categoryBudgets)
    }

    if (backup.monthlyBudgetConfigs && backup.monthlyBudgetConfigs.length > 0) {
      await db.monthlyBudgetConfigs.clear()
      await db.monthlyBudgetConfigs.bulkAdd(backup.monthlyBudgetConfigs)
    }

    if (backup.savingsGoals && backup.savingsGoals.length > 0) {
      await db.savingsGoals.clear()
      await db.savingsGoals.bulkAdd(backup.savingsGoals)
    }

    // Restore patrimoine data
    if (backup.assetAccounts && backup.assetAccounts.length > 0) {
      await db.assetAccounts.clear()
      await db.assetAccounts.bulkAdd(backup.assetAccounts)
    }

    // Restore settings
    if (backup.settings && backup.settings.length > 0) {
      await db.settings.clear()
      for (const setting of backup.settings) {
        await db.settings.add({ id: setting.key, key: setting.key, value: setting.value })
      }
    }

    const totalItems = (backup.transactions?.length || 0) + (backup.assetAccounts?.length || 0)
    console.log(`✅ Restored ${backup.transactions?.length || 0} transactions, ${backup.assetAccounts?.length || 0} accounts from backup`)

    return {
      transactions: totalItems,
      restored: true,
    }
  } catch (err) {
    console.error('❌ Failed to restore from backup:', err)
    return { transactions: 0, restored: false }
  }
}

/**
 * Clear the backup from localStorage
 */
export function clearBackup(): void {
  localStorage.removeItem(BACKUP_KEY)
  console.log('🗑️ Backup cleared')
}

/**
 * Check if IndexedDB is empty and backup exists, then restore
 * Returns true if restoration happened
 */
export async function checkAndRestoreIfNeeded(): Promise<boolean> {
  try {
    const transactionCount = await db.transactions.count()
    const accountCount = await db.assetAccounts.count()

    // If we have any data, no need to restore
    if (transactionCount > 0 || accountCount > 0) {
      return false
    }

    // Check if backup exists
    if (!hasBackup()) {
      return false
    }

    const backupInfo = getBackupInfo()
    if (!backupInfo || backupInfo.transactionCount === 0) {
      return false
    }

    console.log(`🔄 IndexedDB empty but backup found (${backupInfo.transactionCount} items from ${backupInfo.savedAt})`)

    const result = await restoreFromBackup()
    return result.restored
  } catch (err) {
    console.error('❌ Error checking/restoring backup:', err)
    return false
  }
}

// ============================================
// File System Auto-Save
// ============================================

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window
}

/**
 * Let user pick a file location for auto-save
 * Returns true if successful
 */
export async function setupAutoSaveLocation(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) {
    console.warn('File System Access API not supported')
    return false
  }

  try {
    // Show save file picker
    fileHandle = await (window as any).showSaveFilePicker({
      suggestedName: 'finance-backup.json',
      types: [{
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] },
      }],
    })

    // Do initial save
    await saveToFile()

    console.log('✅ Auto-save location configured')
    return true
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('❌ Failed to setup auto-save location:', err)
    }
    return false
  }
}

/**
 * Check if auto-save is configured
 */
export function hasAutoSaveLocation(): boolean {
  return fileHandle !== null
}

/**
 * Save data to the configured file
 */
export async function saveToFile(): Promise<boolean> {
  if (!fileHandle) {
    console.warn('No file handle configured for auto-save')
    return false
  }

  try {
    const transactions = await db.transactions.toArray()
    const categories = await db.categories.toArray()
    const rules = await db.rules.toArray()
    const categoryBudgets = await db.categoryBudgets.toArray()
    const monthlyBudgetConfigs = await db.monthlyBudgetConfigs.toArray()
    const savingsGoals = await db.savingsGoals.toArray()
    const assetAccounts = await db.assetAccounts.toArray()
    const settings = await db.settings.toArray()

    const backup: BackupData = {
      version: BACKUP_VERSION,
      savedAt: new Date().toISOString(),
      transactions,
      categories,
      rules,
      categoryBudgets,
      monthlyBudgetConfigs,
      savingsGoals,
      assetAccounts,
      settings: settings.map(s => ({ key: s.key, value: s.value })),
    }

    const json = JSON.stringify(backup, null, 2)

    // Write to file
    const writable = await fileHandle.createWritable()
    await writable.write(json)
    await writable.close()

    console.log(`💾 Auto-saved to file: ${transactions.length} transactions`)
    return true
  } catch (err) {
    console.error('❌ Failed to auto-save to file:', err)
    // If permission was revoked, clear the handle
    if ((err as Error).name === 'NotAllowedError') {
      fileHandle = null
    }
    return false
  }
}

/**
 * Auto-save on every data change (debounced)
 */
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null

export function triggerAutoSave(): void {
  // Mark as having unsaved changes
  markUnsavedChanges()

  // Always create localStorage backup
  createAutoBackup()

  // If File System Access API is available and configured, use it
  if (fileHandle) {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
    }
    autoSaveTimeout = setTimeout(async () => {
      await saveToFile()
      clearUnsavedChanges()
    }, 2000)
  }
}

/**
 * Get current auto-save file name
 */
export function getAutoSaveFileName(): string | null {
  return fileHandle?.name || null
}

// ============================================
// Unsaved Changes Tracking
// ============================================

/**
 * Mark that there are unsaved changes
 */
export function markUnsavedChanges(): void {
  localStorage.setItem(UNSAVED_CHANGES_KEY, Date.now().toString())
}

/**
 * Clear unsaved changes marker
 */
export function clearUnsavedChanges(): void {
  localStorage.removeItem(UNSAVED_CHANGES_KEY)
}

/**
 * Check if there are unsaved changes
 */
export function hasUnsavedChanges(): boolean {
  return localStorage.getItem(UNSAVED_CHANGES_KEY) !== null
}

/**
 * Get timestamp of last unsaved change
 */
export function getUnsavedChangesTime(): number | null {
  const stored = localStorage.getItem(UNSAVED_CHANGES_KEY)
  return stored ? parseInt(stored, 10) : null
}

/**
 * Download backup file (manual download)
 */
export async function downloadBackup(): Promise<boolean> {
  try {
    const transactions = await db.transactions.toArray()
    const categories = await db.categories.toArray()
    const rules = await db.rules.toArray()
    const categoryBudgets = await db.categoryBudgets.toArray()
    const monthlyBudgetConfigs = await db.monthlyBudgetConfigs.toArray()
    const savingsGoals = await db.savingsGoals.toArray()
    const assetAccounts = await db.assetAccounts.toArray()
    const settings = await db.settings.toArray()

    if (transactions.length === 0) {
      console.log('⏭️ No transactions to backup')
      return false
    }

    const backup: BackupData = {
      version: BACKUP_VERSION,
      savedAt: new Date().toISOString(),
      transactions,
      categories,
      rules,
      categoryBudgets,
      monthlyBudgetConfigs,
      savingsGoals,
      assetAccounts,
      settings: settings.map(s => ({ key: s.key, value: s.value })),
    }

    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'finance-backup.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Clear unsaved changes after successful download
    clearUnsavedChanges()

    console.log(`💾 Downloaded backup: ${transactions.length} transactions`)
    return true
  } catch (err) {
    console.error('❌ Failed to download backup:', err)
    return false
  }
}
