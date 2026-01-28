import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Landmark,
  Home,
  Shield,
  LineChart,
  Clock,
  Bitcoin,
  Building,
  Wallet,
  Edit2,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Target,
  Calculator,
  Sparkles,
  Play,
  RotateCcw,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { db, assetAccountService, liabilityService, netWorthSnapshotService } from '@services/db'
import { Card, CardTitle, Button, useToast } from '@components/common'
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

// Account type presets
const ACCOUNT_PRESETS: Record<AssetAccountType, { label: string; icon: string; color: string; defaultRate?: number }> = {
  'livret': { label: 'Livret d\'épargne', icon: 'Landmark', color: '#3b82f6', defaultRate: 3 },
  'epargne-logement': { label: 'Épargne logement', icon: 'Home', color: '#8b5cf6', defaultRate: 2 },
  'assurance-vie': { label: 'Assurance vie', icon: 'Shield', color: '#22c55e' },
  'pea': { label: 'PEA', icon: 'TrendingUp', color: '#f59e0b' },
  'cto': { label: 'Compte-titres', icon: 'LineChart', color: '#ec4899' },
  'per': { label: 'Plan Épargne Retraite', icon: 'Clock', color: '#06b6d4' },
  'crypto': { label: 'Crypto-monnaies', icon: 'Bitcoin', color: '#f97316' },
  'immobilier': { label: 'Immobilier', icon: 'Building', color: '#64748b' },
  'other': { label: 'Autre', icon: 'Wallet', color: '#94a3b8' },
}

