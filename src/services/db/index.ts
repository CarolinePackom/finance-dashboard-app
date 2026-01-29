import Dexie, { type Table } from 'dexie'
import type {
  Transaction,
  Category,
  CategorizationRule,
  ImportBatch,
  AppSettings,
  CategoryBudget,
  MonthlyBudgetConfig,
  SavingsGoal,
  SavingsContribution,
  MonthlySavingsRecord,
  AssetAccount,
  Liability,
  BalanceHistory,
  NetWorthSnapshot,
} from '@/types'
import { defaultCategories } from './defaultCategories'

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>
  categories!: Table<Category>
  rules!: Table<CategorizationRule>
  imports!: Table<ImportBatch>
  settings!: Table<AppSettings>
  categoryBudgets!: Table<CategoryBudget>
  monthlyBudgetConfigs!: Table<MonthlyBudgetConfig>
  savingsGoals!: Table<SavingsGoal>
  savingsContributions!: Table<SavingsContribution>
  monthlySavingsRecords!: Table<MonthlySavingsRecord>
  // Patrimoine tables
  assetAccounts!: Table<AssetAccount>
  liabilities!: Table<Liability>
  balanceHistory!: Table<BalanceHistory>
  netWorthSnapshots!: Table<NetWorthSnapshot>

  constructor() {
    super('FinanceTracker')

    this.version(1).stores({
      transactions: 'id, date, category, type, importId, [date+category]',
      categories: 'id, name, parentId, order',
      rules: 'id, categoryId, priority',
      imports: 'id, importedAt, status',
      settings: 'id, key',
    })

    // Version 2: Add budget and savings tables
    this.version(2).stores({
      transactions: 'id, date, category, type, importId, [date+category]',
      categories: 'id, name, parentId, order',
      rules: 'id, categoryId, priority',
      imports: 'id, importedAt, status',
      settings: 'id, key',
      categoryBudgets: 'id, categoryId, group',
      monthlyBudgetConfigs: 'id, month',
      savingsGoals: 'id, priority, isCompleted',
      savingsContributions: 'id, goalId, date',
    })

    // Version 3: Add monthly savings tracking
    this.version(3).stores({
      transactions: 'id, date, category, type, importId, [date+category]',
      categories: 'id, name, parentId, order',
      rules: 'id, categoryId, priority',
      imports: 'id, importedAt, status',
      settings: 'id, key',
      categoryBudgets: 'id, categoryId, group',
      monthlyBudgetConfigs: 'id, month',
      savingsGoals: 'id, priority, isCompleted',
      savingsContributions: 'id, goalId, date',
      monthlySavingsRecords: 'id, month, goalId, [month+goalId]',
    })

    // Version 4: Add patrimoine (net worth) tracking
    this.version(4).stores({
      transactions: 'id, date, category, type, importId, [date+category]',
      categories: 'id, name, parentId, order',
      rules: 'id, categoryId, priority',
      imports: 'id, importedAt, status',
      settings: 'id, key',
      categoryBudgets: 'id, categoryId, group',
      monthlyBudgetConfigs: 'id, month',
      savingsGoals: 'id, priority, isCompleted',
      savingsContributions: 'id, goalId, date',
      monthlySavingsRecords: 'id, month, goalId, [month+goalId]',
      assetAccounts: 'id, type, order',
      liabilities: 'id, type',
      balanceHistory: 'id, accountId, date, [accountId+date]',
      netWorthSnapshots: 'id, date',
    })

    // Initialize default categories on first open
    this.on('populate', () => {
      this.categories.bulkAdd(defaultCategories)
    })
  }
}

export const db = new FinanceDB()

// Ensure all default categories exist
async function ensureDefaultCategories() {
  const existingCategories = await db.categories.toArray()
  const existingIds = new Set(existingCategories.map(c => c.id))

  const missingCategories = defaultCategories.filter(c => !existingIds.has(c.id))

  if (missingCategories.length > 0) {
    console.log(`➕ Adding ${missingCategories.length} missing categories:`, missingCategories.map(c => c.name))
    await db.categories.bulkAdd(missingCategories)
  }
}

// Open database and log status
db.open().then(async () => {
  console.log('✅ Database opened successfully')

  // Ensure all default categories exist
  await ensureDefaultCategories()

  const count = await db.transactions.count()
  console.log(`📊 ${count} transactions in database`)

  const categories = await db.categories.count()
  console.log(`📁 ${categories} categories in database`)
}).catch(err => {
  console.error('❌ Failed to open database:', err)
})

