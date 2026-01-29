import { useState, useCallback, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuidv4 } from 'uuid'
import {
  Wallet,
  PiggyBank,
  Target,
  Plus,
  Settings,
  AlertTriangle,
  Check,
  Trash2,
  Edit2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  List,
  Link,
  Landmark,
} from 'lucide-react'
import { Card, CardTitle, Button, useToast } from '@components/common'
import { QuickAddExpense, InlineFixedCharges } from '@components/budget'
import { useTransactions } from '@store/TransactionContext'
import {
  categoryBudgetService,
  categoryService,
  monthlyBudgetConfigService,
  savingsGoalService,
  settingsService,
  assetAccountService,
} from '@services/db'
import { useAllTransactions } from '@hooks/index'
import { formatMoney, formatPercent } from '@utils/formatters'
import type {
  CategoryBudget,
  MonthlyBudgetConfig,
  SavingsGoal,
  BudgetGroupType,
  Category,
  FixedCharge,
  AssetAccount,
} from '@/types'

// Budget groups definition
const BUDGET_GROUPS = [
  { id: 'needs' as const, name: 'Besoins', targetPercent: 50, color: '#3b82f6' },
  { id: 'wants' as const, name: 'Envies', targetPercent: 30, color: '#f59e0b' },
  { id: 'savings' as const, name: 'Épargne', targetPercent: 20, color: '#22c55e' },
]

type BudgetTab = 'overview' | 'categories' | 'savings' | 'yearly'

// Month names for display
const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const monthIndex = parseInt(m, 10) - 1
  return `${MONTH_LABELS[monthIndex]} ${year}`
}

