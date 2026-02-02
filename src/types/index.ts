// Transaction types
export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  type: TransactionType
  description: string
  amount: number // Positive = credit, Negative = debit
  category: string
  importId: string
  originalRow?: number
  isManuallyEdited: boolean
  source: 'import' | 'manual' // How the transaction was created
  budgetGroup?: 'needs' | 'wants' // For manual transactions: user-chosen budget group
  budgetMonth?: string // YYYY-MM - Override which month this counts towards (e.g., salary received Dec 29 counting for January)
  assignedTo?: string // Person in household who made this expense (e.g., "Marvin", "Partner")
  createdAt: string
  updatedAt: string
}

export type TransactionType =
  | 'PAIEMENT_CARTE'
  | 'VIREMENT_RECU'
  | 'VIREMENT_EMIS'
  | 'PRELEVEMENT'
  | 'AVOIR'
  | 'COTISATION'
  | 'AUTRE'

// Category types
export interface Category {
  id: string
  name: string
  icon: string // Lucide icon name
  color: string // Hex color
  parentId?: string
  isIncome: boolean
  isExcludedFromStats: boolean
  order: number
  isDefault: boolean
  createdAt: string
}

export interface CategorizationRule {
  id: string
  categoryId: string
  pattern: string // Regex pattern
  field: 'description' | 'type'
  priority: number
  isActive: boolean
  createdAt: string
}

// Import types
export interface ImportBatch {
  id: string
  filename: string
  importedAt: string
  transactionCount: number
  periodStart: string
  periodEnd: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  errors?: ImportError[]
}

export interface ImportError {
  row: number
  field: string
  message: string
  value: unknown
}

// Filter types
export interface TransactionFilters {
  dateRange: {
    start: string | null
    end: string | null
  }
  categories: string[]
  types: TransactionType[]
  amountRange: {
    min: number | null
    max: number | null
  }
  searchQuery: string
  showIncome: boolean
  showExpenses: boolean
}

// Stats types
export interface MonthlyStats {
  month: string // YYYY-MM
  income: number
  expenses: number
  balance: number
  byCategory: CategoryStat[] // Expenses by category
  byIncome: CategoryStat[] // Income by category
  transactionCount: number
}

export interface CategoryStat {
  categoryId: string
  name: string
  color: string
  amount: number
  percentage: number
  transactionCount: number
}

// Settings types
export interface AppSettings {
  id: string
  key: string
  value: unknown
}

// Period types for filtering
export type PeriodType = 'month' | 'quarter' | 'year' | 'all' | 'custom'