// Transaction operations
export const transactionService = {
  async getAll(filters?: Partial<{ month: string; category: string }>) {
    let query = db.transactions.orderBy('date').reverse()

    if (filters?.month) {
      const month = filters.month
      query = query.filter((t) => t.date.startsWith(month))
    }

    if (filters?.category) {
      const category = filters.category
      query = query.filter((t) => t.category === category)
    }

    return query.toArray()
  },

  async getByMonth(month: string) {
    return db.transactions
      .where('date')
      .startsWith(month)
      .reverse()
      .sortBy('date')
  },

  async add(transactions: Transaction[]) {
    const result = await db.transactions.bulkAdd(transactions)
    return result
  },

  async update(id: string, updates: Partial<Transaction>) {
    const result = await db.transactions.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    return result
  },

  async delete(id: string) {
    const result = await db.transactions.delete(id)
    return result
  },

  async deleteByImport(importId: string) {
    const result = await db.transactions.where('importId').equals(importId).delete()
    return result
  },

  async getMonths() {
    const transactions = await db.transactions.toArray()
    const months = new Set(transactions.map((t) => t.date.substring(0, 7)))
    return Array.from(months).sort().reverse()
  },
}

// Category operations
export const categoryService = {
  async getAll() {
    return db.categories.orderBy('order').toArray()
  },

  async getById(id: string) {
    return db.categories.get(id)
  },

  async add(category: Category) {
    const result = await db.categories.add(category)
    return result
  },

  async update(id: string, updates: Partial<Category>) {
    const result = await db.categories.update(id, updates)
    return result
  },

  async delete(id: string) {
    const result = await db.categories.delete(id)
    return result
  },
}

// Rule operations
export const ruleService = {
  async getAll() {
    return db.rules.orderBy('priority').reverse().toArray()
  },

  async add(rule: CategorizationRule) {
    const result = await db.rules.add(rule)
    return result
  },

  async update(id: string, updates: Partial<CategorizationRule>) {
    const result = await db.rules.update(id, updates)
    return result
  },

  async delete(id: string) {
    const result = await db.rules.delete(id)
    return result
  },
}

// Import operations
export const importService = {
  async getAll() {
    return db.imports.orderBy('importedAt').reverse().toArray()
  },

  async add(batch: ImportBatch) {
    const result = await db.imports.add(batch)
    return result
  },

  async update(id: string, updates: Partial<ImportBatch>) {
    const result = await db.imports.update(id, updates)
    return result
  },

  async delete(id: string) {
    // Delete associated transactions
    await transactionService.deleteByImport(id)
    const result = await db.imports.delete(id)
    return result
  },
}

// Category Budget operations
export const categoryBudgetService = {
  async getAll() {
    return db.categoryBudgets.toArray()
  },

  async getByCategory(categoryId: string) {
    return db.categoryBudgets.where('categoryId').equals(categoryId).first()
  },

  async add(budget: CategoryBudget) {
    const result = await db.categoryBudgets.add(budget)
    return result
  },

  async update(id: string, updates: Partial<CategoryBudget>) {
    const result = await db.categoryBudgets.update(id, updates)
    return result
  },

  async upsert(budget: CategoryBudget) {
    const existing = await db.categoryBudgets.where('categoryId').equals(budget.categoryId).first()
    let result
    if (existing) {
      result = await db.categoryBudgets.update(existing.id, budget)
    } else {
      result = await db.categoryBudgets.add(budget)
    }
    return result
  },

  async delete(id: string) {
    const result = await db.categoryBudgets.delete(id)
    return result
  },
}

// Monthly Budget Config operations
export const monthlyBudgetConfigService = {
  async getAll() {
    return db.monthlyBudgetConfigs.toArray()
  },

  async getByMonth(month: string) {
    return db.monthlyBudgetConfigs.where('month').equals(month).first()
  },

  async getLatest() {
    const configs = await db.monthlyBudgetConfigs.orderBy('month').reverse().toArray()
    return configs[0] || null
  },

  async add(config: MonthlyBudgetConfig) {
    const result = await db.monthlyBudgetConfigs.add(config)
    return result
  },

  async update(id: string, updates: Partial<MonthlyBudgetConfig>) {
    const result = await db.monthlyBudgetConfigs.update(id, updates)
    return result
  },

  async upsert(config: MonthlyBudgetConfig) {
    const existing = await db.monthlyBudgetConfigs.where('month').equals(config.month).first()
    let result
    if (existing) {
      result = await db.monthlyBudgetConfigs.update(existing.id, config)
    } else {
      result = await db.monthlyBudgetConfigs.add(config)
    }
    return result
  },
}

