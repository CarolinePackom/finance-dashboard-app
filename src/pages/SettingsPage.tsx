import { useState, useCallback, useRef, useEffect } from 'react'
import { Trash2, AlertTriangle, FileText, FileSpreadsheet, Upload, Save, FolderOpen, RefreshCw, Brain, Wallet, Check } from 'lucide-react'
import { Card, CardTitle, Button, useToast, markAsSaved } from '@components/common'
import { db, categoryService, settingsService } from '@services/db'
import { useTransactions } from '@store/TransactionContext'
import { useAllTransactions } from '@hooks/index'
import { formatMoney } from '@utils/formatters'
import { exportToCSV } from '@services/export/csv'
import { generateMonthlyReport, generateTransactionsPDF } from '@services/export/pdf'
import { exportToFile, importFromFile, mergeFromFile } from '@services/storage/fileStorage'
import {
  createAutoBackup,
  setupAutoSaveLocation,
  hasAutoSaveLocation,
  getAutoSaveFileName,
  isFileSystemAccessSupported,
  saveToFile,
  downloadBackup,
  clearUnsavedChanges,
} from '@services/storage/autoBackup'
import { getCategorizerWithRules, resetCategorizer } from '@services/categorizer'
import { learnFromAllCorrections } from '@services/categorizer/learningService'

