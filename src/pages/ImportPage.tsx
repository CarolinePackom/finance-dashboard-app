import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'
import { Card, CardTitle, Button } from '@components/common'
import { useTransactions } from '@store/TransactionContext'
import { parseExcelFile, convertToTransactions } from '@services/excel/parser'
import { applyLearnedRules } from '@services/categorizer/learningService'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction } from '@/types'

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error'

export function ImportPage() {
  const { addTransactions } = useTransactions()
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    filename: string
    rowCount: number
    transactions: Transaction[]
    headers: string[]
    mapping: { date?: number; type?: number; description?: number; debit?: number; credit?: number; amount?: number }
    sampleRow: Record<string, unknown> | null
  } | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)')
      setStatus('error')
      return
    }

    setStatus('parsing')
    setError(null)

    try {
      const result = await parseExcelFile(file)

      // Show detailed error if no rows parsed
      if (result.rows.length === 0) {
        if (result.errors.length > 0) {
          const firstError = result.errors[0]
          setError(
            `Erreur ligne ${firstError.row}: ${firstError.message}` +
            (firstError.value ? ` (valeur: "${firstError.value}")` : '') +
            `\n\nColonnes détectées: ${result.headers.join(', ')}`
          )
        } else {
          setError('Aucune transaction trouvée dans le fichier. Vérifiez que le fichier contient bien des données.')
        }
        setStatus('error')
        return
      }

      const importId = uuidv4()
      const transactions = await convertToTransactions(result.rows, importId)

      // Show warning if some rows had errors but we still got data
      if (result.errors.length > 0) {
        console.warn(`${result.errors.length} lignes ignorées:`, result.errors)
      }

      setPreview({
        filename: result.filename,
        rowCount: transactions.length,
        transactions,
        headers: result.headers,
        mapping: result.detectedMapping,
        sampleRow: result.rows[0]?.raw || null,
      })
      setStatus('preview')
    } catch (err) {
      const errorMessage = (err as Error).message
      setError(`Erreur lors de l'analyse: ${errorMessage}`)
      setStatus('error')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)

      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleImport = useCallback(async () => {
    if (!preview) return

    setStatus('importing')

    try {
      await addTransactions(preview.transactions)

      // Apply learned rules to ensure all patterns are applied
      console.log('📚 Applying learned categorization rules...')
      const updated = await applyLearnedRules()
      if (updated > 0) {
        console.log(`✅ ${updated} transaction(s) recategorized from learned rules`)
      }

      setStatus('success')
      setPreview(null)
    } catch (err) {
      setError(`Erreur d'import: ${(err as Error).message}`)
      setStatus('error')
    }
  }, [preview, addTransactions])

  const handleReset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setPreview(null)
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          Importer des transactions
        </h1>
        <p className="text-gray-400">
          Importez vos relevés bancaires au format Excel (.xlsx)
        </p>
      </div>

      {/* Dropzone */}
      {(status === 'idle' || status === 'error') && (
        <Card padding="none">
          <label
            className={`flex flex-col items-center justify-center h-64 cursor-pointer border-2 border-dashed rounded-xl transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInputChange}
              className="sr-only"
              aria-label="Sélectionner un fichier Excel"
            />
            <Upload
              className={`w-12 h-12 mb-4 ${
                dragActive ? 'text-blue-500' : 'text-gray-500'
              }`}
            />
            <p className="text-lg font-medium text-gray-300 mb-1">
              Glissez votre fichier ici
            </p>
            <p className="text-sm text-gray-500">ou cliquez pour parcourir</p>
            <p className="text-xs text-gray-600 mt-2">
              Formats acceptés: .xlsx, .xls
            </p>
          </label>
        </Card>
      )}

      {/* Parsing */}
      {status === 'parsing' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-300">Analyse du fichier...</p>
          </div>
        </Card>
      )}

      {/* Preview */}
      {status === 'preview' && preview && (
        <Card>
          <CardTitle icon={<FileSpreadsheet className="w-5 h-5 text-green-400" />}>
            Aperçu de l'import
          </CardTitle>
          <div className="space-y-4 mt-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Fichier</p>
              <p className="font-medium">{preview.filename}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Transactions détectées</p>
              <p className="text-2xl font-bold text-green-400">{preview.rowCount}</p>
            </div>

            {/* Sample transactions */}
            {preview.transactions.length > 0 && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Aperçu des premières transactions</p>
                <div className="space-y-2 text-sm">
                  {preview.transactions.slice(0, 3).map((t, i) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-gray-600 last:border-0">
                      <div>
                        <span className="text-gray-400">{t.date}</span>
                        <span className="mx-2">-</span>
                        <span className="truncate">{t.description.substring(0, 30)}</span>
                      </div>
                      <span className={t.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {t.amount >= 0 ? '+' : ''}{t.amount.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
                {preview.transactions.every(t => t.amount === 0) && (
                  <p className="text-yellow-400 text-xs mt-2">
                    ⚠️ Tous les montants sont à 0. Vérifiez les colonnes de votre fichier.
                  </p>
                )}
              </div>
            )}

            {/* Detected columns (debug info) */}
            <details className="bg-gray-700/30 rounded-lg p-3">
              <summary className="text-sm text-gray-400 cursor-pointer">
                Colonnes détectées (cliquez pour voir)
              </summary>
              <div className="mt-2 text-xs space-y-1">
                <p><span className="text-gray-500">Colonnes:</span> {preview.headers.join(', ')}</p>
                <p><span className="text-gray-500">Date:</span> col {preview.mapping.date ?? 'non détectée'}</p>
                <p><span className="text-gray-500">Description:</span> col {preview.mapping.description ?? 'non détectée'}</p>
                <p><span className="text-gray-500">Débit:</span> col {preview.mapping.debit ?? 'non détectée'}</p>
                <p><span className="text-gray-500">Crédit:</span> col {preview.mapping.credit ?? 'non détectée'}</p>
                <p><span className="text-gray-500">Montant:</span> col {preview.mapping.amount ?? 'non détectée'}</p>
              </div>
            </details>

            <div className="flex gap-3">
              <Button variant="primary" size="lg" onClick={handleImport} className="flex-1">
                Importer {preview.rowCount} transactions
              </Button>
              <Button variant="ghost" size="lg" onClick={handleReset}>
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Importing */}
      {status === 'importing' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-300">Import en cours...</p>
          </div>
        </Card>
      )}

      {/* Success */}
      {status === 'success' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-lg font-medium text-green-400 mb-2">
              Import réussi !
            </p>
            <p className="text-gray-400 mb-4">
              Vos transactions ont été ajoutées avec succès.
            </p>
            <Button variant="secondary" onClick={handleReset}>
              Importer un autre fichier
            </Button>
          </div>
        </Card>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-400">Erreur</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      )}

      {/* Help */}
      <Card>
        <h2 className="font-semibold mb-3">Comment préparer votre fichier</h2>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">1.</span>
            Exportez vos transactions depuis votre banque en ligne au format Excel
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">2.</span>
            Le fichier doit contenir des colonnes: Date, Description, Montant (ou Débit/Crédit)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">3.</span>
            Les colonnes sont détectées automatiquement
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">4.</span>
            Les transactions sont catégorisées automatiquement
          </li>
        </ul>
      </Card>
    </div>
  )
}