// Savings Goal operations
export const savingsGoalService = {
  async getAll() {
    return db.savingsGoals.orderBy('priority').toArray()
  },

  async getActive() {
    return db.savingsGoals.where('isCompleted').equals(0).sortBy('priority')
  },

  async getById(id: string) {
    return db.savingsGoals.get(id)
  },

  async add(goal: SavingsGoal) {
    const result = await db.savingsGoals.add(goal)
    return result
  },

  async update(id: string, updates: Partial<SavingsGoal>) {
    const result = await db.savingsGoals.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    return result
  },

  async delete(id: string) {
    // Delete associated contributions
    await db.savingsContributions.where('goalId').equals(id).delete()
    const result = await db.savingsGoals.delete(id)
    return result
  },

  async addContribution(goalId: string, amount: number) {
    const goal = await db.savingsGoals.get(goalId)
    if (!goal) throw new Error('Goal not found')

    const newAmount = goal.currentAmount + amount
    await db.savingsGoals.update(goalId, {
      currentAmount: newAmount,
      isCompleted: newAmount >= goal.targetAmount,
      updatedAt: new Date().toISOString(),
    })

    // If goal is linked to an asset account, update its balance too
    if (goal.linkedAssetAccountId) {
      const assetAccount = await db.assetAccounts.get(goal.linkedAssetAccountId)
      if (assetAccount) {
        const newBalance = assetAccount.currentBalance + amount
        // Import assetAccountService dynamically to avoid circular dependency
        const today = new Date().toISOString().split('T')[0]
        await db.assetAccounts.update(goal.linkedAssetAccountId, {
          currentBalance: newBalance,
          updatedAt: new Date().toISOString(),
        })
        // Add to balance history
        const existingHistory = await db.balanceHistory
          .where('[accountId+date]')
          .equals([goal.linkedAssetAccountId, today])
          .first()
        if (existingHistory) {
          await db.balanceHistory.update(existingHistory.id, { balance: newBalance })
        } else {
          await db.balanceHistory.add({
            id: `hist-${goal.linkedAssetAccountId}-${today}`,
            accountId: goal.linkedAssetAccountId,
            balance: newBalance,
            date: today,
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    return newAmount
  },

  async linkToAsset(goalId: string, assetAccountId: string | null) {
    const goal = await db.savingsGoals.get(goalId)
    if (!goal) throw new Error('Goal not found')

    await db.savingsGoals.update(goalId, {
      linkedAssetAccountId: assetAccountId || undefined,
      updatedAt: new Date().toISOString(),
    })
  },

  async getGoalsForAsset(assetAccountId: string) {
    return db.savingsGoals
      .filter(g => g.linkedAssetAccountId === assetAccountId)
      .toArray()
  },

  async syncFromAsset(goalId: string) {
    const goal = await db.savingsGoals.get(goalId)
    if (!goal?.linkedAssetAccountId) return null

    const asset = await db.assetAccounts.get(goal.linkedAssetAccountId)
    if (!asset) return null

    await db.savingsGoals.update(goalId, {
      currentAmount: asset.currentBalance,
      isCompleted: asset.currentBalance >= goal.targetAmount,
      updatedAt: new Date().toISOString(),
    })

    return asset.currentBalance
  },
}

// Savings Contribution operations
export const savingsContributionService = {
  async getAll() {
    return db.savingsContributions.orderBy('date').reverse().toArray()
  },

  async getByGoal(goalId: string) {
    return db.savingsContributions.where('goalId').equals(goalId).toArray()
  },

  async add(contribution: SavingsContribution) {
    // Also update the goal's current amount
    await savingsGoalService.addContribution(contribution.goalId, contribution.amount)
    const result = await db.savingsContributions.add(contribution)
    return result
  },

  async delete(id: string) {
    const contribution = await db.savingsContributions.get(id)
    if (contribution) {
      // Subtract from goal
      await savingsGoalService.addContribution(contribution.goalId, -contribution.amount)
    }
    const result = await db.savingsContributions.delete(id)
    return result
  },
}

// Monthly Savings Record operations
export const monthlySavingsRecordService = {
  async getAll() {
    return db.monthlySavingsRecords.orderBy('month').toArray()
  },

  async getByMonth(month: string) {
    return db.monthlySavingsRecords.where('month').equals(month).toArray()
  },

  async getByGoal(goalId: string) {
    return db.monthlySavingsRecords.where('goalId').equals(goalId).toArray()
  },

  async getByMonthAndGoal(month: string, goalId: string) {
    return db.monthlySavingsRecords
      .where('[month+goalId]')
      .equals([month, goalId])
      .first()
  },

  async upsert(record: MonthlySavingsRecord) {
    const existing = await db.monthlySavingsRecords
      .where('[month+goalId]')
      .equals([record.month, record.goalId])
      .first()
    let result
    if (existing) {
      result = await db.monthlySavingsRecords.update(existing.id, record)
    } else {
      result = await db.monthlySavingsRecords.add(record)
    }
    return result
  },

  async add(record: MonthlySavingsRecord) {
    const result = await db.monthlySavingsRecords.add(record)
    return result
  },

  async update(id: string, updates: Partial<MonthlySavingsRecord>) {
    const result = await db.monthlySavingsRecords.update(id, updates)
    return result
  },

  async delete(id: string) {
    const result = await db.monthlySavingsRecords.delete(id)
    return result
  },

  // Get yearly summary for a goal
  async getYearlySummary(goalId: string, year: number) {
    const records = await db.monthlySavingsRecords
      .where('goalId')
      .equals(goalId)
      .and(r => r.month.startsWith(year.toString()))
      .toArray()
    return records.sort((a, b) => a.month.localeCompare(b.month))
  },
}

// ============================================
// Patrimoine Services
// ============================================

// Asset Account operations
export const assetAccountService = {
  async getAll() {
    return db.assetAccounts.orderBy('order').toArray()
  },

  async getActive() {
    return db.assetAccounts.filter(a => a.isActive).sortBy('order')
  },

  async getById(id: string) {
    return db.assetAccounts.get(id)
  },

  async add(account: AssetAccount) {
    const result = await db.assetAccounts.add(account)
    return result
  },

  async update(id: string, updates: Partial<AssetAccount>) {
    const result = await db.assetAccounts.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    return result
  },

  async delete(id: string) {
    // Delete associated balance history
    await db.balanceHistory.where('accountId').equals(id).delete()
    const result = await db.assetAccounts.delete(id)
    return result
  },

  async getTotalBalance() {
    const accounts = await db.assetAccounts.filter(a => a.isActive).toArray()
    return accounts.reduce((sum, a) => sum + a.currentBalance, 0)
  },

  async getByType(type: string) {
    return db.assetAccounts.where('type').equals(type).toArray()
  },

  async updateBalance(id: string, newBalance: number) {
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    // Update current balance
    await db.assetAccounts.update(id, {
      currentBalance: newBalance,
      updatedAt: now,
    })

    // Add to history (upsert for today)
    const existingHistory = await db.balanceHistory
      .where('[accountId+date]')
      .equals([id, today])
      .first()

    if (existingHistory) {
      await db.balanceHistory.update(existingHistory.id, { balance: newBalance })
    } else {
      await db.balanceHistory.add({
        id: crypto.randomUUID(),
        accountId: id,
        balance: newBalance,
        date: today,
        createdAt: now,
      })
    }

    return newBalance
  },

  // Transfer money to an asset account (from main bank account)
  async transferToAccount(
    destinationAccountId: string,
    amount: number,
    description?: string,
    date?: string
  ) {
    const now = new Date().toISOString()
    const transferDate = date || now.split('T')[0]
    const month = transferDate.substring(0, 7)

    // Get destination account
    const destAccount = await db.assetAccounts.get(destinationAccountId)
    if (!destAccount) throw new Error('Compte destination introuvable')

    // Create transaction (outgoing transfer from main account)
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date: transferDate,
      type: 'VIREMENT_EMIS',
      description: description || `Virement vers ${destAccount.name}`,
      amount: -Math.abs(amount), // Negative = outgoing
      category: 'transfer-out',
      importId: `transfer-${month}`,
      isManuallyEdited: false,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }

    await db.transactions.add(transaction)

    // Update destination account balance
    const newBalance = destAccount.currentBalance + Math.abs(amount)
    await this.updateBalance(destinationAccountId, newBalance)

    return { transaction, newBalance }
  },

  // Transfer between two asset accounts
  async transferBetweenAccounts(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    _description?: string
  ) {
    const sourceAccount = await db.assetAccounts.get(sourceAccountId)
    const destAccount = await db.assetAccounts.get(destinationAccountId)

    if (!sourceAccount) throw new Error('Compte source introuvable')
    if (!destAccount) throw new Error('Compte destination introuvable')
    if (sourceAccount.currentBalance < amount) throw new Error('Solde insuffisant')

    // Update source account (decrease)
    const newSourceBalance = sourceAccount.currentBalance - Math.abs(amount)
    await this.updateBalance(sourceAccountId, newSourceBalance)

    // Update destination account (increase)
    const newDestBalance = destAccount.currentBalance + Math.abs(amount)
    await this.updateBalance(destinationAccountId, newDestBalance)

    return {
      sourceBalance: newSourceBalance,
      destinationBalance: newDestBalance
    }
  },
}

// Liability operations
export const liabilityService = {
  async getAll() {
    return db.liabilities.toArray()
  },

  async getActive() {
    return db.liabilities.filter(l => l.isActive).toArray()
  },

  async getById(id: string) {
    return db.liabilities.get(id)
  },

  async add(liability: Liability) {
    const result = await db.liabilities.add(liability)
    return result
  },

  async update(id: string, updates: Partial<Liability>) {
    const result = await db.liabilities.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    return result
  },

  async delete(id: string) {
    const result = await db.liabilities.delete(id)
    return result
  },

  async getTotalBalance() {
    const liabilities = await db.liabilities.filter(l => l.isActive).toArray()
    return liabilities.reduce((sum, l) => sum + l.remainingBalance, 0)
  },
}

// Balance History operations
export const balanceHistoryService = {
  async getByAccount(accountId: string) {
    return db.balanceHistory
      .where('accountId')
      .equals(accountId)
      .sortBy('date')
  },

  async getByDateRange(startDate: string, endDate: string) {
    return db.balanceHistory
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray()
  },

  async add(history: BalanceHistory) {
    const result = await db.balanceHistory.add(history)
    return result
  },

  async deleteOlderThan(date: string) {
    const result = await db.balanceHistory.where('date').below(date).delete()
    return result
  },
}

// Net Worth Snapshot operations
export const netWorthSnapshotService = {
  async getAll() {
    return db.netWorthSnapshots.orderBy('date').toArray()
  },

  async getLatest() {
    const snapshots = await db.netWorthSnapshots.orderBy('date').reverse().limit(1).toArray()
    return snapshots[0] || null
  },

  async getByDateRange(startDate: string, endDate: string) {
    return db.netWorthSnapshots
      .where('date')
      .between(startDate, endDate, true, true)
      .sortBy('date')
  },

  async add(snapshot: NetWorthSnapshot) {
    const result = await db.netWorthSnapshots.add(snapshot)
    return result
  },

  async createSnapshot() {
    const assets = await db.assetAccounts.filter(a => a.isActive).toArray()
    const liabilities = await db.liabilities.filter(l => l.isActive).toArray()

    const totalAssets = assets.reduce((sum, a) => sum + a.currentBalance, 0)
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.remainingBalance, 0)

    // Group by account type
    const byAccountType: Record<string, number> = {}
    for (const asset of assets) {
      byAccountType[asset.type] = (byAccountType[asset.type] || 0) + asset.currentBalance
    }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Check if snapshot exists for today
    const existing = await db.netWorthSnapshots.where('date').equals(today).first()

    const snapshot: NetWorthSnapshot = {
      id: existing?.id || crypto.randomUUID(),
      date: today,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      byAccountType: byAccountType as any,
      createdAt: existing?.createdAt || now,
    }

    if (existing) {
      await db.netWorthSnapshots.update(existing.id, snapshot)
    } else {
      await db.netWorthSnapshots.add(snapshot)
    }

    return snapshot
  },

  // Get monthly snapshots for the past N months
  async getMonthlySnapshots(months: number = 12) {
    const snapshots = await db.netWorthSnapshots.orderBy('date').reverse().toArray()

    // Group by month, take the last snapshot of each month
    const byMonth = new Map<string, NetWorthSnapshot>()
    for (const snapshot of snapshots) {
      const month = snapshot.date.substring(0, 7)
      if (!byMonth.has(month)) {
        byMonth.set(month, snapshot)
      }
    }

    // Get the last N months
    return Array.from(byMonth.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-months)
  },
}

// ============================================
// Settings Service
// ============================================

export const settingsService = {
  async get(key: string): Promise<unknown | null> {
    const setting = await db.settings.where('key').equals(key).first()
    return setting?.value ?? null
  },

  async set(key: string, value: unknown): Promise<void> {
    const existing = await db.settings.where('key').equals(key).first()
    if (existing) {
      await db.settings.update(existing.id, { value })
    } else {
      await db.settings.add({
        id: crypto.randomUUID(),
        key,
        value,
      })
    }
  },

  async delete(key: string): Promise<void> {
    const existing = await db.settings.where('key').equals(key).first()
    if (existing) {
      await db.settings.delete(existing.id)
    }
  },

  // Convenience methods for initial balance
  async getInitialBalance(): Promise<number> {
    const value = await this.get('initialBalance')
    return typeof value === 'number' ? value : 0
  },

  async setInitialBalance(balance: number): Promise<void> {
    await this.set('initialBalance', balance)
  },
}