function getMonthOffset(baseMonth: string, offset: number): string {
  const [year, month] = baseMonth.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function BudgetPage() {
  const { categories } = useTransactions()
  const allTransactionsFromHook = useAllTransactions()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<BudgetTab>('overview')
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)

  // Selected month for budget (can be current or future)
  const currentMonth = new Date().toISOString().substring(0, 7)
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState(currentMonth)

  // Load initial balance for bank balance calculation
  const [initialBalance, setInitialBalance] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    settingsService.getInitialBalance().then(balance => {
      if (isMounted) setInitialBalance(balance)
    })
    return () => { isMounted = false }
  }, [])

  // Calculate real bank balance (initial balance + transactions up to today only)
  const bankBalance = useMemo(() => {
    if (initialBalance === null) return null
    const today = new Date().toISOString().split('T')[0]
    const pastTransactions = allTransactionsFromHook.filter(t => t.date <= today)
    const transactionsTotal = pastTransactions.reduce((sum, t) => sum + t.amount, 0)
    return initialBalance + transactionsTotal
  }, [initialBalance, allTransactionsFromHook])

  // Check if selected month is current, past, or future
  const isCurrentMonth = selectedBudgetMonth === currentMonth
  const isFutureMonth = selectedBudgetMonth > currentMonth

  // Load budget data from database for selected month
  const categoryBudgets = useLiveQuery(() => categoryBudgetService.getAll()) ?? []
  const budgetConfig = useLiveQuery(
    () => monthlyBudgetConfigService.getByMonth(selectedBudgetMonth),
    [selectedBudgetMonth]
  )
  const latestBudgetConfig = useLiveQuery(() => monthlyBudgetConfigService.getLatest())
  const savingsGoals = useLiveQuery(() => savingsGoalService.getAll()) ?? []

  // Filter transactions for selected month
  // Use budgetMonth if set, otherwise use the transaction's natural date month
  const transactions = useMemo(() => {
    return allTransactionsFromHook.filter(t => {
      const effectiveMonth = t.budgetMonth || t.date.substring(0, 7)
      return effectiveMonth === selectedBudgetMonth
    })
  }, [allTransactionsFromHook, selectedBudgetMonth])

  // Calculate actual spending by category for selected month
  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.amount < 0) {
        const current = map.get(t.category) || 0
        map.set(t.category, current + Math.abs(t.amount))
      }
    }
    return map
  }, [transactions])

  // Calculate actual income for selected month
  const monthlyActualIncome = useMemo(() => {
    return transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  // Calculate spending by group
  const spendingByGroup = useMemo(() => {
    const result = new Map<BudgetGroupType, number>()
    result.set('needs', 0)
    result.set('wants', 0)
    result.set('savings', 0)

    for (const budget of categoryBudgets) {
      const spent = spendingByCategory.get(budget.categoryId) || 0
      const current = result.get(budget.group) || 0
      result.set(budget.group, current + spent)
    }

    return result
  }, [categoryBudgets, spendingByCategory])

  // Monthly income (from config or actual)
  // Use selected month's config, or fall back to latest config for future months
  const effectiveBudgetConfig = budgetConfig || (isFutureMonth ? latestBudgetConfig : null)

  const monthlyIncome = useMemo(() => {
    if (effectiveBudgetConfig?.useActualIncome && !isFutureMonth) {
      return monthlyActualIncome
    }
    return effectiveBudgetConfig?.monthlyIncome || 0
  }, [effectiveBudgetConfig, isFutureMonth, monthlyActualIncome])

  // Get fixed charges from current config
  const fixedCharges = useMemo(() => {
    return effectiveBudgetConfig?.fixedCharges || []
  }, [effectiveBudgetConfig])

  // Handler to update fixed charges
  const handleFixedChargesChange = useCallback(async (charges: FixedCharge[]) => {
    const existingConfig = budgetConfig || latestBudgetConfig
    const configToSave: MonthlyBudgetConfig = {
      id: existingConfig?.id || `config-${selectedBudgetMonth}`,
      month: selectedBudgetMonth,
      monthlyIncome: existingConfig?.monthlyIncome || 0,
      useActualIncome: existingConfig?.useActualIncome || false,
      fixedCharges: charges,
      createdAt: existingConfig?.createdAt || new Date().toISOString(),
    }
    await monthlyBudgetConfigService.upsert(configToSave)
    toast.success('Charges fixes mises à jour', 'Les modifications ont été enregistrées')
  }, [budgetConfig, latestBudgetConfig, selectedBudgetMonth, toast])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            Budget & Épargne
          </h1>
          {/* Month selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedBudgetMonth(m => getMonthOffset(m, -1))}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <span className={`font-medium min-w-[140px] text-center ${
              isFutureMonth ? 'text-blue-400' : isCurrentMonth ? 'text-green-400' : 'text-gray-400'
            }`}>
              {formatMonthLabel(selectedBudgetMonth)}
            </span>
            <button
              onClick={() => setSelectedBudgetMonth(m => getMonthOffset(m, 1))}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={() => setSelectedBudgetMonth(currentMonth)}
                className="text-xs text-blue-400 hover:text-blue-300 ml-2"
              >
                Aujourd'hui
              </button>
            )}
          </div>
          {isFutureMonth && (
            <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Planification à l'avance
            </p>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg" role="tablist">
          {[
            { id: 'overview' as const, label: 'Vue d\'ensemble', icon: Wallet },
            { id: 'categories' as const, label: 'Catégories', icon: Settings },
            { id: 'savings' as const, label: 'Épargne', icon: PiggyBank },
            { id: 'yearly' as const, label: 'Année', icon: Calendar },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Income Configuration Banner */}
      {!budgetConfig && (
        <Card className={`${isFutureMonth ? 'border-blue-500/50 bg-blue-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isFutureMonth ? (
                <Calendar className="w-5 h-5 text-blue-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              )}
              <div>
                <p className={`font-medium ${isFutureMonth ? 'text-blue-400' : 'text-yellow-400'}`}>
                  {isFutureMonth
                    ? `Préparez le budget de ${formatMonthLabel(selectedBudgetMonth)}`
                    : 'Configurez votre budget'
                  }
                </p>
                <p className="text-sm text-gray-400">
                  {isFutureMonth
                    ? 'Planifiez vos dépenses à l\'avance'
                    : 'Définissez votre revenu mensuel pour commencer'
                  }
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowIncomeModal(true)}
            >
              {isFutureMonth ? 'Planifier' : 'Configurer'}
            </Button>
          </div>
        </Card>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <BudgetOverview
          monthlyIncome={monthlyIncome}
          spendingByGroup={spendingByGroup}
          categoryBudgets={categoryBudgets}
          spendingByCategory={spendingByCategory}
          categories={categories}
          savingsGoals={savingsGoals}
          transactions={transactions}
          onConfigureIncome={() => setShowIncomeModal(true)}
          budgetConfig={budgetConfig}
          bankBalance={bankBalance}
          fixedCharges={fixedCharges}
          onFixedChargesChange={handleFixedChargesChange}
        />
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <CategoryBudgetManager
          categories={categories}
          categoryBudgets={categoryBudgets}
          spendingByCategory={spendingByCategory}
          monthlyIncome={monthlyIncome}
          onUpdate={() => toast.success('Budget mis à jour', 'Les modifications ont été enregistrées')}
        />
      )}

      {/* Savings Tab */}
      {activeTab === 'savings' && (
        <SavingsGoalsManager
          goals={savingsGoals}
          onAddGoal={() => {
            setEditingGoal(null)
            setShowGoalModal(true)
          }}
          onEditGoal={(goal) => {
            setEditingGoal(goal)
            setShowGoalModal(true)
          }}
        />
      )}

      {/* Yearly Tab */}
      {activeTab === 'yearly' && (
        <YearlyBudgetView
          savingsGoals={savingsGoals}
          monthlyIncome={monthlyIncome}
          transactions={allTransactionsFromHook}
        />
      )}

      {/* Income Modal */}
      {showIncomeModal && (
        <IncomeConfigModal
          config={budgetConfig}
          baseConfig={latestBudgetConfig}
          month={selectedBudgetMonth}
          isFutureMonth={isFutureMonth}
          actualIncome={monthlyActualIncome}
          categories={categories}
          onClose={() => setShowIncomeModal(false)}
          onSave={() => {
            setShowIncomeModal(false)
            toast.success(
              'Configuration sauvegardée',
              `Budget ${isFutureMonth ? 'planifié' : 'configuré'} pour ${formatMonthLabel(selectedBudgetMonth)}`
            )
          }}
        />
      )}

      {/* Savings Goal Modal */}
      {showGoalModal && (
        <SavingsGoalModal
          goal={editingGoal}
          onClose={() => {
            setShowGoalModal(false)
            setEditingGoal(null)
          }}
          onSave={() => {
            setShowGoalModal(false)
            setEditingGoal(null)
            toast.success(
              editingGoal ? 'Objectif mis à jour' : 'Objectif créé',
              'Votre objectif d\'épargne a été enregistré'
            )
          }}
        />
      )}

      {/* Quick Add Expense Button */}
      <QuickAddExpense
        categories={categories}
        categoryBudgets={categoryBudgets}
        budgetMonth={selectedBudgetMonth}
        onTransactionAdded={() => {
          toast.success('Dépense ajoutée', 'Votre dépense a été enregistrée')
        }}
      />
    </div>
  )
}

// Budget Overview Component - Redesigned for better UX
interface BudgetOverviewProps {
  monthlyIncome: number
  spendingByGroup: Map<BudgetGroupType, number>
  categoryBudgets: CategoryBudget[]
  spendingByCategory: Map<string, number>
  categories: Category[]
  savingsGoals: SavingsGoal[]
  transactions: import('@/types').Transaction[]
  onConfigureIncome: () => void
  budgetConfig: MonthlyBudgetConfig | null | undefined
  bankBalance: number | null
  fixedCharges: FixedCharge[]
  onFixedChargesChange: (charges: FixedCharge[]) => void
}

function BudgetOverview({
  monthlyIncome,
  spendingByGroup: _spendingByGroup, // Passed but realSpendingByGroup is calculated internally instead
  categoryBudgets,
  spendingByCategory,
  categories,
  savingsGoals,
  transactions,
  onConfigureIncome,
  budgetConfig,
  bankBalance,
  fixedCharges,
  onFixedChargesChange,
}: BudgetOverviewProps) {
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // Calculate total savings progress
  const totalSavingsCurrent = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0)

  // Calculate REAL spending by group
  // Rule: anything NOT explicitly in "needs" goes to "wants" by default
  const realSpendingByGroup = useMemo(() => {
    const result = new Map<BudgetGroupType, number>()
    result.set('needs', 0)
    result.set('wants', 0)
    result.set('savings', 0)

    // Get all category IDs explicitly assigned to "needs"
    const needsCategoryIds = new Set(
      categoryBudgets.filter(b => b.isActive && b.group === 'needs').map(b => b.categoryId)
    )

    for (const t of transactions) {
      if (t.amount >= 0) continue // Skip income

      const amount = Math.abs(t.amount)

      // Check if transaction has explicit budgetGroup (manual transactions)
      if (t.budgetGroup) {
        const current = result.get(t.budgetGroup) || 0
        result.set(t.budgetGroup, current + amount)
        continue
      }

      // If category is in "needs", add to needs, otherwise add to "wants"
      if (needsCategoryIds.has(t.category)) {
        const current = result.get('needs') || 0
        result.set('needs', current + amount)
      } else {
        const current = result.get('wants') || 0
        result.set('wants', current + amount)
      }
    }

    return result
  }, [transactions, categoryBudgets])

  // Calculate total fixed charges (all go to 'needs')
  const totalFixedCharges = useMemo(() => {
    return fixedCharges
      .filter(c => c.isEnabled)
      .reduce((sum, c) => sum + c.amount, 0)
  }, [fixedCharges])

  // Handler to move a category to another group
  const handleMoveCategoryGroup = useCallback(async (categoryId: string, newGroup: BudgetGroupType) => {
    const existingBudget = categoryBudgets.find(b => b.categoryId === categoryId)
    if (existingBudget) {
      await categoryBudgetService.update(existingBudget.id, { group: newGroup })
    } else {
      // Create a new budget entry for this category
      await categoryBudgetService.add({
        id: `budget-${categoryId}-${Date.now()}`,
        categoryId,
        group: newGroup,
        monthlyLimit: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
    }
  }, [categoryBudgets])

  // Detect orphaned charges (without budgetGroup) for migration
  const orphanedCharges = useMemo(() =>
    fixedCharges.filter(c => !c.budgetGroup),
    [fixedCharges]
  )

  // Auto-migrate orphaned charges based on categoryId patterns
  const migrateOrphanedCharges = useCallback(() => {
    const needsCategories = ['housing', 'telecom', 'transport', 'health', 'bank-fees', 'utilities']
    const migratedCharges = fixedCharges.map(charge => {
      if (charge.budgetGroup) return charge
      const isNeeds = needsCategories.some(cat => charge.categoryId.includes(cat))
      return { ...charge, budgetGroup: isNeeds ? 'needs' as const : 'wants' as const }
    })
    onFixedChargesChange(migratedCharges)
  }, [fixedCharges, onFixedChargesChange])

  // Calculate budgets with limits
  const budgetsByGroup = useMemo(() => {
    const result = new Map<BudgetGroupType, { budget: number; limit: number }>()

    for (const group of BUDGET_GROUPS) {
      if (group.id === 'savings') continue

      const targetBudget = (monthlyIncome * group.targetPercent) / 100
      const groupBudgets = categoryBudgets.filter(b => b.isActive && b.group === group.id)
      const configuredLimit = groupBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0)

      result.set(group.id, {
        budget: targetBudget,
        limit: configuredLimit > 0 ? configuredLimit : targetBudget,
      })
    }

    return result
  }, [monthlyIncome, categoryBudgets])

  // Calculate total theoretical remaining for both groups
  // IMPORTANT: All hooks must be called before any conditional returns
  const totalTheoreticalRemaining = useMemo(() => {
    if (monthlyIncome === 0) return 0
    let total = 0
    for (const group of BUDGET_GROUPS.filter(g => g.id !== 'savings')) {
      const budgetInfo = budgetsByGroup.get(group.id)
      const spent = realSpendingByGroup.get(group.id) || 0
      if (budgetInfo) {
        total += Math.max(0, budgetInfo.limit - spent)
      }
    }
    return total
  }, [monthlyIncome, budgetsByGroup, realSpendingByGroup])

  // Calculate realistic remaining based on bank balance
  const getRealisticRemaining = useCallback((theoreticalRemaining: number) => {
    if (bankBalance === null || bankBalance <= 0) return 0
    if (totalTheoreticalRemaining <= 0) return 0
    // Proportional split of bank balance based on theoretical remaining
    const ratio = theoreticalRemaining / totalTheoreticalRemaining
    return Math.min(theoreticalRemaining, bankBalance * ratio)
  }, [bankBalance, totalTheoreticalRemaining])

  // Now we can have conditional returns - all hooks are defined above
  if (monthlyIncome === 0) {
    return (
      <Card className="text-center py-12">
        <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h2 className="text-xl font-bold text-white mb-2">Configurez votre budget</h2>
        <p className="text-gray-400 mb-6">
          Commencez par définir votre revenu mensuel pour suivre votre budget
        </p>
        <Button variant="primary" onClick={onConfigureIncome}>
          <Settings className="w-4 h-4 mr-2" />
          Configurer le revenu
        </Button>
      </Card>
    )
  }

  // Calculate totals for the visual summary
  const totalExpenses = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const variableExpenses = totalExpenses - totalFixedCharges
  const remainingBudget = monthlyIncome - totalExpenses

  return (
    <div className="space-y-6">
      {/* Migration Warning for orphaned charges */}
      {orphanedCharges.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-400">
                  {orphanedCharges.length} charge(s) fixe(s) à assigner
                </p>
                <p className="text-sm text-gray-400">
                  Assignez vos charges fixes à "Besoins" ou "Envies" pour un suivi complet
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={migrateOrphanedCharges}
            >
              Assigner automatiquement
            </Button>
          </div>
        </Card>
      )}

      {/* Bank Balance Card - What you actually have */}
      {bankBalance !== null && (
        <Card className={`bg-gradient-to-r ${bankBalance < totalTheoreticalRemaining ? 'from-orange-500/10 to-red-500/10 border-orange-500/30' : 'from-blue-500/10 to-purple-500/10 border-blue-500/30'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Solde bancaire actuel</p>
              <p className={`text-3xl font-bold ${bankBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {formatMoney(bankBalance)}
              </p>
              {bankBalance < totalTheoreticalRemaining && bankBalance > 0 && (
                <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Moins que le budget restant ({formatMoney(totalTheoreticalRemaining)})
                </p>
              )}
              {bankBalance <= 0 && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Compte à découvert !
                </p>
              )}
              {bankBalance >= totalTheoreticalRemaining && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Suffisant pour le budget restant
                </p>
              )}
            </div>
            <div className={`p-4 rounded-xl ${bankBalance < totalTheoreticalRemaining ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
              <Wallet className={`w-8 h-8 ${bankBalance < totalTheoreticalRemaining ? 'text-orange-400' : 'text-blue-400'}`} />
            </div>
          </div>
        </Card>
      )}

      {/* Main Budget Cards - Besoins & Envies */}
      <div className="grid md:grid-cols-2 gap-6">
        {BUDGET_GROUPS.filter(g => g.id !== 'savings').map(group => {
          const budgetInfo = budgetsByGroup.get(group.id)
          if (!budgetInfo) return null

          // Fixed charges only apply to 'needs'
          const fixedSpent = group.id === 'needs' ? totalFixedCharges : 0
          // Variable spending (total - fixed)
          const totalSpent = realSpendingByGroup.get(group.id) || 0
          const variableSpent = Math.max(0, totalSpent - fixedSpent)

          const theoreticalRemaining = Math.max(0, budgetInfo.limit - totalSpent)
          const remaining = bankBalance !== null ? getRealisticRemaining(theoreticalRemaining) : theoreticalRemaining
          const percentUsed = budgetInfo.limit > 0 ? (totalSpent / budgetInfo.limit) * 100 : 0
          const percentFixed = budgetInfo.limit > 0 ? (fixedSpent / budgetInfo.limit) * 100 : 0
          const percentVariable = budgetInfo.limit > 0 ? (variableSpent / budgetInfo.limit) * 100 : 0
          const isOverBudget = totalSpent > budgetInfo.limit
          const isWarning = percentUsed >= 80 && percentUsed < 100
          const isLimitedByBalance = bankBalance !== null && remaining < theoreticalRemaining

          // Get category breakdown for variable spending
          // For "needs": only explicitly assigned categories
          // For "wants": ALL categories with spending that are NOT in "needs" (default behavior)
          const needsCategoryIds = new Set(
            categoryBudgets.filter(b => b.isActive && b.group === 'needs').map(b => b.categoryId)
          )

          let displayCategories: Array<{ categoryId: string; budget: CategoryBudget | null; spent: number }>

          if (group.id === 'needs') {
            // Needs: only explicitly assigned categories
            displayCategories = categoryBudgets
              .filter(b => b.isActive && b.group === 'needs')
              .map(b => ({
                categoryId: b.categoryId,
                budget: b,
                spent: spendingByCategory.get(b.categoryId) || 0,
              }))
          } else {
            // Wants: explicitly configured wants + all spending not in needs
            const wantsBudgetCategoryIds = new Set(
              categoryBudgets.filter(b => b.isActive && b.group === 'wants').map(b => b.categoryId)
            )

            // Start with explicitly configured wants categories
            const configuredWants = categoryBudgets
              .filter(b => b.isActive && b.group === 'wants')
              .map(b => ({
                categoryId: b.categoryId,
                budget: b,
                spent: spendingByCategory.get(b.categoryId) || 0,
              }))

            // Add categories with spending that are NOT in needs and NOT already in configured wants
            const unconfiguredSpending = Array.from(spendingByCategory.entries())
              .filter(([catId]) => !needsCategoryIds.has(catId) && !wantsBudgetCategoryIds.has(catId))
              .map(([catId, spent]) => ({
                categoryId: catId,
                budget: null,
                spent,
              }))

            displayCategories = [...configuredWants, ...unconfiguredSpending]
          }

          // Sort by amount spent (highest first)
          displayCategories.sort((a, b) => b.spent - a.spent)

          return (
            <Card
              key={group.id}
              className={`relative overflow-hidden ${
                isOverBudget
                  ? 'border-red-500/50 bg-red-500/5'
                  : isWarning
                  ? 'border-yellow-500/50 bg-yellow-500/5'
                  : ''
              }`}
            >
              {/* Header with prominent budget target */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${group.color}20` }}
                    >
                      {group.id === 'needs' ? (
                        <Wallet className="w-5 h-5" style={{ color: group.color }} />
                      ) : (
                        <Target className="w-5 h-5" style={{ color: group.color }} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{group.name}</h3>
                      <p className="text-xs text-gray-400">{group.targetPercent}% du revenu</p>
                    </div>
                  </div>
                  {isOverBudget && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-400 font-medium">Dépassé</span>
                    </div>
                  )}
                  {isWarning && !isOverBudget && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400 font-medium">Attention</span>
                    </div>
                  )}
                </div>
                {/* Budget Target Banner */}
                <div
                  className="px-4 py-2 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: `${group.color}15`, borderLeft: `4px solid ${group.color}` }}
                >
                  <span className="text-sm text-gray-300">Budget {group.targetPercent}%</span>
                  <span className="text-xl font-bold" style={{ color: group.color }}>
                    {formatMoney(budgetInfo.budget)}
                  </span>
                </div>
              </div>

              {/* Main Number - What's LEFT (realistic based on bank balance) */}
              <div className="text-center py-4 mb-4 bg-gray-800/50 rounded-xl">
                <p className="text-sm text-gray-400 mb-1">
                  {isOverBudget ? 'Dépassement de' : 'Tu peux encore dépenser'}
                </p>
                <p className={`text-4xl font-bold ${
                  isOverBudget
                    ? 'text-red-400'
                    : isLimitedByBalance
                    ? 'text-orange-400'
                    : isWarning
                    ? 'text-yellow-400'
                    : 'text-white'
                }`}>
                  {isOverBudget ? formatMoney(totalSpent - budgetInfo.limit) : formatMoney(remaining)}
                </p>
                {isLimitedByBalance && !isOverBudget && (
                  <p className="text-xs text-orange-400 mt-1">
                    Limité par ton solde (budget: {formatMoney(theoreticalRemaining)})
                  </p>
                )}
                {!isLimitedByBalance && !isOverBudget && (
                  <p className="text-xs text-gray-500 mt-1">
                    selon ton solde réel
                  </p>
                )}
              </div>

              {/* Stacked Progress Bar - Fixed (dark) + Variable (light) */}
              <div className="mb-4">
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden relative flex">
                  {/* Fixed charges portion (darker) */}
                  {percentFixed > 0 && (
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percentFixed, 100)}%`,
                        backgroundColor: isOverBudget ? '#b91c1c' : `${group.color}`,
                        opacity: 0.7,
                      }}
                    />
                  )}
                  {/* Variable spending portion (lighter) */}
                  {percentVariable > 0 && (
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percentVariable, 100 - percentFixed)}%`,
                        backgroundColor: isOverBudget ? '#ef4444' : isWarning ? '#f59e0b' : group.color,
                      }}
                    />
                  )}
                  {/* Warning threshold marker at 80% */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-500/50"
                    style={{ left: '80%' }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">0 €</span>
                  <div className="flex items-center gap-2">
                    {fixedSpent > 0 && (
                      <span className="text-gray-400">
                        Fixe: {formatMoney(fixedSpent)}
                      </span>
                    )}
                    {variableSpent > 0 && (
                      <span className="text-gray-400">
                        Variable: {formatMoney(variableSpent)}
                      </span>
                    )}
                    <span className={`font-medium ${isOverBudget ? 'text-red-400' : ''}`}>
                      {formatPercent(percentUsed, 0)}
                    </span>
                  </div>
                  <span className="text-gray-500">{formatMoney(budgetInfo.limit)}</span>
                </div>
              </div>

              {/* Budget vs Spent Summary */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-800/30 rounded-lg mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Budget</p>
                  <p className="text-lg font-semibold text-white">{formatMoney(budgetInfo.limit)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Dépensé</p>
                  <p className={`text-lg font-semibold ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
                    {formatMoney(totalSpent)}
                  </p>
                  {fixedSpent > 0 && variableSpent > 0 && (
                    <p className="text-xs text-gray-500">
                      {formatMoney(fixedSpent)} fixe + {formatMoney(variableSpent)} var.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Reste</p>
                  <p className={`text-lg font-semibold ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                    {isOverBudget ? `-${formatMoney(totalSpent - budgetInfo.limit)}` : formatMoney(budgetInfo.limit - totalSpent)}
                  </p>
                </div>
              </div>

              {/* Fixed Charges Section - Only for Besoins */}
              {group.id === 'needs' && (
                <div className="mb-4 p-3 bg-gray-800/30 rounded-lg">
                  <InlineFixedCharges
                    charges={fixedCharges}
                    budgetGroup={group.id}
                    categories={categories}
                    onChange={onFixedChargesChange}
                    groupColor={group.color}
                  />
                </div>
              )}

              {/* Categories with spending */}
              {displayCategories.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-2">
                      <List className="w-3 h-3" />
                      {group.id === 'needs' ? 'Dépenses variables' : 'Dépenses'}
                    </p>
                    <p className="text-xs text-gray-400">
                      dépensé{group.id === 'needs' ? ' / budget' : ''}
                    </p>
                  </div>
                  {displayCategories.map(item => {
                    const category = categoryMap.get(item.categoryId)
                    const monthlyLimit = item.budget?.monthlyLimit || 0
                    const catPercent = monthlyLimit > 0 ? (item.spent / monthlyLimit) * 100 : 0
                    const catOver = monthlyLimit > 0 && item.spent > monthlyLimit
                    const otherGroup = group.id === 'needs' ? 'wants' : 'needs'
                    const otherGroupName = group.id === 'needs' ? 'Envies' : 'Besoins'

                    return (
                      <div key={item.categoryId} className="p-2 bg-gray-800/30 rounded-lg group">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category?.color || '#94a3b8' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-white truncate">
                                {category?.name || item.categoryId}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${catOver ? 'text-red-400' : 'text-white'}`}>
                                  {formatMoney(item.spent)}
                                </span>
                                {group.id === 'needs' && (
                                  <>
                                    <span className="text-gray-500">/</span>
                                    <span className="text-sm text-gray-400">
                                      {monthlyLimit > 0 ? formatMoney(monthlyLimit) : '—'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {group.id === 'needs' && monthlyLimit > 0 && (
                              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(catPercent, 100)}%`,
                                    backgroundColor: catOver ? '#ef4444' : catPercent > 80 ? '#f59e0b' : category?.color || '#94a3b8',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleMoveCategoryGroup(item.categoryId, otherGroup)}
                            className="p-1.5 bg-gray-700 hover:bg-purple-500/30 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title={`Déplacer vers ${otherGroupName}`}
                          >
                            {group.id === 'needs' ? (
                              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                              <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {displayCategories.length === 0 && group.id === 'wants' && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Aucune dépense ce mois-ci
                </p>
              )}
              {displayCategories.length === 0 && group.id === 'needs' && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Configurez vos catégories dans l'onglet "Catégories"
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* Épargne Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-500/20">
              <PiggyBank className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Épargne</h3>
              <p className="text-xs text-gray-400">20% du revenu • Objectif: {formatMoney((monthlyIncome * 20) / 100)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-400">{formatMoney(totalSavingsCurrent)}</p>
            <p className="text-xs text-gray-500">épargnés</p>
          </div>
        </div>

        {savingsGoals.length > 0 ? (
          <div className="space-y-3">
            {savingsGoals
              .filter(g => !g.isCompleted)
              .sort((a, b) => a.priority - b.priority)
              .slice(0, 3)
              .map(goal => {
                const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0

                return (
                  <div key={goal.id} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${goal.color}20` }}
                    >
                      <Target className="w-4 h-4" style={{ color: goal.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{goal.name}</span>
                        <span className="text-xs text-gray-400">
                          {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(progress, 100)}%`,
                            backgroundColor: goal.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            Aucun objectif d'épargne configuré
          </p>
        )}
      </Card>

      {/* VISUAL MONEY FLOW SUMMARY */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-white">Où va ton argent ce mois-ci ?</h2>
          <p className="text-xs text-gray-400">Basé sur {transactions.filter(t => t.amount < 0).length} transactions importées</p>
        </div>

        {/* Visual Flow */}
        <div className="relative">
          {/* Step 1: Income */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-32 text-right">
              <span className="text-sm text-gray-400">Revenus</span>
            </div>
            <div className="flex-1 h-10 bg-gray-700 rounded-lg overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 flex items-center justify-end pr-3"
                style={{ width: '100%' }}
              >
                <span className="text-white font-bold text-lg">+{formatMoney(monthlyIncome)}</span>
              </div>
            </div>
          </div>

          {/* Arrow down */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-32" />
            <div className="flex-1 flex justify-center">
              <ChevronDown className="w-6 h-6 text-gray-500" />
            </div>
          </div>

          {/* Step 2: Fixed Charges */}
          {totalFixedCharges > 0 && (
            <>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-32 text-right">
                  <span className="text-sm text-gray-400">Charges fixes</span>
                </div>
                <div className="flex-1 h-8 bg-gray-700 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-end pr-3"
                    style={{ width: `${Math.min((totalFixedCharges / monthlyIncome) * 100, 100)}%` }}
                  >
                    <span className="text-white font-semibold">-{formatMoney(totalFixedCharges)}</span>
                  </div>
                </div>
              </div>

              {/* Arrow down */}
              <div className="flex items-center gap-4 mb-2">
                <div className="w-32" />
                <div className="flex-1 flex justify-center">
                  <ChevronDown className="w-6 h-6 text-gray-500" />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Variable Expenses (the actual spending) */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-32 text-right">
              <span className="text-sm text-gray-400">Dépenses</span>
            </div>
            <div className="flex-1 h-10 bg-gray-700 rounded-lg overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-500 flex items-center justify-end pr-3"
                style={{ width: `${Math.min((variableExpenses / monthlyIncome) * 100, 100)}%` }}
              >
                <span className="text-white font-bold text-lg">-{formatMoney(variableExpenses)}</span>
              </div>
            </div>
          </div>

          {/* Arrow down */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-32" />
            <div className="flex-1 flex justify-center">
              <ChevronDown className="w-6 h-6 text-gray-500" />
            </div>
          </div>

          {/* Step 4: Remaining */}
          <div className="flex items-center gap-4">
            <div className="w-32 text-right">
              <span className="text-sm font-medium text-white">RESTE</span>
            </div>
            <div className="flex-1 h-12 bg-gray-700 rounded-lg overflow-hidden relative border-2 border-dashed border-gray-600">
              <div
                className={`h-full flex items-center justify-end pr-3 ${
                  remainingBudget >= 0
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                    : 'bg-gradient-to-r from-red-700 to-red-600'
                }`}
                style={{ width: `${Math.min(Math.max((remainingBudget / monthlyIncome) * 100, 0), 100)}%` }}
              >
              </div>
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xl ${
                remainingBudget >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {remainingBudget >= 0 ? '' : '-'}{formatMoney(Math.abs(remainingBudget))}
              </span>
            </div>
          </div>
        </div>

        {/* Summary equation */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex flex-wrap justify-center items-center gap-2 text-sm">
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full font-medium">
            {formatMoney(monthlyIncome)}
          </span>
          <span className="text-gray-500">−</span>
          {totalFixedCharges > 0 && (
            <>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full font-medium">
                {formatMoney(totalFixedCharges)} fixes
              </span>
              <span className="text-gray-500">−</span>
            </>
          )}
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full font-medium">
            {formatMoney(variableExpenses)} dépensé
          </span>
          <span className="text-gray-500">=</span>
          <span className={`px-3 py-1 rounded-full font-bold ${
            remainingBudget >= 0
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {remainingBudget >= 0 ? '' : '-'}{formatMoney(Math.abs(remainingBudget))} reste
          </span>
        </div>
      </Card>

      {/* Income Config Reminder */}
      {budgetConfig && (
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Wallet className="w-4 h-4" />
            <span>Revenu mensuel: <strong className="text-green-400">{formatMoney(monthlyIncome)}</strong></span>
            {budgetConfig.useActualIncome && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Auto</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onConfigureIncome}>
            Modifier
          </Button>
        </div>
      )}

    </div>
  )
}

// Preset colors for new categories
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

// Category Budget Manager Component
interface CategoryBudgetManagerProps {
  categories: Category[]
  categoryBudgets: CategoryBudget[]
  spendingByCategory: Map<string, number>
  monthlyIncome: number
  onUpdate: () => void
}

function CategoryBudgetManager({
  categories,
  categoryBudgets,
  spendingByCategory,
  monthlyIncome,
  onUpdate,
}: CategoryBudgetManagerProps) {
  const toast = useToast()
  const [budgetInputs, setBudgetInputs] = useState<Map<string, { group: BudgetGroupType; limit: string }>>(new Map())

  // State for new category form
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0])

  // Initialize inputs from existing budgets
  useEffect(() => {
    const inputs = new Map<string, { group: BudgetGroupType; limit: string }>()
    for (const budget of categoryBudgets) {
      inputs.set(budget.categoryId, {
        group: budget.group,
        limit: budget.monthlyLimit.toString(),
      })
    }
    setBudgetInputs(inputs)
  }, [categoryBudgets])

  const handleSave = async (categoryId: string) => {
    const input = budgetInputs.get(categoryId)
    if (!input) return

    const budget: CategoryBudget = {
      id: uuidv4(),
      categoryId,
      group: input.group,
      monthlyLimit: parseFloat(input.limit) || 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    }

    await categoryBudgetService.upsert(budget)
    onUpdate()
  }

  const handleInputChange = (categoryId: string, field: 'group' | 'limit', value: string) => {
    setBudgetInputs(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(categoryId) || { group: 'needs' as const, limit: '' }
      newMap.set(categoryId, { ...current, [field]: value })
      return newMap
    })
  }

  // Create new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Nom requis', 'Veuillez entrer un nom pour la catégorie')
      return
    }

    const maxOrder = Math.max(0, ...categories.map(c => c.order))

    const newCategory: Category = {
      id: newCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now(),
      name: newCategoryName.trim(),
      icon: 'Tag',
      color: newCategoryColor,
      isIncome: false,
      isExcludedFromStats: false,
      order: maxOrder + 1,
      isDefault: false,
      createdAt: new Date().toISOString(),
    }

    try {
      await categoryService.add(newCategory)
      toast.success('Catégorie créée', `"${newCategoryName}" a été ajoutée`)
      setNewCategoryName('')
      setNewCategoryColor(PRESET_COLORS[0])
      setShowNewCategoryForm(false)
    } catch {
      toast.error('Erreur', 'Impossible de créer la catégorie')
    }
  }

  // Filter expense categories
  const expenseCategories = categories.filter(c => !c.isIncome)

  // Calculate real-time totals from current inputs
  const budgetTotals = useMemo(() => {
    let needsTotal = 0
    let wantsTotal = 0

    for (const [, input] of budgetInputs) {
      const amount = parseFloat(input.limit) || 0
      if (input.group === 'needs') {
        needsTotal += amount
      } else if (input.group === 'wants') {
        wantsTotal += amount
      }
    }

    const totalAllocated = needsTotal + wantsTotal
    const remaining = monthlyIncome - totalAllocated

    // Target amounts based on 50/30/20 rule
    const needsTarget = monthlyIncome * 0.5
    const wantsTarget = monthlyIncome * 0.3
    const savingsTarget = monthlyIncome * 0.2

    return {
      needsTotal,
      wantsTotal,
      totalAllocated,
      remaining,
      needsTarget,
      wantsTarget,
      savingsTarget,
      needsPercent: monthlyIncome > 0 ? (needsTotal / monthlyIncome) * 100 : 0,
      wantsPercent: monthlyIncome > 0 ? (wantsTotal / monthlyIncome) * 100 : 0,
    }
  }, [budgetInputs, monthlyIncome])

  return (
    <div className="space-y-4">
      {/* Budget summary - real-time calculation */}
      {monthlyIncome > 0 && (
        <Card className="bg-gradient-to-r from-gray-800 to-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="font-medium">Résumé de l'allocation</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {/* Income */}
            <div className="text-center p-3 bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Revenu</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(monthlyIncome)}</p>
            </div>

            {/* Besoins */}
            <div className="text-center p-3 bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Besoins ({formatPercent(budgetTotals.needsPercent, 0)})</p>
              <p className={`text-lg font-bold ${budgetTotals.needsTotal > budgetTotals.needsTarget ? 'text-red-400' : 'text-blue-400'}`}>
                {formatMoney(budgetTotals.needsTotal)}
              </p>
              <p className="text-xs text-gray-500">cible: {formatMoney(budgetTotals.needsTarget)}</p>
            </div>

            {/* Envies */}
            <div className="text-center p-3 bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Envies ({formatPercent(budgetTotals.wantsPercent, 0)})</p>
              <p className={`text-lg font-bold ${budgetTotals.wantsTotal > budgetTotals.wantsTarget ? 'text-red-400' : 'text-yellow-400'}`}>
                {formatMoney(budgetTotals.wantsTotal)}
              </p>
              <p className="text-xs text-gray-500">cible: {formatMoney(budgetTotals.wantsTarget)}</p>
            </div>

            {/* Remaining */}
            <div className="text-center p-3 bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Reste à allouer</p>
              <p className={`text-lg font-bold ${budgetTotals.remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {budgetTotals.remaining >= 0 ? formatMoney(budgetTotals.remaining) : `-${formatMoney(Math.abs(budgetTotals.remaining))}`}
              </p>
              <p className="text-xs text-gray-500">épargne cible: {formatMoney(budgetTotals.savingsTarget)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(budgetTotals.needsPercent, 100)}%` }}
                title={`Besoins: ${formatPercent(budgetTotals.needsPercent, 0)}`}
              />
              <div
                className="h-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${Math.min(budgetTotals.wantsPercent, 100 - budgetTotals.needsPercent)}%` }}
                title={`Envies: ${formatPercent(budgetTotals.wantsPercent, 0)}`}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Besoins
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" /> Envies
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-600" /> Non alloué
                </span>
              </div>
              <span>100%</span>
            </div>
          </div>

          {budgetTotals.remaining < 0 && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Attention : vous avez alloué plus que votre revenu mensuel !</span>
            </div>
          )}

          {budgetTotals.remaining > 0 && budgetTotals.remaining < budgetTotals.savingsTarget && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Il reste {formatMoney(budgetTotals.remaining)} - pensez à l'épargne (cible 20%: {formatMoney(budgetTotals.savingsTarget)})</span>
            </div>
          )}
        </Card>
      )}

      <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <CardTitle icon={<Settings className="w-5 h-5 text-blue-400" />}>
            Configuration des budgets par catégorie
          </CardTitle>
          <p className="text-gray-400 text-sm mt-1">
            Assignez chaque catégorie à un groupe (Besoins/Envies) et définissez une limite mensuelle.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Nouvelle catégorie
        </Button>
      </div>

      {/* New category form */}
      {showNewCategoryForm && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h4 className="font-medium text-blue-400 mb-3">Créer une catégorie de dépense</h4>
          <div className="space-y-3">
            {/* Name input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Cadeaux, Sport, Animaux..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      newCategoryColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewCategoryForm(false)
                  setNewCategoryName('')
                }}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
              >
                Créer la catégorie
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {expenseCategories.map(category => {
          const input = budgetInputs.get(category.id) || { group: 'needs' as const, limit: '' }
          const spent = spendingByCategory.get(category.id) || 0
          const existingBudget = categoryBudgets.find(b => b.categoryId === category.id)

          return (
            <div
              key={category.id}
              className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-gray-700/30 rounded-lg"
            >
              {/* Category name */}
              <div className="flex items-center gap-2 md:w-40">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm font-medium">{category.name}</span>
              </div>

              {/* Current spending */}
              <div className="text-sm text-gray-400 md:w-28">
                Dépensé: <span className="text-white">{formatMoney(spent)}</span>
              </div>

              {/* Group selector */}
              <select
                value={input.group}
                onChange={(e) => handleInputChange(category.id, 'group', e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm md:w-32"
              >
                {BUDGET_GROUPS.filter(g => g.id !== 'savings').map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>

              {/* Budget limit input */}
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  value={input.limit}
                  onChange={(e) => handleInputChange(category.id, 'limit', e.target.value)}
                  placeholder="Limite"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm w-28"
                />
                <span className="text-gray-400">€/mois</span>
              </div>

              {/* Save button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSave(category.id)}
              >
                {existingBudget ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          )
        })}
      </div>
    </Card>
    </div>
  )
}

// Savings Goals Manager Component
interface SavingsGoalsManagerProps {
  goals: SavingsGoal[]
  onAddGoal: () => void
  onEditGoal: (goal: SavingsGoal) => void
}

function SavingsGoalsManager({ goals, onAddGoal, onEditGoal }: SavingsGoalsManagerProps) {
  const toast = useToast()
  const assetAccounts = useLiveQuery(() => assetAccountService.getActive()) ?? []
  const assetAccountMap = useMemo(() => new Map(assetAccounts.map(a => [a.id, a])), [assetAccounts])

  const handleDelete = async (goal: SavingsGoal) => {
    if (confirm(`Supprimer l'objectif "${goal.name}" ?`)) {
      await savingsGoalService.delete(goal.id)
      toast.success('Objectif supprimé', `"${goal.name}" a été supprimé`)
    }
  }

  const handleAddContribution = async (goal: SavingsGoal) => {
    const amount = prompt('Montant à ajouter (€):')
    if (!amount) return

    const value = parseFloat(amount)
    if (isNaN(value) || value <= 0) {
      toast.error('Montant invalide', 'Veuillez entrer un nombre positif')
      return
    }

    await savingsGoalService.addContribution(goal.id, value)

    const linkedAccount = goal.linkedAssetAccountId ? assetAccountMap.get(goal.linkedAssetAccountId) : null
    if (linkedAccount) {
      toast.success(
        'Contribution ajoutée',
        `+${formatMoney(value)} ajouté à "${goal.name}" et au compte "${linkedAccount.name}"`
      )
    } else {
      toast.success('Contribution ajoutée', `+${formatMoney(value)} ajouté à "${goal.name}"`)
    }
  }

  const activeGoals = goals.filter(g => !g.isCompleted)
  const completedGoals = goals.filter(g => g.isCompleted)

  return (
    <div className="space-y-6">
      {/* Add goal button */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={onAddGoal} leftIcon={<Plus className="w-4 h-4" />}>
          Nouvel objectif
        </Button>
      </div>

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {activeGoals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
            const remaining = goal.targetAmount - goal.currentAmount
            const daysLeft = goal.deadline
              ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null
            const monthsLeft = daysLeft && daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30)) : null
            const monthlyNeeded = monthsLeft && remaining > 0
              ? remaining / monthsLeft
              : null
            const isOnTrack = !monthlyNeeded || (goal.monthlyContribution >= monthlyNeeded)

            return (
              <Card key={goal.id} className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${goal.color}20` }}
                    >
                      <Target className="w-5 h-5" style={{ color: goal.color }} />
                    </div>
                    <div>
                      <h3 className="font-medium">{goal.name}</h3>
                      {goal.deadline && (
                        <p className="text-xs text-gray-500">
                          Échéance: {new Date(goal.deadline).toLocaleDateString('fr-FR')}
                          {monthsLeft !== null && (
                            <span className="ml-1">({monthsLeft} mois)</span>
                          )}
                        </p>
                      )}
                      {goal.linkedAssetAccountId && assetAccountMap.get(goal.linkedAssetAccountId) && (
                        <p className="text-xs text-blue-400 flex items-center gap-1 mt-0.5">
                          <Link className="w-3 h-3" />
                          {assetAccountMap.get(goal.linkedAssetAccountId)?.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditGoal(goal)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Amount display */}
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <span className="text-2xl font-bold" style={{ color: goal.color }}>
                      {formatMoney(goal.currentAmount)}
                    </span>
                    <span className="text-gray-400 text-sm ml-1">
                      / {formatMoney(goal.targetAmount)}
                    </span>
                  </div>
                  <span className="text-sm font-medium" style={{ color: goal.color }}>
                    {formatPercent(progress, 0)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: goal.color,
                    }}
                  />
                </div>

                {/* Monthly info */}
                <div className="flex items-center justify-between text-xs mb-3 p-2 bg-gray-700/30 rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Prévu:</span>
                      <span className="text-white font-medium">
                        {goal.monthlyContribution > 0 ? `${formatMoney(goal.monthlyContribution)}/mois` : 'Non défini'}
                      </span>
                    </div>
                    {monthlyNeeded && monthlyNeeded > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Requis:</span>
                        <span className={isOnTrack ? 'text-green-400' : 'text-yellow-400'}>
                          {formatMoney(monthlyNeeded)}/mois
                        </span>
                      </div>
                    )}
                  </div>
                  {monthlyNeeded && (
                    <div className={`px-2 py-1 rounded text-xs ${isOnTrack ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {isOnTrack ? 'En bonne voie' : 'À ajuster'}
                    </div>
                  )}
                </div>

                {/* Action */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddContribution(goal)}
                  leftIcon={<Plus className="w-3 h-3" />}
                  className="w-full"
                >
                  Ajouter une contribution
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {activeGoals.length === 0 && (
        <Card className="text-center py-12">
          <PiggyBank className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">Aucun objectif d'épargne</h3>
          <p className="text-gray-400 mb-4">
            Créez votre premier objectif pour commencer à épargner
          </p>
          <Button variant="primary" onClick={onAddGoal} leftIcon={<Plus className="w-4 h-4" />}>
            Créer un objectif
          </Button>
        </Card>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <Card>
          <CardTitle icon={<Check className="w-5 h-5 text-green-400" />}>
            Objectifs atteints
          </CardTitle>
          <div className="space-y-2 mt-4">
            {completedGoals.map(goal => (
              <div
                key={goal.id}
                className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span>{goal.name}</span>
                </div>
                <span className="text-green-400 font-medium">
                  {formatMoney(goal.targetAmount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// Yearly Budget View Component
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

interface YearlyBudgetViewProps {
  savingsGoals: SavingsGoal[]
  monthlyIncome: number
  transactions: import('@/types').Transaction[]
}

function YearlyBudgetView({ savingsGoals, monthlyIncome: _monthlyIncome, transactions }: YearlyBudgetViewProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const currentMonth = new Date().getMonth()

  // Calculate monthly expenses from transactions
  const monthlyExpenses = useMemo(() => {
    const expenses = new Map<string, number>()
    for (const t of transactions) {
      if (t.amount < 0) {
        const month = t.date.substring(0, 7)
        if (month.startsWith(selectedYear.toString())) {
          const current = expenses.get(month) || 0
          expenses.set(month, current + Math.abs(t.amount))
        }
      }
    }
    return expenses
  }, [transactions, selectedYear])

  // Calculate monthly income from transactions
  const monthlyIncomeActual = useMemo(() => {
    const income = new Map<string, number>()
    for (const t of transactions) {
      if (t.amount > 0) {
        const month = t.date.substring(0, 7)
        if (month.startsWith(selectedYear.toString())) {
          const current = income.get(month) || 0
          income.set(month, current + t.amount)
        }
      }
    }
    return income
  }, [transactions, selectedYear])

  // Total planned monthly savings
  const totalPlannedMonthlySavings = savingsGoals
    .filter(g => !g.isCompleted)
    .reduce((sum, g) => sum + (g.monthlyContribution || 0), 0)

  // Calculate yearly summary
  const yearlySummary = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    let totalSavingsPlanned = 0

    for (let i = 0; i < 12; i++) {
      const monthKey = `${selectedYear}-${String(i + 1).padStart(2, '0')}`
      const isCurrentOrPast = selectedYear < currentYear || (selectedYear === currentYear && i <= currentMonth)

      if (isCurrentOrPast) {
        totalIncome += monthlyIncomeActual.get(monthKey) || 0
        totalExpenses += monthlyExpenses.get(monthKey) || 0
      }
      totalSavingsPlanned += totalPlannedMonthlySavings
    }

    return {
      totalIncome,
      totalExpenses,
      totalBalance: totalIncome - totalExpenses,
      totalSavingsPlanned,
    }
  }, [selectedYear, monthlyIncomeActual, monthlyExpenses, totalPlannedMonthlySavings, currentYear, currentMonth])

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">{selectedYear}</h2>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={selectedYear >= currentYear}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </Card>

      {/* Yearly summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-400 mb-1">Revenus totaux</p>
          <p className="text-lg font-bold text-green-400">{formatMoney(yearlySummary.totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">Dépenses totales</p>
          <p className="text-lg font-bold text-red-400">{formatMoney(yearlySummary.totalExpenses)}</p>
        </Card>
        <Card className={yearlySummary.totalBalance < 0 ? 'border-red-500/50 bg-red-500/5' : ''}>
          <p className="text-xs text-gray-400 mb-1">
            {yearlySummary.totalBalance >= 0 ? 'Balance' : 'Déficit'}
          </p>
          <p className={`text-lg font-bold ${yearlySummary.totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {yearlySummary.totalBalance >= 0
              ? formatMoney(yearlySummary.totalBalance)
              : `-${formatMoney(Math.abs(yearlySummary.totalBalance))}`}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">Épargne prévue</p>
          <p className="text-lg font-bold text-blue-400">{formatMoney(yearlySummary.totalSavingsPlanned)}</p>
        </Card>
      </div>

      {/* Monthly breakdown table */}
      <Card>
        <CardTitle icon={<Calendar className="w-5 h-5 text-blue-400" />}>
          Suivi mensuel {selectedYear}
        </CardTitle>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 font-medium text-gray-400">Mois</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400">Revenus</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400">Dépenses</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400">Balance</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400">Épargne prévue</th>
                <th className="text-center py-2 px-2 font-medium text-gray-400">Statut</th>
              </tr>
            </thead>
            <tbody>
              {MONTH_NAMES.map((monthName, index) => {
                const monthKey = `${selectedYear}-${String(index + 1).padStart(2, '0')}`
                const isCurrentMonth = selectedYear === currentYear && index === currentMonth
                const isFuture = selectedYear > currentYear || (selectedYear === currentYear && index > currentMonth)

                const income = monthlyIncomeActual.get(monthKey) || 0
                const expenses = monthlyExpenses.get(monthKey) || 0
                const balance = income - expenses
                const plannedSavings = totalPlannedMonthlySavings

                // Check if on track (balance >= planned savings)
                const isOnTrack = balance >= plannedSavings

                return (
                  <tr
                    key={monthKey}
                    className={`border-b border-gray-700/50 ${
                      isCurrentMonth ? 'bg-blue-500/10' : ''
                    } ${isFuture ? 'opacity-50' : ''}`}
                  >
                    <td className="py-3 px-2">
                      <span className={isCurrentMonth ? 'font-bold text-blue-400' : ''}>
                        {monthName}
                      </span>
                      {isCurrentMonth && (
                        <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                          Actuel
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right text-green-400">
                      {!isFuture ? formatMoney(income) : '-'}
                    </td>
                    <td className="py-3 px-2 text-right text-red-400">
                      {!isFuture ? formatMoney(expenses) : '-'}
                    </td>
                    <td className={`py-3 px-2 text-right font-medium ${
                      !isFuture ? (balance >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-500'
                    }`}>
                      {!isFuture ? formatMoney(balance) : '-'}
                    </td>
                    <td className="py-3 px-2 text-right text-blue-400">
                      {formatMoney(plannedSavings)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {!isFuture && income > 0 ? (
                        isOnTrack ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                            <Check className="w-3 h-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            <AlertTriangle className="w-3 h-3" /> -{formatMoney(plannedSavings - balance)}
                          </span>
                        )
                      ) : isFuture ? (
                        <span className="text-xs text-gray-500">À venir</span>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Savings goals yearly projection */}
      {savingsGoals.filter(g => !g.isCompleted).length > 0 && (
        <Card>
          <CardTitle icon={<Target className="w-5 h-5 text-purple-400" />}>
            Projection des objectifs d'épargne
          </CardTitle>

          <div className="space-y-4 mt-4">
            {savingsGoals.filter(g => !g.isCompleted).map(goal => {
              const monthlyAmount = goal.monthlyContribution || 0
              const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
              const monthsToGoal = monthlyAmount > 0
                ? Math.ceil(remaining / monthlyAmount)
                : null
              const remainingMonthsInYear = 12 - currentMonth

              // Calculate when goal will be reached
              const goalReachedThisYear = monthsToGoal !== null && monthsToGoal <= remainingMonthsInYear
              const monthWhenReached = monthsToGoal !== null
                ? new Date(selectedYear, currentMonth + monthsToGoal, 1)
                : null

              // Projected end of year (capped at target if reached before)
              const projectedEndOfYear = goalReachedThisYear
                ? goal.targetAmount
                : goal.currentAmount + (monthlyAmount * remainingMonthsInYear)
              const progressEndOfYear = goal.targetAmount > 0 ? (projectedEndOfYear / goal.targetAmount) * 100 : 0

              // Current progress
              const currentProgress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0

              return (
                <div key={goal.id} className="p-3 bg-gray-700/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: goal.color }}
                      />
                      <span className="font-medium">{goal.name}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {formatMoney(goal.monthlyContribution)}/mois
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                    <div>
                      <p className="text-xs text-gray-500">Actuel</p>
                      <p className="font-medium" style={{ color: goal.color }}>
                        {formatMoney(goal.currentAmount)}
                      </p>
                      <p className="text-xs text-gray-600">{formatPercent(currentProgress, 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Reste à épargner</p>
                      <p className="font-medium text-orange-400">
                        {formatMoney(remaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Objectif</p>
                      <p className="font-medium text-gray-300">
                        {formatMoney(goal.targetAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(currentProgress, 100)}%`,
                        backgroundColor: goal.color,
                      }}
                    />
                  </div>

                  <p className="text-xs">
                    {remaining <= 0 ? (
                      <span className="text-green-400 font-medium">Objectif atteint !</span>
                    ) : monthsToGoal !== null ? (
                      goalReachedThisYear ? (
                        <span className="text-green-400">
                          Objectif atteint en {monthWhenReached?.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} (~{monthsToGoal} mois)
                        </span>
                      ) : (
                        <span className="text-blue-400">
                          Objectif atteint dans ~{monthsToGoal} mois
                          {goal.deadline && (
                            <span className="text-gray-500 ml-1">
                              (échéance: {new Date(goal.deadline).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })})
                            </span>
                          )}
                        </span>
                      )
                    ) : (
                      <span className="text-yellow-400">Définissez une épargne mensuelle</span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

// Default fixed charges configuration
const DEFAULT_FIXED_CHARGES = [
  { key: 'rent', name: 'Loyer', categoryId: 'housing', placeholder: '800' },
  { key: 'utilities', name: 'Électricité / Gaz', categoryId: 'housing', placeholder: '100' },
  { key: 'groceries', name: 'Alimentation (budget)', categoryId: 'food-grocery', placeholder: '400' },
  { key: 'transport', name: 'Transport', categoryId: 'transport', placeholder: '100' },
  { key: 'telecom', name: 'Internet / Téléphone', categoryId: 'telecom', placeholder: '50' },
  { key: 'insurance', name: 'Assurances', categoryId: 'bank-fees', placeholder: '80' },
]

// Income & Budget Configuration Modal (Multi-step wizard)
interface IncomeConfigModalProps {
  config: MonthlyBudgetConfig | null | undefined
  baseConfig?: MonthlyBudgetConfig | null | undefined // Latest config to use as base for new months
  month: string // YYYY-MM
  isFutureMonth: boolean
  actualIncome: number
  categories: Category[]
  onClose: () => void
  onSave: () => void
}

type WizardStep = 'income' | 'fixed-charges'

function IncomeConfigModal({ config, baseConfig, month, isFutureMonth, actualIncome, categories, onClose, onSave }: IncomeConfigModalProps) {
  // Use existing config, or base config for new months
  const effectiveConfig = config || baseConfig

  const [step, setStep] = useState<WizardStep>('income')
  const [income, setIncome] = useState(effectiveConfig?.monthlyIncome?.toString() || '')
  const [useActual, setUseActual] = useState(isFutureMonth ? false : (effectiveConfig?.useActualIncome ?? false))

  // Initialize fixed charges from config or defaults
  const [fixedCharges, setFixedCharges] = useState<Record<string, { amount: string; categoryId: string; enabled: boolean }>>(() => {
    const charges: Record<string, { amount: string; categoryId: string; enabled: boolean }> = {}

    for (const defaultCharge of DEFAULT_FIXED_CHARGES) {
      const existing = effectiveConfig?.fixedCharges?.find(c => c.key === defaultCharge.key)
      charges[defaultCharge.key] = {
        amount: existing?.amount?.toString() || '',
        categoryId: existing?.categoryId || defaultCharge.categoryId,
        enabled: existing?.isEnabled ?? true,
      }
    }

    return charges
  })

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const expenseCategories = useMemo(() => categories.filter(c => !c.isIncome), [categories])

  const handleChargeChange = (key: string, field: 'amount' | 'categoryId' | 'enabled', value: string | boolean) => {
    setFixedCharges(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  const handleSave = async () => {
    try {
      // Build fixed charges array
      const chargesArray = DEFAULT_FIXED_CHARGES.map(defaultCharge => ({
        key: defaultCharge.key,
        name: defaultCharge.name,
        amount: parseFloat(fixedCharges[defaultCharge.key]?.amount) || 0,
        categoryId: fixedCharges[defaultCharge.key]?.categoryId || defaultCharge.categoryId,
        isEnabled: fixedCharges[defaultCharge.key]?.enabled ?? true,
      }))

      const newConfig: MonthlyBudgetConfig = {
        id: config?.id || uuidv4(),
        month,
        monthlyIncome: parseFloat(income) || 0,
        useActualIncome: useActual,
        fixedCharges: chargesArray,
        createdAt: config?.createdAt || new Date().toISOString(),
      }

      await monthlyBudgetConfigService.upsert(newConfig)

      // Aggregate fixed charges by categoryId (sum amounts for same category)
      const aggregatedByCategory = new Map<string, number>()
      for (const charge of chargesArray) {
        if (charge.isEnabled && charge.amount > 0) {
          const current = aggregatedByCategory.get(charge.categoryId) || 0
          aggregatedByCategory.set(charge.categoryId, current + charge.amount)
        }
      }

      // Create CategoryBudget entries with aggregated amounts
      for (const [categoryId, totalAmount] of aggregatedByCategory) {
        const budget: CategoryBudget = {
          id: uuidv4(),
          categoryId,
          group: 'needs', // Fixed charges are always "needs"
          monthlyLimit: totalAmount,
          isActive: true,
          createdAt: new Date().toISOString(),
        }
        await categoryBudgetService.upsert(budget)
      }

      onSave()
    } catch (err) {
      console.error('Error saving budget config:', err)
      alert('Erreur lors de la sauvegarde: ' + (err as Error).message)
    }
  }

  // Calculate total fixed charges
  const totalFixedCharges = useMemo(() => {
    return Object.entries(fixedCharges)
      .filter(([, charge]) => charge.enabled)
      .reduce((sum, [, charge]) => sum + (parseFloat(charge.amount) || 0), 0)
  }, [fixedCharges])

  const currentIncome = useActual ? actualIncome : (parseFloat(income) || 0)
  const remainingAfterFixed = currentIncome - totalFixedCharges

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setStep('income')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              step === 'income'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
            Revenu
          </button>
          <div className="w-8 h-0.5 bg-gray-700" />
          <button
            onClick={() => setStep('fixed-charges')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              step === 'fixed-charges'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
            Charges fixes
          </button>
        </div>

        {/* Step 1: Income */}
        {step === 'income' && (
          <>
            <CardTitle icon={<Wallet className="w-5 h-5 text-green-400" />}>
              Budget - {MONTH_LABELS[parseInt(month.split('-')[1], 10) - 1]} {month.split('-')[0]}
            </CardTitle>

            {isFutureMonth && (
              <div className="flex items-center gap-2 mt-2 text-sm text-blue-400">
                <Calendar className="w-4 h-4" />
                <span>Planification à l'avance</span>
              </div>
            )}

            <div className="space-y-4 mt-4">
              {/* Fixed income option */}
              <div>
                <label className="block text-sm font-medium mb-2">Revenu mensuel prévu</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder="3000"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    disabled={useActual}
                  />
                  <span className="text-gray-400">€</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isFutureMonth
                    ? 'Entrez le revenu prévu pour ce mois'
                    : 'Entrez votre salaire net mensuel après impôts'
                  }
                </p>
              </div>

              {/* Use actual income option - only for current/past months */}
              {!isFutureMonth && (
                <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useActual}
                    onChange={(e) => setUseActual(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <p className="font-medium">Utiliser les revenus réels</p>
                    <p className="text-sm text-gray-400">
                      Ce mois: {formatMoney(actualIncome)}
                    </p>
                  </div>
                </label>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={onClose} className="flex-1">
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setStep('fixed-charges')}
                  className="flex-1"
                  disabled={!useActual && !income}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Fixed Charges */}
        {step === 'fixed-charges' && (
          <>
            <CardTitle icon={<Settings className="w-5 h-5 text-blue-400" />}>
              Charges fixes mensuelles
            </CardTitle>
            <p className="text-gray-400 text-sm mb-4">
              Définissez vos dépenses récurrentes obligatoires. Ces montants seront automatiquement budgétés dans la catégorie "Besoins".
            </p>

            <div className="space-y-3">
              {DEFAULT_FIXED_CHARGES.map(defaultCharge => {
                const charge = fixedCharges[defaultCharge.key]
                const category = categoryMap.get(charge?.categoryId || defaultCharge.categoryId)

                return (
                  <div
                    key={defaultCharge.key}
                    className={`p-3 rounded-lg border transition-colors ${
                      charge?.enabled
                        ? 'bg-gray-700/50 border-gray-600'
                        : 'bg-gray-800/30 border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={charge?.enabled ?? true}
                          onChange={(e) => handleChargeChange(defaultCharge.key, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="font-medium">{defaultCharge.name}</span>
                      </label>
                      {category && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={charge?.amount || ''}
                        onChange={(e) => handleChargeChange(defaultCharge.key, 'amount', e.target.value)}
                        placeholder={defaultCharge.placeholder}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                        disabled={!charge?.enabled}
                      />
                      <span className="text-gray-400 text-sm">€/mois</span>

                      {/* Category selector */}
                      <select
                        value={charge?.categoryId || defaultCharge.categoryId}
                        onChange={(e) => handleChargeChange(defaultCharge.key, 'categoryId', e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-sm w-32"
                        disabled={!charge?.enabled}
                      >
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 bg-gray-700/30 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Revenu mensuel</span>
                <span className="text-green-400">{formatMoney(currentIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total charges fixes</span>
                <span className="text-red-400">-{formatMoney(totalFixedCharges)}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 flex justify-between font-medium">
                <span>Reste à allouer</span>
                <span className={remainingAfterFixed >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatMoney(remainingAfterFixed)}
                </span>
              </div>
              {remainingAfterFixed > 0 && (
                <p className="text-xs text-gray-500">
                  Ce montant sera réparti entre Envies ({formatMoney(remainingAfterFixed * 0.6)}) et Épargne ({formatMoney(remainingAfterFixed * 0.4)})
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setStep('income')} className="flex-1">
                Retour
              </Button>
              <Button variant="primary" onClick={handleSave} className="flex-1">
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// Savings Goal Modal
interface SavingsGoalModalProps {
  goal: SavingsGoal | null
  onClose: () => void
  onSave: () => void
}

function SavingsGoalModal({ goal, onClose, onSave }: SavingsGoalModalProps) {
  const [name, setName] = useState(goal?.name || '')
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount?.toString() || '')
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount?.toString() || '0')
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution?.toString() || '')
  const [deadline, setDeadline] = useState(goal?.deadline || '')
  const [color, setColor] = useState(goal?.color || '#3b82f6')
  const [linkedAssetAccountId, setLinkedAssetAccountId] = useState(goal?.linkedAssetAccountId || '')

  // Load asset accounts for linking
  const assetAccounts = useLiveQuery(() => assetAccountService.getActive()) ?? []

  // Calculate required monthly amount based on deadline
  const calculatedMonthly = useMemo(() => {
    if (!deadline || !targetAmount) return null

    const target = parseFloat(targetAmount) || 0
    const current = parseFloat(currentAmount) || 0
    const remaining = target - current

    if (remaining <= 0) return 0

    const deadlineDate = new Date(deadline)
    const today = new Date()
    const monthsLeft = Math.max(1,
      (deadlineDate.getFullYear() - today.getFullYear()) * 12 +
      (deadlineDate.getMonth() - today.getMonth())
    )

    return remaining / monthsLeft
  }, [deadline, targetAmount, currentAmount])

  // Check if planned contribution is enough
  const plannedMonthly = parseFloat(monthlyContribution) || 0
  const isOnTrack = calculatedMonthly !== null && plannedMonthly >= calculatedMonthly

  const handleSave = async () => {
    if (!name || !targetAmount) return

    // If linking to an account, sync the current amount from the account
    let syncedCurrentAmount = parseFloat(currentAmount) || 0
    if (linkedAssetAccountId) {
      const linkedAcc = assetAccounts.find(a => a.id === linkedAssetAccountId)
      if (linkedAcc) {
        syncedCurrentAmount = linkedAcc.currentBalance
      }
    }

    const newGoal: SavingsGoal = {
      id: goal?.id || uuidv4(),
      name,
      icon: 'Target',
      color,
      targetAmount: parseFloat(targetAmount) || 0,
      currentAmount: syncedCurrentAmount,
      monthlyContribution: parseFloat(monthlyContribution) || 0,
      deadline: deadline || undefined,
      priority: goal?.priority || 1,
      isCompleted: syncedCurrentAmount >= (parseFloat(targetAmount) || 0),
      linkedAssetAccountId: linkedAssetAccountId || undefined,
      createdAt: goal?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (goal) {
      await savingsGoalService.update(goal.id, newGoal)
    } else {
      await savingsGoalService.add(newGoal)
    }
    onSave()
  }

  // Get linked account info
  const linkedAccount = assetAccounts.find(a => a.id === linkedAssetAccountId)

  // Auto-update current amount when linking to an account
  const handleLinkChange = (accountId: string) => {
    setLinkedAssetAccountId(accountId)
    if (accountId) {
      const acc = assetAccounts.find(a => a.id === accountId)
      if (acc) {
        setCurrentAmount(acc.currentBalance.toString())
      }
    }
  }

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardTitle icon={<Target className="w-5 h-5 text-purple-400" />}>
          {goal ? 'Modifier l\'objectif' : 'Nouvel objectif d\'épargne'}
        </CardTitle>

        <div className="space-y-4 mt-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Nom de l'objectif</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vacances, Fonds d'urgence..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          {/* Target amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Montant cible</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="1000"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              />
              <span className="text-gray-400">€</span>
            </div>
          </div>

          {/* Current amount (for editing) */}
          {goal && (
            <div>
              <label className="block text-sm font-medium mb-2">Montant actuel</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                />
                <span className="text-gray-400">€</span>
              </div>
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium mb-2">Échéance</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          {/* Monthly contribution */}
          <div>
            <label className="block text-sm font-medium mb-2">Épargne mensuelle prévue</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder={calculatedMonthly ? Math.ceil(calculatedMonthly).toString() : '100'}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              />
              <span className="text-gray-400">€/mois</span>
            </div>
          </div>

          {/* Link to Asset Account */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Link className="w-4 h-4 text-blue-400" />
              Lier à un compte Patrimoine
            </label>
            <select
              value={linkedAssetAccountId}
              onChange={(e) => handleLinkChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            >
              <option value="">Aucun (gérer manuellement)</option>
              {assetAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({formatMoney(account.currentBalance)})
                </option>
              ))}
            </select>
            {linkedAccount && (
              <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Landmark className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-300">
                    Lié à "{linkedAccount.name}" ({formatMoney(linkedAccount.currentBalance)})
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Le montant actuel sera synchronisé avec le solde du compte.
                  Les contributions futures mettront à jour les deux.
                </p>
              </div>
            )}
          </div>

          {/* Calculation info box */}
          {calculatedMonthly !== null && calculatedMonthly > 0 && (
            <div className={`p-3 rounded-lg ${isOnTrack ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
              <div className="flex items-start gap-2">
                {isOnTrack ? (
                  <Check className="w-4 h-4 text-green-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                )}
                <div className="text-sm">
                  <p className={isOnTrack ? 'text-green-400' : 'text-yellow-400'}>
                    {isOnTrack ? 'Vous êtes sur la bonne voie !' : 'Attention au rythme'}
                  </p>
                  <p className="text-gray-400 mt-1">
                    Pour atteindre votre objectif à temps, vous devez épargner au minimum{' '}
                    <span className="font-medium text-white">{formatMoney(calculatedMonthly)}/mois</span>
                  </p>
                  {!isOnTrack && plannedMonthly > 0 && (
                    <p className="text-gray-500 mt-1 text-xs">
                      Avec {formatMoney(plannedMonthly)}/mois, vous atteindrez l'objectif en{' '}
                      {Math.ceil((parseFloat(targetAmount) - parseFloat(currentAmount || '0')) / plannedMonthly)} mois
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Couleur</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-white scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              className="flex-1"
              disabled={!name || !targetAmount}
            >
              {goal ? 'Modifier' : 'Créer'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
