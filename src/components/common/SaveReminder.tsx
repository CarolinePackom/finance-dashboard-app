import { useState, useEffect, useCallback } from 'react'
import { Save, X, AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { exportToFile } from '@services/storage/fileStorage'
import { hasBackup, getBackupInfo, hasUnsavedChanges, clearUnsavedChanges } from '@services/storage/autoBackup'
import { db } from '@services/db'

const LAST_SAVE_KEY = 'finance-tracker-last-save'
const REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 days (since we have auto-backup now)

export function SaveReminder() {
  const [showReminder, setShowReminder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transactionCount, setTransactionCount] = useState(0)

  useEffect(() => {
    async function checkSaveStatus() {
      // Check if there are transactions
      const count = await db.transactions.count()
      setTransactionCount(count)

      if (count === 0) return

      // Check if auto-backup exists
      const backupExists = hasBackup()

      // If we have auto-backup, data is safe - less urgent to save to file
      if (backupExists) {
        const backupInfo = getBackupInfo()
        if (backupInfo) {
          console.log(`✅ Auto-backup exists: ${backupInfo.transactionCount} transactions from ${backupInfo.savedAt}`)
        }
      }

      // Check last manual save time
      const lastSave = localStorage.getItem(LAST_SAVE_KEY)
      const lastSaveTime = lastSave ? parseInt(lastSave, 10) : 0
      const now = Date.now()

      // Show reminder if never manually saved or more than 7 days ago
      // (less urgent since we have auto-backup)
      if (!lastSave || now - lastSaveTime > REMINDER_INTERVAL) {
        // Only show if no auto-backup or auto-backup is old
        if (!backupExists) {
          setShowReminder(true)
        }
      }
    }

    // Delay check to avoid blocking initial render
    const timer = setTimeout(checkSaveStatus, 2000)
    return () => clearTimeout(timer)
  }, [])

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault()
        // Modern browsers require returnValue to be set
        e.returnValue = 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await exportToFile()
      localStorage.setItem(LAST_SAVE_KEY, Date.now().toString())
      clearUnsavedChanges()
      setShowReminder(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    // Don't save timestamp, will remind again on next session
    setShowReminder(false)
  }, [])

  const handleDismissForDay = useCallback(() => {
    // Save timestamp to prevent reminder for 24 hours
    localStorage.setItem(LAST_SAVE_KEY, Date.now().toString())
    setShowReminder(false)
  }, [])

  if (!showReminder) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-in">
      <div className="bg-gray-800 border border-yellow-500/50 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">Sauvegarde recommandée</h3>
            <p className="text-sm text-gray-400 mb-3">
              Vous avez {transactionCount} transactions non sauvegardées.
              Sauvegardez vos données pour les conserver.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={saving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Sauvegarder
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissForDay}
              >
                Plus tard
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Update last save time when user manually saves
export function markAsSaved() {
  localStorage.setItem(LAST_SAVE_KEY, Date.now().toString())
}