export function SettingsPage() {
  const { transactions, categories, stats, selectedMonth } = useTransactions()
  const allTransactions = useAllTransactions()
  const toast = useToast()
  const [showConfirm, setShowConfirm] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mergeInputRef = useRef<HTMLInputElement>(null)

  // Balance calibration state
  const [currentBalanceInput, setCurrentBalanceInput] = useState('')
  const [initialBalance, setInitialBalance] = useState<number | null>(null)
  const [savingBalance, setSavingBalance] = useState(false)

  // Auto-save state (File System Access API - Chrome/Edge)
  const [autoSaveConfigured, setAutoSaveConfigured] = useState(hasAutoSaveLocation())
  const [autoSaveFileName, setAutoSaveFileName] = useState(getAutoSaveFileName())

  // Calculate total of all transactions
  const transactionsTotal = allTransactions.reduce((sum, t) => sum + t.amount, 0)

  // Load initial balance on mount
  useEffect(() => {
    settingsService.getInitialBalance().then(balance => {
      setInitialBalance(balance)
    })
  }, [])

  // Calculate current balance based on initial + transactions
  const calculatedCurrentBalance = (initialBalance || 0) + transactionsTotal

  // Handle balance calibration
  // Setup auto-save location
  const handleSetupAutoSave = useCallback(async () => {
    const success = await setupAutoSaveLocation()
    if (success) {
      setAutoSaveConfigured(true)
      setAutoSaveFileName(getAutoSaveFileName())
      toast.success('Auto-save configuré', 'Les données seront sauvegardées automatiquement')
    }
  }, [toast])

  // Manual save to configured file
  const handleManualSaveToFile = useCallback(async () => {
    const success = await saveToFile()
    if (success) {
      toast.success('Sauvegarde effectuée', 'Données sauvegardées dans le fichier')
    } else {
      toast.error('Erreur', 'Impossible de sauvegarder')
    }
  }, [toast])

  // Manual download backup (Safari/Firefox)
  const handleDownloadBackup = useCallback(async () => {
    const success = await downloadBackup()
    if (success) {
      toast.success('Téléchargement lancé', 'Le fichier finance-backup.json a été téléchargé')
    } else {
      toast.error('Erreur', 'Aucune donnée à sauvegarder')
    }
  }, [toast])

  const handleCalibrateBalance = useCallback(async () => {
    const targetBalance = parseFloat(currentBalanceInput.replace(',', '.'))
    if (isNaN(targetBalance)) {
      toast.error('Erreur', 'Entrez un montant valide')
      return
    }

    setSavingBalance(true)
    try {
      // Calculate what initial balance should be
      // targetBalance = initialBalance + transactionsTotal
      // initialBalance = targetBalance - transactionsTotal
      const newInitialBalance = targetBalance - transactionsTotal
      await settingsService.setInitialBalance(newInitialBalance)
      setInitialBalance(newInitialBalance)
      setCurrentBalanceInput('')
      toast.success('Solde calibré', `Solde initial ajusté à ${formatMoney(newInitialBalance)}`)
    } catch (err) {
      toast.error('Erreur', (err as Error).message)
    } finally {
      setSavingBalance(false)
    }
  }, [currentBalanceInput, transactionsTotal, toast])

  // Save all data to JSON file
  const handleSaveToFile = useCallback(async () => {
    setExporting('save')
    try {
      await exportToFile()
      markAsSaved()
      clearUnsavedChanges()
      toast.success('Succès', 'Données sauvegardées dans finance-data.json')
    } catch (err) {
      toast.error('Erreur', `Erreur: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }, [toast])

  // Load data from JSON file (replace all)
  const handleLoadFromFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExporting('load')
    try {
      const result = await importFromFile(file)
      // Create auto-backup after loading
      await createAutoBackup()
      toast.success('Succès', `${result.transactions} transactions chargées !`)
      window.location.reload()
    } catch (err) {
      toast.error('Erreur', `Erreur: ${(err as Error).message}`)
    } finally {
      setExporting(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [toast])

  // Merge data from JSON file (add to existing)
  const handleMergeFromFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExporting('merge')
    try {
      const result = await mergeFromFile(file)
      // Create auto-backup after merging
      await createAutoBackup()
      toast.success('Succès', `${result.added} transactions ajoutées (${result.skipped} doublons ignorés)`)
      window.location.reload()
    } catch (err) {
      toast.error('Erreur', `Erreur: ${(err as Error).message}`)
    } finally {
      setExporting(null)
      if (mergeInputRef.current) mergeInputRef.current.value = ''
    }
  }, [toast])

  const handleExportCSV = useCallback(() => {
    setExporting('csv')
    try {
      exportToCSV(
        allTransactions,
        categories,
        `transactions-${new Date().toISOString().split('T')[0]}.csv`
      )
    } finally {
      setExporting(null)
    }
  }, [allTransactions, categories])

  const handleExportPDF = useCallback(() => {
    if (!stats) return
    setExporting('pdf')
    try {
      generateMonthlyReport(selectedMonth, transactions, categories, stats)
    } finally {
      setExporting(null)
    }
  }, [selectedMonth, transactions, categories, stats])

  const handleExportAllPDF = useCallback(() => {
    setExporting('pdf-all')
    try {
      generateTransactionsPDF(allTransactions, categories)
    } finally {
      setExporting(null)
    }
  }, [allTransactions, categories])

  const handleClearData = useCallback(async () => {
    await db.transactions.clear()
    await db.imports.clear()
    setShowConfirm(false)
    window.location.reload()
  }, [])

  // Recategorize transactions based on current rules
  const handleRecategorize = useCallback(async () => {
    setExporting('recategorize')
    try {
      // Ensure all new categories exist
      const newCategories = [
        {
          id: 'amazon',
          name: 'Amazon',
          icon: 'Package',
          color: '#ff9900',
          isIncome: false,
          isExcludedFromStats: false,
          order: 5,
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'abonnements',
          name: 'Abonnements',
          icon: 'Repeat',
          color: '#f472b6',
          isIncome: false,
          isExcludedFromStats: false,
          order: 5,
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'caf',
          name: 'CAF',
          icon: 'Baby',
          color: '#06b6d4',
          isIncome: true,
          isExcludedFromStats: false,
          order: 12,
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'compte-a-compte',
          name: 'Compte a compte',
          icon: 'ArrowLeftRight',
          color: '#8b5cf6',
          isIncome: true,
          isExcludedFromStats: false,
          order: 13,
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
      ]

      for (const cat of newCategories) {
        const existing = await categoryService.getById(cat.id)
        if (!existing) {
          await categoryService.add(cat)
        } else {
          // Update existing category if settings changed
          await categoryService.update(cat.id, {
            isExcludedFromStats: cat.isExcludedFromStats,
            isIncome: cat.isIncome,
          })
        }
      }

      // Reset categorizer and load user rules from database
      resetCategorizer()
      const categorizer = await getCategorizerWithRules()

      // Get all transactions and recategorize
      const transactions = await db.transactions.toArray()
      let updated = 0

      for (const t of transactions) {
        // Only recategorize if not manually edited
        if (t.isManuallyEdited) continue

        const isExpense = t.amount < 0
        const newCategory = categorizer.categorize(t.description, t.type, isExpense)
        if (newCategory && newCategory !== t.category) {
          await db.transactions.update(t.id, { category: newCategory })
          updated++
        }
      }

      toast.success('Succès', `${updated} transactions recatégorisées`)
    } catch (err) {
      toast.error('Erreur', `Erreur: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }, [toast])

  // Learn from manual corrections and apply to similar transactions
  const handleLearnAndApply = useCallback(async () => {
    setExporting('learn')
    try {
      const result = await learnFromAllCorrections()
      toast.success(
        'Apprentissage terminé',
        `${result.rulesCreated} règles créées, ${result.transactionsUpdated} transactions mises à jour`
      )
    } catch (err) {
      toast.error('Erreur', `Erreur: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }, [toast])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          Paramètres
        </h1>
        <p className="text-gray-400">Gérez vos données et préférences</p>
      </div>

      {/* Auto-Save Configuration */}
      <Card className="border-green-500/50">
        <CardTitle icon={<Save className="w-5 h-5 text-green-400" />}>
          Sauvegarde automatique
        </CardTitle>

        {isFileSystemAccessSupported() ? (
          <>
            <p className="text-gray-400 text-sm mt-2 mb-4">
              Configure un fichier sur ton Bureau qui sera écrasé automatiquement à chaque modification.
            </p>

            {autoSaveConfigured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <Check className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-400 font-medium">Auto-save actif</p>
                    <p className="text-xs text-gray-400">Fichier: {autoSaveFileName || 'finance-backup.json'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleManualSaveToFile}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Sauvegarder maintenant
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSetupAutoSave}
                  >
                    Changer l'emplacement
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleSetupAutoSave}
                leftIcon={<FolderOpen className="w-4 h-4" />}
              >
                Choisir l'emplacement du fichier
              </Button>
            )}
            <p className="text-xs text-gray-500 mt-3">
              Conseil: Choisis un emplacement sur ton Bureau pour retrouver facilement le fichier.
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-sm mt-2 mb-4">
              Télécharge une sauvegarde de tes données. Tu seras averti si tu essaies de quitter l'app avec des modifications non sauvegardées.
            </p>

            <Button
              variant="primary"
              onClick={handleDownloadBackup}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Télécharger une sauvegarde
            </Button>

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">
                <strong>Protection automatique :</strong> Tes données sont sauvegardées en arrière-plan dans le navigateur.
                Un rappel s'affichera si tu fermes l'app sans avoir téléchargé de sauvegarde récente.
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Save/Load Data File - PRIMARY FEATURE */}
      <Card className="border-blue-500/50">
        <CardTitle icon={<FolderOpen className="w-5 h-5 text-blue-400" />}>
          💾 Fichier de données
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Sauvegardez vos données dans un fichier <code className="bg-gray-700 px-1 rounded">finance-data.json</code> que vous pouvez garder dans un dossier et recharger à tout moment.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={handleSaveToFile}
            isLoading={exporting === 'save'}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Sauvegarder
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            isLoading={exporting === 'load'}
            leftIcon={<FolderOpen className="w-4 h-4" />}
          >
            Charger (remplacer)
          </Button>
          <Button
            variant="secondary"
            onClick={() => mergeInputRef.current?.click()}
            isLoading={exporting === 'merge'}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Ajouter (fusionner)
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadFromFile}
          className="hidden"
        />
        <input
          ref={mergeInputRef}
          type="file"
          accept=".json"
          onChange={handleMergeFromFile}
          className="hidden"
        />
        <p className="text-xs text-gray-500 mt-3">
          Conseil: Gardez le fichier <code className="bg-gray-700 px-1 rounded">finance-data.json</code> dans un dossier dédié.
          Chargez-le au démarrage pour retrouver vos données.
        </p>
      </Card>

      {/* Balance Calibration */}
      <Card className="border-green-500/50">
        <CardTitle icon={<Wallet className="w-5 h-5 text-green-400" />}>
          Calibrer le solde bancaire
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Entrez votre solde bancaire actuel pour que l'app calcule automatiquement le solde initial.
        </p>

        {/* Current calculated balance */}
        <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Solde calculé par l'app :</span>
            <span className={`text-xl font-bold ${calculatedCurrentBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatMoney(calculatedCurrentBalance)}
            </span>
          </div>
          {initialBalance !== null && initialBalance !== 0 && (
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-gray-500">Solde initial enregistré :</span>
              <span className="text-gray-400">{formatMoney(initialBalance)}</span>
            </div>
          )}
        </div>

        {/* Input for real balance */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">
              Votre vrai solde bancaire aujourd'hui
            </label>
            <input
              type="text"
              value={currentBalanceInput}
              onChange={(e) => setCurrentBalanceInput(e.target.value)}
              placeholder="Ex: 243,62"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={handleCalibrateBalance}
              isLoading={savingBalance}
              leftIcon={<Check className="w-4 h-4" />}
              disabled={!currentBalanceInput}
            >
              Calibrer
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          L'app ajustera le solde initial pour que le calcul corresponde à votre solde réel.
        </p>
      </Card>

      {/* Export PDF */}
      <Card>
        <CardTitle icon={<FileText className="w-5 h-5 text-red-400" />}>
          Exporter en PDF
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Générez un rapport PDF de vos finances.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={handleExportPDF}
            isLoading={exporting === 'pdf'}
            leftIcon={<FileText className="w-4 h-4" />}
            disabled={!stats || transactions.length === 0}
          >
            Rapport du mois
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportAllPDF}
            isLoading={exporting === 'pdf-all'}
            leftIcon={<FileText className="w-4 h-4" />}
            disabled={allTransactions.length === 0}
          >
            Toutes les transactions
          </Button>
        </div>
      </Card>

      {/* Export CSV */}
      <Card>
        <CardTitle icon={<FileSpreadsheet className="w-5 h-5 text-green-400" />}>
          Exporter en CSV
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Exportez vos transactions au format CSV (compatible Excel).
        </p>
        <Button
          variant="secondary"
          onClick={handleExportCSV}
          isLoading={exporting === 'csv'}
          leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          disabled={allTransactions.length === 0}
        >
          Exporter CSV
        </Button>
      </Card>

      {/* Recategorize */}
      <Card>
        <CardTitle icon={<RefreshCw className="w-5 h-5 text-orange-400" />}>
          Recategoriser les transactions
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Applique les regles de categorisation actuelles a toutes les transactions (sauf celles modifiees manuellement).
          Les transactions Amazon seront placees dans la categorie "Amazon".
        </p>
        <Button
          variant="secondary"
          onClick={handleRecategorize}
          isLoading={exporting === 'recategorize'}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          disabled={allTransactions.length === 0}
        >
          Recategoriser
        </Button>
      </Card>

      {/* Learn from corrections */}
      <Card className="border-purple-500/50">
        <CardTitle icon={<Brain className="w-5 h-5 text-purple-400" />}>
          Apprendre de vos corrections
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Analyse vos corrections manuelles et les applique automatiquement aux transactions similaires.
          Les règles apprises seront utilisées pour les futurs imports.
        </p>
        <Button
          variant="primary"
          onClick={handleLearnAndApply}
          isLoading={exporting === 'learn'}
          leftIcon={<Brain className="w-4 h-4" />}
          disabled={allTransactions.length === 0}
        >
          Apprendre et appliquer
        </Button>
      </Card>

      {/* Clear data */}
      <Card>
        <CardTitle icon={<Trash2 className="w-5 h-5 text-red-400" />}>
          Supprimer les données
        </CardTitle>
        <p className="text-gray-400 text-sm mt-2 mb-4">
          Supprimez toutes vos transactions de la mémoire du navigateur.
        </p>
        {!showConfirm ? (
          <Button
            variant="danger"
            onClick={() => setShowConfirm(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Supprimer tout
          </Button>
        ) : (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">Confirmer la suppression</p>
                <p className="text-sm text-gray-400">
                  Les données seront supprimées du navigateur. Si vous avez sauvegardé un fichier, vous pourrez le recharger.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleClearData}>
                Oui, supprimer
              </Button>
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Info */}
      <Card>
        <h2 className="font-semibold mb-3">À propos</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p>
            <strong className="text-white">Road to Milli</strong> - Suivi personnel de vos finances
          </p>
          <p>
            Vos données sont stockées dans le navigateur (IndexedDB). Pour les conserver de façon permanente,
            utilisez le bouton "Sauvegarder" ci-dessus.
          </p>
          <p className="text-xs text-gray-500 mt-4">
            {allTransactions.length} transactions • {categories.length} catégories
          </p>
        </div>
      </Card>
    </div>
  )
}
