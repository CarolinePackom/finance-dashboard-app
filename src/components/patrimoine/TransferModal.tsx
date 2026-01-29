import { useState, useMemo } from 'react'
import {
  X,
  ArrowRight,
  Wallet,
  Building,
  Landmark,
  Home,
  Shield,
  TrendingUp,
  LineChart,
  Clock,
  Bitcoin,
  ArrowLeftRight,
} from 'lucide-react'
import { Card, CardTitle, Button, useToast } from '@components/common'
import { assetAccountService, netWorthSnapshotService } from '@services/db'
import { formatMoney } from '@utils/formatters'
import type { AssetAccount, AssetAccountType } from '@/types'

// Icon mapping
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Landmark,
  Home,
  Shield,
  TrendingUp,
  LineChart,
  Clock,
  Bitcoin,
  Building,
  Wallet,
}

type TransferType = 'to-savings' | 'between-accounts'

interface TransferModalProps {
  accounts: AssetAccount[]
  onClose: () => void
  onTransferComplete: () => void
}

export function TransferModal({ accounts, onClose, onTransferComplete }: TransferModalProps) {
  const toast = useToast()
  const [transferType, setTransferType] = useState<TransferType>('to-savings')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [destinationId, setDestinationId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeAccounts = useMemo(() =>
    accounts.filter(a => a.isActive),
    [accounts]
  )

  const selectedDestination = useMemo(() =>
    activeAccounts.find(a => a.id === destinationId),
    [activeAccounts, destinationId]
  )

  const selectedSource = useMemo(() =>
    activeAccounts.find(a => a.id === sourceId),
    [activeAccounts, sourceId]
  )

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) return
    if (!destinationId) return
    if (transferType === 'between-accounts' && !sourceId) return
    if (transferType === 'between-accounts' && sourceId === destinationId) {
      toast.error('Erreur', 'Source et destination doivent être différents')
      return
    }

    setIsSubmitting(true)

    try {
      if (transferType === 'to-savings') {
        await assetAccountService.transferToAccount(
          destinationId,
          parsedAmount,
          description || undefined,
          date
        )
        toast.success(
          'Transfert effectué',
          `${formatMoney(parsedAmount)} transféré vers ${selectedDestination?.name}`
        )
      } else {
        if (selectedSource && selectedSource.currentBalance < parsedAmount) {
          toast.error('Solde insuffisant', `Le compte ${selectedSource.name} n'a pas assez de fonds`)
          setIsSubmitting(false)
          return
        }
        await assetAccountService.transferBetweenAccounts(
          sourceId,
          destinationId,
          parsedAmount,
          description || undefined
        )
        toast.success(
          'Transfert effectué',
          `${formatMoney(parsedAmount)} transféré de ${selectedSource?.name} vers ${selectedDestination?.name}`
        )
      }

      await netWorthSnapshotService.createSnapshot()
      onTransferComplete()
      onClose()
    } catch (error) {
      console.error('Transfer error:', error)
      toast.error('Erreur', error instanceof Error ? error.message : 'Échec du transfert')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <CardTitle icon={<ArrowLeftRight className="w-5 h-5 text-purple-400" />}>
            Transfert
          </CardTitle>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Transfer Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTransferType('to-savings')
                setSourceId('')
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all text-sm ${
                transferType === 'to-savings'
                  ? 'bg-purple-500/20 text-purple-400 shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span className="font-medium">Vers épargne</span>
            </button>
            <button
              type="button"
              onClick={() => setTransferType('between-accounts')}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all text-sm ${
                transferType === 'between-accounts'
                  ? 'bg-blue-500/20 text-blue-400 shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="font-medium">Entre comptes</span>
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Montant</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-4 text-2xl font-bold text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">€</span>
            </div>
          </div>

          {/* Source Account (only for between-accounts) */}
          {transferType === 'between-accounts' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Depuis</label>
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                {activeAccounts.map(account => {
                  const IconComponent = ICONS[account.icon] || Wallet
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setSourceId(account.id)}
                      disabled={account.id === destinationId}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        sourceId === account.id
                          ? 'border-blue-500 bg-blue-500/20'
                          : account.id === destinationId
                          ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                          : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                      }`}
                    >
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${account.color}20` }}
                      >
                        <IconComponent className="w-4 h-4" style={{ color: account.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.name}</p>
                        <p className="text-xs text-gray-500">{formatMoney(account.currentBalance)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* From indicator (for to-savings) */}
          {transferType === 'to-savings' && (
            <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="p-2 bg-gray-700 rounded-lg">
                <Building className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Compte courant</p>
                <p className="text-xs text-gray-500">Crée une transaction sortante</p>
              </div>
            </div>
          )}

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-gray-500" />
          </div>

          {/* Destination Account */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Vers</label>
            {activeAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4 bg-gray-700/30 rounded-lg">
                Aucun compte d'épargne
                <br />
                <span className="text-xs">Ajoutez un compte dans la page Patrimoine</span>
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {activeAccounts.map(account => {
                  const IconComponent = ICONS[account.icon] || Wallet
                  const isDisabled = transferType === 'between-accounts' && account.id === sourceId
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setDestinationId(account.id)}
                      disabled={isDisabled}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        destinationId === account.id
                          ? 'border-purple-500 bg-purple-500/20'
                          : isDisabled
                          ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                          : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                      }`}
                    >
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${account.color}20` }}
                      >
                        <IconComponent className="w-4 h-4" style={{ color: account.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.name}</p>
                        <p className="text-xs text-gray-500">{formatMoney(account.currentBalance)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Description (optional) */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Description <span className="text-gray-500">(optionnel)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Épargne mensuelle janvier"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Date (only for to-savings as it creates a transaction) */}
          {transferType === 'to-savings' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && destinationId && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Transfert</span>
                  {selectedDestination && (
                    <span className="text-xs text-gray-500">
                      → {selectedDestination.name}
                    </span>
                  )}
                </div>
                <span className="font-bold text-lg text-purple-400">
                  {formatMoney(parseFloat(amount))}
                </span>
              </div>
              {transferType === 'to-savings' && (
                <p className="text-xs text-gray-500 mt-1">
                  Une transaction sera créée dans votre historique
                </p>
              )}
              {transferType === 'between-accounts' && selectedSource && (
                <p className="text-xs text-gray-500 mt-1">
                  Nouveau solde {selectedSource.name}: {formatMoney(selectedSource.currentBalance - parseFloat(amount))}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={
                !amount ||
                parseFloat(amount) <= 0 ||
                !destinationId ||
                (transferType === 'between-accounts' && !sourceId) ||
                isSubmitting
              }
              className="flex-1 !bg-purple-600 hover:!bg-purple-500"
            >
              {isSubmitting ? 'Transfert...' : 'Transférer'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