export function PatrimoinePage() {
  const toast = useToast()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUpdateBalanceModal, setShowUpdateBalanceModal] = useState<AssetAccount | null>(null)

  // Load data
  const accounts = useLiveQuery(() => db.assetAccounts.orderBy('order').toArray(), []) ?? []
  const liabilities = useLiveQuery(() => db.liabilities.filter(l => l.isActive).toArray(), []) ?? []
  const snapshots = useLiveQuery(() => netWorthSnapshotService.getMonthlySnapshots(12), []) ?? []

  // Calculate totals
  const totals = useMemo(() => {
    const totalAssets = accounts.filter(a => a.isActive).reduce((sum, a) => sum + a.currentBalance, 0)
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.remainingBalance, 0)
    const netWorth = totalAssets - totalLiabilities

    // Group by type
    const byType = new Map<AssetAccountType, number>()
    for (const account of accounts.filter(a => a.isActive)) {
      const current = byType.get(account.type) || 0
      byType.set(account.type, current + account.currentBalance)
    }

    return { totalAssets, totalLiabilities, netWorth, byType }
  }, [accounts, liabilities])

  // Calculate evolution
  const evolution = useMemo(() => {
    if (snapshots.length < 2) return null
    const latest = snapshots[snapshots.length - 1]
    const previous = snapshots[snapshots.length - 2]
    const change = latest.netWorth - previous.netWorth
    const percentChange = previous.netWorth !== 0 ? (change / previous.netWorth) * 100 : 0
    return { change, percentChange }
  }, [snapshots])

  // Handle adding account
  const handleAddAccount = async (data: {
    name: string
    type: AssetAccountType
    institution?: string
    balance: number
    interestRate?: number
  }) => {
    const preset = ACCOUNT_PRESETS[data.type]
    const now = new Date().toISOString()
    const maxOrder = Math.max(0, ...accounts.map(a => a.order))

    const account: AssetAccount = {
      id: uuidv4(),
      name: data.name,
      type: data.type,
      institution: data.institution,
      currentBalance: data.balance,
      interestRate: data.interestRate,
      color: preset.color,
      icon: preset.icon,
      isActive: true,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    }

    await assetAccountService.add(account)
    await netWorthSnapshotService.createSnapshot()
    toast.success('Compte ajouté', `${data.name} a été ajouté à votre patrimoine`)
    setShowAddModal(false)
  }

  // Handle updating balance
  const handleUpdateBalance = async (accountId: string, newBalance: number) => {
    await assetAccountService.updateBalance(accountId, newBalance)
    await netWorthSnapshotService.createSnapshot()
    toast.success('Solde mis à jour', 'Le solde a été mis à jour')
    setShowUpdateBalanceModal(null)
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce compte ?')) return
    await assetAccountService.delete(id)
    await netWorthSnapshotService.createSnapshot()
    toast.success('Compte supprimé', 'Le compte a été retiré de votre patrimoine')
  }

  // Goal progress (to 1 million)
  const goalProgress = (totals.netWorth / 1_000_000) * 100

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-7 h-7 text-yellow-400" />
            Mon Patrimoine
          </h1>
          <p className="text-gray-400 text-sm mt-1">Suivi de votre richesse globale</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un compte
        </Button>
      </div>

      {/* Net Worth Card */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-yellow-500/30">
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm mb-2">Patrimoine Net Total</p>
          <p className="text-4xl md:text-5xl font-bold text-white mb-2">
            {formatMoney(totals.netWorth)}
          </p>
          {evolution && (
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
              evolution.change >= 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {evolution.change >= 0 ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {evolution.change >= 0 ? '+' : ''}{formatMoney(evolution.change)} ({evolution.percentChange.toFixed(1)}%)
              <span className="text-gray-500 ml-1">ce mois</span>
            </div>
          )}
        </div>

        {/* Goal progress bar */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Road to Milli</span>
            <span className="text-yellow-400 font-medium">{goalProgress.toFixed(2)}%</span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, goalProgress)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 €</span>
            <span>1 000 000 €</span>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Actifs</p>
              <p className="text-2xl font-bold text-green-400">{formatMoney(totals.totalAssets)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Passifs</p>
              <p className="text-2xl font-bold text-red-400">{formatMoney(totals.totalLiabilities)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Landmark className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Comptes</p>
              <p className="text-2xl font-bold text-white">{accounts.filter(a => a.isActive).length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Distribution by type */}
      {totals.byType.size > 0 && (
        <Card>
          <CardTitle>Répartition par type</CardTitle>
          <div className="space-y-3 mt-4">
            {Array.from(totals.byType.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, amount]) => {
                const preset = ACCOUNT_PRESETS[type]
                const percentage = totals.totalAssets > 0 ? (amount / totals.totalAssets) * 100 : 0

                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{preset.label}</span>
                      <span className="text-white font-medium">{formatMoney(amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: preset.color,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 text-right">{percentage.toFixed(1)}%</p>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Compound Interest Calculator */}
      <CompoundInterestCalculator initialCapital={totals.netWorth} />

      {/* Account List */}
      <Card>
        <CardTitle>Mes comptes</CardTitle>
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">Aucun compte ajouté</p>
            <p className="text-sm text-gray-500 mt-1">
              Ajoutez vos comptes d'épargne pour suivre votre patrimoine
            </p>
            <Button variant="primary" onClick={() => setShowAddModal(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un compte
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {accounts.map(account => {
              const preset = ACCOUNT_PRESETS[account.type]
              const IconComponent = ICONS[account.icon] || Wallet

              return (
                <div
                  key={account.id}
                  className={`flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors ${
                    !account.isActive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${account.color}20` }}
                    >
                      <IconComponent className="w-6 h-6" style={{ color: account.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-white">{account.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{preset.label}</span>
                        {account.institution && (
                          <>
                            <span>•</span>
                            <span>{account.institution}</span>
                          </>
                        )}
                        {account.interestRate && (
                          <>
                            <span>•</span>
                            <span className="text-green-400">{account.interestRate}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">
                        {formatMoney(account.currentBalance)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Mis à jour le {new Date(account.updatedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowUpdateBalanceModal(account)}
                        className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                        title="Mettre à jour le solde"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddAccount}
        />
      )}

      {/* Update Balance Modal */}
      {showUpdateBalanceModal && (
        <UpdateBalanceModal
          account={showUpdateBalanceModal}
          onClose={() => setShowUpdateBalanceModal(null)}
          onUpdate={handleUpdateBalance}
        />
      )}
    </div>
  )
}

// Add Account Modal
interface AddAccountModalProps {
  onClose: () => void
  onAdd: (data: {
    name: string
    type: AssetAccountType
    institution?: string
    balance: number
    interestRate?: number
  }) => void
}

function AddAccountModal({ onClose, onAdd }: AddAccountModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetAccountType>('livret')
  const [institution, setInstitution] = useState('')
  const [balance, setBalance] = useState('')
  const [interestRate, setInterestRate] = useState('')

  const preset = ACCOUNT_PRESETS[type]

  const handleSubmit = () => {
    if (!name || !balance) return
    onAdd({
      name,
      type,
      institution: institution || undefined,
      balance: parseFloat(balance),
      interestRate: interestRate ? parseFloat(interestRate) : preset.defaultRate,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <CardTitle icon={<Plus className="w-5 h-5 text-green-400" />}>
            Nouveau compte
          </CardTitle>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Account Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Type de compte</label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {(Object.keys(ACCOUNT_PRESETS) as AssetAccountType[]).map(accountType => {
                const p = ACCOUNT_PRESETS[accountType]
                const IconComponent = ICONS[p.icon] || Wallet

                return (
                  <button
                    key={accountType}
                    type="button"
                    onClick={() => setType(accountType)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      type === accountType
                        ? 'border-white/50 bg-white/10'
                        : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: p.color }} />
                    <span className="text-xs text-center">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Nom du compte</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Ex: Livret A ${institution || 'Banque'}`}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          {/* Institution */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Établissement <span className="text-gray-500">(optionnel)</span>
            </label>
            <input
              type="text"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              placeholder="Ex: Boursorama, Crédit Agricole..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          {/* Balance */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Solde actuel</label>
            <div className="relative">
              <input
                type="number"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
            </div>
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Taux d'intérêt <span className="text-gray-500">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                placeholder={preset.defaultRate?.toString() || '0'}
                step="0.1"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!name || !balance}
              className="flex-1"
            >
              Ajouter
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Update Balance Modal
interface UpdateBalanceModalProps {
  account: AssetAccount
  onClose: () => void
  onUpdate: (accountId: string, newBalance: number) => void
}

function UpdateBalanceModal({ account, onClose, onUpdate }: UpdateBalanceModalProps) {
  const [balance, setBalance] = useState(account.currentBalance.toString())

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <CardTitle icon={<Edit2 className="w-5 h-5 text-blue-400" />}>
            Mettre à jour
          </CardTitle>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-400">{account.name}</p>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Nouveau solde</label>
            <div className="relative">
              <input
                type="number"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-4 text-2xl font-bold text-center"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">€</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => onUpdate(account.id, parseFloat(balance))}
              disabled={!balance}
              className="flex-1"
            >
              Mettre à jour
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Compound Interest Calculator
interface CompoundInterestCalculatorProps {
  initialCapital?: number
}

interface SimulationResult {
  year: number
  capital: number
  contributions: number
  interest: number
  total: number
}

function CompoundInterestCalculator({ initialCapital = 0 }: CompoundInterestCalculatorProps) {
  const [capital, setCapital] = useState(initialCapital.toString())
  const [monthlyContribution, setMonthlyContribution] = useState('500')
  const [annualRate, setAnnualRate] = useState('7')
  const [years, setYears] = useState('20')
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate compound interest
  const results = useMemo(() => {
    const p = parseFloat(capital) || 0 // Principal
    const m = parseFloat(monthlyContribution) || 0 // Monthly contribution
    const r = (parseFloat(annualRate) || 0) / 100 // Annual rate
    const n = parseInt(years) || 0 // Years

    const monthlyRate = r / 12
    const data: SimulationResult[] = []

    let totalContributions = p
    let currentTotal = p

    for (let year = 0; year <= n; year++) {
      if (year === 0) {
        data.push({
          year: 0,
          capital: p,
          contributions: p,
          interest: 0,
          total: p,
        })
      } else {
        // Add monthly contributions and compound monthly
        for (let month = 0; month < 12; month++) {
          currentTotal = currentTotal * (1 + monthlyRate) + m
          totalContributions += m
        }

        data.push({
          year,
          capital: p,
          contributions: totalContributions,
          interest: currentTotal - totalContributions,
          total: currentTotal,
        })
      }
    }

    return data
  }, [capital, monthlyContribution, annualRate, years])

  const finalResult = results[results.length - 1] || { total: 0, contributions: 0, interest: 0 }
  const maxTotal = Math.max(...results.map(r => r.total))

  // Milestones
  const milestones = useMemo(() => {
    const targets = [100000, 250000, 500000, 750000, 1000000]
    return targets.map(target => {
      const yearReached = results.find(r => r.total >= target)?.year
      return { target, yearReached }
    }).filter(m => m.yearReached !== undefined)
  }, [results])

  const handleReset = () => {
    setCapital(initialCapital.toString())
    setMonthlyContribution('500')
    setAnnualRate('7')
    setYears('20')
  }

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle icon={<Calculator className="w-5 h-5 text-purple-400" />}>
          Simulateur d'Intérêts Composés
        </CardTitle>
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {!isExpanded && (
        <p className="text-sm text-gray-500 mt-2">
          Cliquez pour simuler la croissance de votre patrimoine
        </p>
      )}

      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Capital initial</label>
              <div className="relative">
                <input
                  type="number"
                  value={capital}
                  onChange={e => setCapital(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Versement mensuel</label>
              <div className="relative">
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={e => setMonthlyContribution(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-8"
                  placeholder="500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Taux annuel</label>
              <div className="relative">
                <input
                  type="number"
                  value={annualRate}
                  onChange={e => setAnnualRate(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-8"
                  step="0.5"
                  placeholder="7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Durée</label>
              <div className="relative">
                <input
                  type="number"
                  value={years}
                  onChange={e => setYears(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-12"
                  min="1"
                  max="50"
                  placeholder="20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">ans</span>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Scénarios:</span>
            <button
              onClick={() => { setAnnualRate('3'); setYears('10'); }}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            >
              Prudent (3%, 10 ans)
            </button>
            <button
              onClick={() => { setAnnualRate('7'); setYears('20'); }}
              className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-full transition-colors"
            >
              Équilibré (7%, 20 ans)
            </button>
            <button
              onClick={() => { setAnnualRate('10'); setYears('30'); }}
              className="px-3 py-1 text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-full transition-colors"
            >
              Agressif (10%, 30 ans)
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-full transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Results Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">Montant final</p>
              <p className="text-3xl font-bold text-green-400">{formatMoney(finalResult.total)}</p>
              <div className="flex items-center justify-center gap-1 mt-1 text-green-400/70">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs">après {years} ans</span>
              </div>
            </div>

            <div className="bg-gray-700/30 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">Total versé</p>
              <p className="text-2xl font-bold text-white">{formatMoney(finalResult.contributions)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatMoney(parseFloat(capital) || 0)} + {formatMoney((parseFloat(monthlyContribution) || 0) * 12 * (parseInt(years) || 0))}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">Intérêts gagnés</p>
              <p className="text-2xl font-bold text-purple-400">{formatMoney(finalResult.interest)}</p>
              <p className="text-xs text-purple-400/70 mt-1">
                +{finalResult.contributions > 0 ? ((finalResult.interest / finalResult.contributions) * 100).toFixed(0) : 0}% de gains
              </p>
            </div>
          </div>

          {/* Visual Chart */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-4">Projection sur {years} ans</h4>

            {/* Bar Chart */}
            <div className="flex items-end gap-1 h-48 mb-2">
              {results.filter((_, i) => {
                // Show max 25 bars, sample evenly if more
                const totalYears = parseInt(years) || 1
                if (totalYears <= 25) return true
                const step = Math.ceil(totalYears / 25)
                return i % step === 0 || i === results.length - 1
              }).map((result, index) => {
                const heightPercent = maxTotal > 0 ? (result.total / maxTotal) * 100 : 0
                const contributionPercent = maxTotal > 0 ? (result.contributions / maxTotal) * 100 : 0

                return (
                  <div
                    key={result.year}
                    className="flex-1 flex flex-col justify-end group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <p className="text-white font-medium">Année {result.year}</p>
                      <p className="text-green-400">{formatMoney(result.total)}</p>
                      <p className="text-gray-400">Versé: {formatMoney(result.contributions)}</p>
                      <p className="text-purple-400">Intérêts: {formatMoney(result.interest)}</p>
                    </div>

                    {/* Bar */}
                    <div className="relative w-full">
                      {/* Interest portion */}
                      <div
                        className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all duration-300"
                        style={{ height: `${(heightPercent - contributionPercent) * 1.92}px` }}
                      />
                      {/* Contribution portion */}
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-b transition-all duration-300"
                        style={{ height: `${contributionPercent * 1.92}px` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Année 0</span>
              <span>Année {Math.floor((parseInt(years) || 0) / 2)}</span>
              <span>Année {years}</span>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-xs text-gray-400">Versements</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded" />
                <span className="text-xs text-gray-400">Intérêts composés</span>
              </div>
            </div>
          </div>

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-yellow-400" />
                Objectifs atteints
              </h4>
              <div className="flex flex-wrap gap-2">
                {milestones.map(m => (
                  <div
                    key={m.target}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      m.target === 1000000
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-700/50 text-gray-300'
                    }`}
                  >
                    <span className="font-medium">{formatMoney(m.target)}</span>
                    <span className="text-gray-500 ml-2">→ année {m.yearReached}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Year by year table (collapsed by default) */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
              <Play className="w-4 h-4 group-open:rotate-90 transition-transform" />
              Voir le détail année par année
            </summary>
            <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-400">Année</th>
                    <th className="text-right px-4 py-2 text-gray-400">Versements</th>
                    <th className="text-right px-4 py-2 text-gray-400">Intérêts</th>
                    <th className="text-right px-4 py-2 text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => (
                    <tr
                      key={result.year}
                      className={`border-t border-gray-700/50 hover:bg-gray-700/30 ${
                        result.total >= 1000000 ? 'bg-yellow-500/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2">{result.year}</td>
                      <td className="px-4 py-2 text-right text-gray-400">
                        {formatMoney(result.contributions)}
                      </td>
                      <td className="px-4 py-2 text-right text-purple-400">
                        {formatMoney(result.interest)}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${
                        result.total >= 1000000 ? 'text-yellow-400' : 'text-white'
                      }`}>
                        {formatMoney(result.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Educational note */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Le pouvoir des intérêts composés</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Albert Einstein aurait dit que les intérêts composés sont la "8ème merveille du monde".
              Plus vous commencez tôt, plus l'effet boule de neige est puissant. Avec un taux de {annualRate}%
              et {formatMoney(parseFloat(monthlyContribution) || 0)}/mois, vous accumulez{' '}
              <span className="text-purple-400 font-medium">{formatMoney(finalResult.interest)}</span> d'intérêts
              en {years} ans - soit{' '}
              <span className="text-green-400 font-medium">
                {finalResult.contributions > 0 ? ((finalResult.interest / finalResult.contributions) * 100).toFixed(0) : 0}%
              </span>{' '}
              de gains par rapport à vos versements !
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