export interface Period {
  type: PeriodType
  label: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

export interface PeriodStats extends MonthlyStats {
  period: Period
  monthlyBreakdown?: MonthlyStats[] // For multi-month periods
}

// Advanced analytics types
export interface FinancialInsights {
  savingsRate: number // (income - expenses) / income * 100
  avgDailyExpense: number
  avgDailyIncome: number
  daysInPeriod: number
  largestExpense: Transaction | null
  largestIncome: Transaction | null
  previousPeriodComparison: {
    expenseChange: number // percentage change
    incomeChange: number
    balanceChange: number
  } | null
}

export interface SpendingPattern {
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  dayName: string
  totalExpenses: number
  transactionCount: number
  avgExpense: number
}

export interface RecurringTransaction {
  description: string
  pattern: string // normalized pattern
  occurrences: number
  totalAmount: number
  avgAmount: number
  category: string
  isExpense: boolean
  transactions: Transaction[]
}

export interface CashFlowPoint {
  date: string
  dateLabel: string
  income: number
  expenses: number
  netFlow: number
  cumulativeBalance: number
}

// Budget types
export type BudgetGroupType = 'needs' | 'wants' | 'savings'

export interface BudgetGroup {
  id: BudgetGroupType
  name: string
  targetPercent: number // 50, 30, or 20
  color: string
}

export interface CategoryBudget {
  id: string
  categoryId: string
  group: BudgetGroupType
  monthlyLimit: number
  isActive: boolean
  createdAt: string
}

// Fixed charges for budget configuration
export interface FixedCharge {
  key: string // unique identifier (e.g., 'rent', 'utilities')
  name: string // Display name
  amount: number
  categoryId: string
  budgetGroup?: 'needs' | 'wants' // Which budget group this charge belongs to (optional for migration)
  isEnabled: boolean
}

export interface MonthlyBudgetConfig {
  id: string
  month: string // YYYY-MM
  monthlyIncome: number // Expected income for the month
  useActualIncome: boolean // Use actual income from transactions instead
  fixedCharges: FixedCharge[] // Configured fixed monthly charges
  cafIncome?: Record<string, number> // CAF income (prime d'activité, APL, PAJE, etc.)
  createdAt: string
}

// Savings goals
export interface SavingsGoal {
  id: string
  name: string
  icon: string
  color: string
  targetAmount: number
  currentAmount: number
  monthlyContribution: number // Planned monthly savings amount
  deadline?: string // YYYY-MM-DD
  priority: number // 1 = highest
  isCompleted: boolean
  linkedAssetAccountId?: string // Link to a Patrimoine asset account
  createdAt: string
  updatedAt: string
}

// Monthly savings tracking
export interface MonthlySavingsRecord {
  id: string
  month: string // YYYY-MM
  goalId: string
  plannedAmount: number
  actualAmount: number
  createdAt: string
}

export interface SavingsContribution {
  id: string
  goalId: string
  amount: number
  date: string
  note?: string
  createdAt: string
}

// ============================================
// Patrimoine (Net Worth) types
// ============================================

export type AssetAccountType =
  | 'livret'           // Livret A, LDDS, LEP
  | 'epargne-logement' // PEL, CEL
  | 'assurance-vie'    // All life insurance contracts
  | 'pea'              // Plan d'Épargne en Actions
  | 'cto'              // Compte-Titres Ordinaire
  | 'per'              // Plan d'Épargne Retraite
  | 'crypto'           // Cryptocurrencies
  | 'immobilier'       // Real estate
  | 'other'            // Other assets

export type LiabilityType =
  | 'credit-immobilier' // Mortgage
  | 'credit-conso'      // Consumer credit
  | 'credit-auto'       // Car loan
  | 'other'             // Other debts

export interface AssetAccount {
  id: string
  name: string
  type: AssetAccountType
  institution?: string // Bank or platform name
  currentBalance: number
  interestRate?: number // Annual rate in percentage (e.g., 3 for 3%)
  color: string
  icon: string
  notes?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

// Movement/transaction on an asset account (deposit, withdrawal, etc.)
export interface AssetMovement {
  id: string
  accountId: string // Reference to AssetAccount
  date: string // YYYY-MM-DD
  amount: number // Positive for deposit, negative for withdrawal
  type: 'deposit' | 'withdrawal' | 'interest' | 'transfer' | 'adjustment'
  description?: string
  balanceAfter: number // Balance after this movement
  createdAt: string
}

export interface Liability {
  id: string
  name: string
  type: LiabilityType
  institution?: string
  remainingBalance: number // What's left to pay
  initialAmount?: number // Original loan amount
  interestRate?: number
  monthlyPayment?: number
  endDate?: string // When the loan ends
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BalanceHistory {
  id: string
  accountId: string
  balance: number
  date: string // YYYY-MM-DD
  createdAt: string
}

export interface NetWorthSnapshot {
  id: string
  date: string // YYYY-MM-DD
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  byAccountType: Record<AssetAccountType, number>
  createdAt: string
}

// Preset account configurations for French users
export const ASSET_ACCOUNT_PRESETS: Record<AssetAccountType, { label: string; icon: string; color: string; defaultRate?: number }> = {
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
