import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  TrendingUp,
  Filter,
  Calendar,
  CalendarDays,
  BarChart3,
  Activity,
  Repeat,
  AlertTriangle,
  PieChart as PieChartIcon,
  ArrowRightLeft,
  History,
  Table,
  Users,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { useTransactions } from '@store/TransactionContext'
import { transactionService } from '@services/db'
import {
  useAllTransactions,
  useFinancialInsights,
  useSpendingPatterns,
  useRecurringTransactions,
  useCashFlow,
  useUnusualTransactions,
  useFinancialAdvisor,
} from '@hooks/index'
import { Card, CardTitle, useToast } from '@components/common'
import {
  TopCategories,
  FinancialSummary,
  CashFlowChart,
  SpendingPatternsChart,
  RecurringExpensesList,
  UnusualTransactionsList,
  IncomeBreakdown,
  TransactionCalendar,
  MonthlyOverviewTable,
  BalanceEvolutionChart,
  SpendingByPerson,
} from '@components/dashboard'
import { LazyExpensesPieChart, LazyDailyBarChart, LazyMonthlyComparisonChart } from '@components/charts'
import { TransactionList, CategoryFilterButton } from '@components/transactions'
import { AdvisorPanel } from '@components/advisor'
import { QuickAddExpense } from '@components/budget/QuickAddExpense'
import { formatDate, formatMoney } from '@utils/formatters'
import { categoryBudgetService, settingsService } from '@services/db'
import { useLiveQuery } from 'dexie-react-hooks'

type DashboardTab = 'overview' | 'history' | 'calendar' | 'analysis' | 'transactions'

export function DashboardPage() {
  const { transactions, categories, stats, selectedPeriod, months, bulkUpdateCategory } = useTransactions()
  const allTransactions = useAllTransactions()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'expense' | 'income'>('expense')
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [recentTransactionsExpanded, setRecentTransactionsExpanded] = useState(false)
  const transactionListRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Current month for quick add
  const currentMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  // Get category budgets for quick add
  const categoryBudgets = useLiveQuery(
    () => categoryBudgetService.getAll(),
    []
  ) || []

  // Load initial balance for bank balance calculation
  const [initialBalance, setInitialBalance] = useState<number | null>(null)

  // Load household members for expense assignment
  const [householdMembers, setHouseholdMembers] = useState<string[]>([])

  useEffect(() => {
    settingsService.getInitialBalance().then(balance => {
      setInitialBalance(balance)
    })
    settingsService.get('householdMembers').then(members => {
      if (Array.isArray(members)) {
        setHouseholdMembers(members)
      }
    })
  }, [])

  // Calculate real bank balance (initial balance + transactions up to today only)
  const bankBalance = useMemo(() => {
    if (initialBalance === null) return null
    // Use local date, not UTC (toISOString returns UTC which can cause timezone issues)
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const pastTransactions = allTransactions.filter(t => t.date <= today)
    const transactionsTotal = pastTransactions.reduce((sum, t) => sum + t.amount, 0)
    return initialBalance + transactionsTotal
  }, [initialBalance, allTransactions])

  const handleTransactionAdded = useCallback(() => {
    toast.success('Transaction ajoutée', 'La transaction a été enregistrée')
  }, [toast])

  // Get previous period transactions for comparison
  const previousPeriodTransactions = useMemo(() => {
    const { startDate, endDate } = selectedPeriod
    const periodLength = new Date(endDate).getTime() - new Date(startDate).getTime()
    const prevStart = new Date(new Date(startDate).getTime() - periodLength - 86400000)
    const prevEnd = new Date(new Date(startDate).getTime() - 86400000)

    const prevStartStr = prevStart.toISOString().split('T')[0]
    const prevEndStr = prevEnd.toISOString().split('T')[0]

    return allTransactions.filter(t => t.date >= prevStartStr && t.date <= prevEndStr)
  }, [allTransactions, selectedPeriod])

  // Advanced analytics hooks
  const insights = useFinancialInsights(transactions, previousPeriodTransactions)
  const spendingPatterns = useSpendingPatterns(transactions)
  const recurringTransactions = useRecurringTransactions(transactions)
  const cashFlow = useCashFlow(transactions)
  const unusualTransactions = useUnusualTransactions(transactions)

  // Financial advisor
  const advisor = useFinancialAdvisor(allTransactions, categories)

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId))
    setFilterType('expense')
    // Scroll to inline transaction list on overview tab
    if (activeTab === 'overview') {
      setTimeout(() => {
        transactionListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      setActiveTab('transactions')
      setTimeout(() => {
        transactionListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [activeTab])

  const handleIncomeCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId))
    setFilterType('income')
    // Scroll to inline transaction list on overview tab
    if (activeTab === 'overview') {
      setTimeout(() => {
        transactionListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      setActiveTab('transactions')
      setTimeout(() => {
        transactionListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [activeTab])

  const handleClearCategory = useCallback(() => {
    setSelectedCategory(null)
    setFilterType('expense')
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

  const handleAssignedToChange = useCallback(async (transactionId: string, assignedTo: string | undefined) => {
    await transactionService.update(transactionId, { assignedTo })
    toast.success(
      'Dépense imputée',
      assignedTo ? `Transaction assignée à ${assignedTo}` : 'Assignation retirée'
    )
  }, [toast])

  const handleBulkCategoryChange = useCallback(async (transactionIds: string[], categoryId: string) => {
    const updated = await bulkUpdateCategory(transactionIds, categoryId)
    const categoryName = categories.find(c => c.id === categoryId)?.name || categoryId
    toast.success('Catégorie mise à jour', `${updated} transaction(s) déplacée(s) vers "${categoryName}"`)
  }, [bulkUpdateCategory, categories, toast])

  // Pie chart data - use French category names
  const pieChartData = useMemo(() => {
    if (!stats?.byCategory) return []
    return stats.byCategory.map((cat) => ({
      id: cat.categoryId,
      name: cat.name, // French name instead of categoryId
      value: cat.amount,
      color: cat.color,
    }))
  }, [stats?.byCategory])

  // Daily data for bar chart
  const dailyData = useMemo(() => {
    const days = new Map<string, { depenses: number; revenus: number }>()

    for (const t of transactions) {
      const existing = days.get(t.date) || { depenses: 0, revenus: 0 }
      if (t.amount < 0) {
        existing.depenses += Math.abs(t.amount)
      } else {
        existing.revenus += t.amount
      }
      days.set(t.date, existing)
    }

    return Array.from(days.entries())
      .map(([date, data]) => ({
        date,
        dateLabel: formatDate(date),
        depenses: data.depenses,
        revenus: data.revenus,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions])

  // Filter transactions for display based on type (income vs expense)
  const filteredTransactions = useMemo(() => {
    if (filterType === 'income') {
      return transactions.filter(t => t.amount > 0)
    }
    return transactions // expenses (amount < 0) will be filtered by category in TransactionList
  }, [transactions, filterType])

  // Format period for display
  const periodDisplay = selectedPeriod.label || 'Ce mois'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            Tableau de Bord
          </h1>
          <p className="text-gray-400 capitalize">{periodDisplay}</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg overflow-x-auto" role="tablist">
          {[
            { id: 'overview' as const, label: 'Vue d\'ensemble', icon: PieChartIcon },
            { id: 'history' as const, label: 'Historique', icon: History },
            { id: 'calendar' as const, label: 'Calendrier', icon: CalendarDays },
            { id: 'analysis' as const, label: 'Analyse', icon: Activity },
            { id: 'transactions' as const, label: 'Transactions', icon: ArrowRightLeft },
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

      {/* Financial Summary - Always visible */}
      <FinancialSummary
        insights={insights}
        income={stats?.income || 0}
        expenses={stats?.expenses || 0}
        balance={stats?.balance || 0}
        bankBalance={bankBalance}
      />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Advisor Panel */}
          <AdvisorPanel
            insights={advisor.insights}
            healthScore={advisor.healthScore}
            isLoading={advisor.isLoading}
            aiEnabled={advisor.aiEnabled}
            aiLoading={advisor.aiLoading}
            aiError={advisor.aiError}
            aiInsights={advisor.aiInsights}
            onToggleAI={advisor.toggleAI}
            onAskQuestion={advisor.askQuestion}
            hasApiKey={advisor.hasApiKey}
          />

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {/* Expenses pie chart */}
            <Card>
              <CardTitle icon={<Filter className="w-5 h-5 text-purple-400" />}>
                Répartition des dépenses
              </CardTitle>
              <div className="h-64">
                <LazyExpensesPieChart
                  data={pieChartData}
                  selectedCategory={selectedCategory}
                  onCategoryClick={handleCategoryToggle}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Filtrer par catégorie">
                {stats?.byCategory.slice(0, 6).map((cat) => (
                  <CategoryFilterButton
                    key={cat.categoryId}
                    name={cat.categoryId}
                    color={cat.color}
                    isSelected={selectedCategory === cat.categoryId}
                    onClick={handleCategoryToggle}
                  />
                ))}
              </div>
            </Card>

            {/* Cash flow chart */}
            <Card>
              <CardTitle icon={<Activity className="w-5 h-5 text-blue-400" />}>
                Evolution du solde
              </CardTitle>
              <div className="h-64">
                <CashFlowChart data={cashFlow} />
              </div>
            </Card>
          </div>

          {/* Top categories */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <TopCategories
              categories={stats?.byCategory || []}
              selectedCategory={selectedCategory}
              onCategoryClick={handleCategoryToggle}
              title="Top dépenses"
              emptyMessage="Aucune dépense cette période"
            />
            <Card>
              <CardTitle icon={<TrendingUp className="w-5 h-5 text-green-400" />}>
                Sources de revenus
              </CardTitle>
              <IncomeBreakdown
                incomeStats={stats?.byIncome || []}
                totalIncome={stats?.income || 0}
                selectedCategory={filterType === 'income' ? selectedCategory : null}
                onCategoryClick={handleIncomeCategoryToggle}
              />
            </Card>
          </div>

          {/* Spending by person (household) */}
          {householdMembers.length > 0 && (
            <Card>
              <CardTitle icon={<Users className="w-5 h-5 text-purple-400" />}>
                Dépenses par personne
              </CardTitle>
              <SpendingByPerson
                transactions={transactions}
                householdMembers={householdMembers}
              />
            </Card>
          )}

          {/* Recent transactions */}
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle icon={<Clock className="w-5 h-5 text-blue-400" />}>
                Dernières transactions
              </CardTitle>
              {allTransactions.length > 4 && (
                <button
                  onClick={() => setRecentTransactionsExpanded(!recentTransactionsExpanded)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {recentTransactionsExpanded ? 'Réduire' : 'Voir plus'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${recentTransactionsExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            <div className="space-y-2 mt-4">
              {allTransactions
                .slice()
                .sort((a, b) => {
                  // Sort by date desc, then by createdAt desc for same date
                  const dateCompare = b.date.localeCompare(a.date)
                  if (dateCompare !== 0) return dateCompare
                  return (b.createdAt || '').localeCompare(a.createdAt || '')
                })
                .slice(0, recentTransactionsExpanded ? 15 : 4)
                .map((t) => {
                  const category = categories.find(c => c.id === t.category)
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category?.color || '#6b7280' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{t.description}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(t.date)}
                            {category && ` • ${category.name}`}
                            {t.assignedTo && ` • ${t.assignedTo}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium ml-3 ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.amount >= 0 ? '+' : ''}{formatMoney(t.amount)}
                      </span>
                    </div>
                  )
                })}
              {allTransactions.length === 0 && (
                <p className="text-center text-gray-500 py-4">Aucune transaction</p>
              )}
              {recentTransactionsExpanded && allTransactions.length > 15 && (
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="w-full text-center text-sm text-blue-400 hover:text-blue-300 py-2 mt-2"
                >
                  Voir toutes les transactions →
                </button>
              )}
            </div>
          </Card>

          {/* Monthly comparison */}
          {months.length > 1 && (
            <Card>
              <CardTitle icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}>
                Comparaison mensuelle
              </CardTitle>
              <div className="h-72">
                <LazyMonthlyComparisonChart transactions={allTransactions} months={months} />
              </div>
            </Card>
          )}

          {/* Inline transaction list when category selected */}
          <div ref={transactionListRef}>
            {selectedCategory ? (
              <>
                {filterType === 'income' && (
                  <div className="flex items-center gap-2 mb-3 text-green-400">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-medium">Revenus</span>
                  </div>
                )}
                <TransactionList
                  transactions={filteredTransactions}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  householdMembers={householdMembers}
                  onClearCategory={handleClearCategory}
                  onCategoryChange={handleCategoryChange}
                  onBudgetMonthChange={handleBudgetMonthChange}
                  onAssignedToChange={handleAssignedToChange}
                  onBulkCategoryChange={handleBulkCategoryChange}
                />
              </>
            ) : (
              <Card className="text-center py-8">
                <PieChartIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">Cliquez sur une dépense ou un revenu ci-dessus pour voir les transactions</p>
              </Card>
            )}
          </div>
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <>
          {/* Balance Evolution Chart */}
          <Card>
            <CardTitle icon={<TrendingUp className="w-5 h-5 text-blue-400" />}>
              Évolution du solde
            </CardTitle>
            <p className="text-gray-400 text-sm mb-4">
              Visualisez l'évolution de votre solde sur les 12 derniers mois
            </p>
            <div className="h-80">
              <BalanceEvolutionChart
                transactions={allTransactions}
                initialBalance={initialBalance || 0}
                monthsToShow={12}
              />
            </div>
          </Card>

          {/* Monthly Overview Table */}
          <Card>
            <CardTitle icon={<Table className="w-5 h-5 text-purple-400" />}>
              Récapitulatif mensuel
            </CardTitle>
            <p className="text-gray-400 text-sm mb-4">
              Détail de vos revenus, dépenses et taux d'épargne par mois
            </p>
            <MonthlyOverviewTable
              transactions={allTransactions}
              monthsToShow={12}
            />
          </Card>
        </>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <Card>
          <CardTitle icon={<CalendarDays className="w-5 h-5 text-blue-400" />}>
            Calendrier des transactions
          </CardTitle>
          <p className="text-gray-400 text-sm mb-4">
            Visualisez vos entrées et sorties d'argent jour par jour
          </p>
          <TransactionCalendar transactions={allTransactions} />
        </Card>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <>
          {/* Analysis charts */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {/* Spending patterns by day */}
            <Card>
              <CardTitle icon={<Calendar className="w-5 h-5 text-orange-400" />}>
                Dépenses par jour de la semaine
              </CardTitle>
              <div className="h-64">
                <SpendingPatternsChart data={spendingPatterns} />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Identifiez vos jours de dépenses les plus importants
              </p>
            </Card>

            {/* Daily evolution */}
            <Card>
              <CardTitle icon={<BarChart3 className="w-5 h-5 text-blue-400" />}>
                Evolution journalière
              </CardTitle>
              <div className="h-64">
                <LazyDailyBarChart data={dailyData} />
              </div>
            </Card>
          </div>

          {/* Recurring and unusual transactions */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {/* Recurring expenses */}
            <Card>
              <CardTitle icon={<Repeat className="w-5 h-5 text-purple-400" />}>
                Dépenses récurrentes
              </CardTitle>
              <RecurringExpensesList
                recurring={recurringTransactions}
                categories={categories}
              />
            </Card>

            {/* Unusual transactions */}
            <Card>
              <CardTitle icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />}>
                Transactions remarquables
              </CardTitle>
              <UnusualTransactionsList
                transactions={unusualTransactions}
                insights={insights}
                categories={categories}
              />
            </Card>
          </div>

          {/* Detailed breakdown */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <TopCategories
              categories={stats?.byCategory || []}
              selectedCategory={selectedCategory}
              onCategoryClick={handleCategoryToggle}
              title="Détail des dépenses"
              emptyMessage="Aucune dépense"
              maxItems={10}
            />
            <TopCategories
              categories={stats?.byIncome || []}
              selectedCategory={selectedCategory}
              onCategoryClick={handleCategoryToggle}
              title="Détail des revenus"
              emptyMessage="Aucun revenu"
              maxItems={10}
            />
          </div>
        </>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div ref={transactionListRef}>
          <TransactionList
            transactions={transactions}
            categories={categories}
            selectedCategory={selectedCategory}
            householdMembers={householdMembers}
            onClearCategory={handleClearCategory}
            onCategoryChange={handleCategoryChange}
            onBudgetMonthChange={handleBudgetMonthChange}
            onAssignedToChange={handleAssignedToChange}
            onBulkCategoryChange={handleBulkCategoryChange}
          />
        </div>
      )}

      {/* Quick Add Floating Button */}
      <QuickAddExpense
        categories={categories}
        categoryBudgets={categoryBudgets}
        onTransactionAdded={handleTransactionAdded}
        budgetMonth={currentMonth}
        householdMembers={householdMembers}
      />
    </div>
  )
}
