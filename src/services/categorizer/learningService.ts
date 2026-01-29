import { v4 as uuidv4 } from 'uuid'
import { db, ruleService } from '@services/db'
import type { CategorizationRule, Transaction } from '@/types'
import { resetCategorizer } from './index'

/**
 * Extract meaningful keywords from a transaction description
 * to create a reusable pattern
 */
function extractKeywords(description: string): string[] {
  // Normalize
  const normalized = description.toUpperCase().trim()

  // Remove common banking prefixes
  const cleaned = normalized
    .replace(/^(PAIEMENT|PRLV|PRELEVEMENT|VIREMENT|VIR|CB|CARTE)\s*/i, '')
    .replace(/^(SEPA|INST|EURO)\s*/i, '')
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // Remove dates
    .replace(/\d{10,}/g, '') // Remove long numbers (account numbers, refs)
    .replace(/[*]{2,}/g, '') // Remove asterisks
    .trim()

  // Split into words
  const words = cleaned.split(/\s+/)

  // Filter meaningful words (at least 3 chars, not just numbers)
  const keywords = words.filter(word => {
    if (word.length < 3) return false
    if (/^\d+$/.test(word)) return false // Skip pure numbers
    if (/^(DE|DU|LA|LE|LES|EN|AU|AUX|PAR|POUR|SUR|AVEC)$/i.test(word)) return false // Skip prepositions
    return true
  })

  // Return first 2-3 meaningful keywords
  return keywords.slice(0, 3)
}

/**
 * Create a regex pattern from keywords
 */
function createPattern(keywords: string[]): string {
  if (keywords.length === 0) return ''

  // Escape regex special characters and join with .*
  const escaped = keywords.map(kw =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )

  // Create pattern that matches all keywords in order
  return escaped.join('.*')
}

/**
 * Learn from a manual category correction
 * Creates a rule so the same pattern will be auto-categorized in future
 */
export async function learnFromCorrection(
  transaction: Transaction,
  newCategoryId: string
): Promise<CategorizationRule | null> {
  const keywords = extractKeywords(transaction.description)

  if (keywords.length === 0) {
    console.log('⚠️ No keywords extracted, cannot create rule')
    return null
  }

  const pattern = createPattern(keywords)

  if (!pattern) {
    return null
  }

  // Check if a similar rule already exists
  const existingRules = await ruleService.getAll()
  const similarRule = existingRules.find(r =>
    r.pattern.toLowerCase() === pattern.toLowerCase() ||
    r.pattern.toLowerCase().includes(keywords[0].toLowerCase())
  )

  if (similarRule) {
    // Update existing rule if category changed
    if (similarRule.categoryId !== newCategoryId) {
      await ruleService.update(similarRule.id, { categoryId: newCategoryId })
      console.log(`📝 Updated rule: "${pattern}" → ${newCategoryId}`)
      resetCategorizer() // Reset to pick up new rules
      return { ...similarRule, categoryId: newCategoryId }
    }
    return similarRule
  }

  // Create new rule
  const rule: CategorizationRule = {
    id: uuidv4(),
    categoryId: newCategoryId,
    pattern: pattern,
    field: 'description',
    priority: 100, // User rules have high priority
    isActive: true,
    createdAt: new Date().toISOString(),
  }

  await ruleService.add(rule)
  console.log(`✅ Created rule: "${pattern}" → ${newCategoryId}`)

  // Reset categorizer to pick up new rules
  resetCategorizer()

  return rule
}

/**
 * Get all learned rules
 */
export async function getLearnedRules(): Promise<CategorizationRule[]> {
  return ruleService.getAll()
}

/**
 * Apply learned rules to recategorize transactions
 */
export async function applyLearnedRules(): Promise<number> {
  const rules = await ruleService.getAll()
  if (rules.length === 0) return 0

  const transactions = await db.transactions.toArray()
  let updated = 0

  for (const t of transactions) {
    // Skip manually edited transactions
    if (t.isManuallyEdited) continue

    for (const rule of rules) {
      if (!rule.isActive) continue

      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(t.description)) {
        if (t.category !== rule.categoryId) {
          await db.transactions.update(t.id, { category: rule.categoryId })
          updated++
        }
        break // First matching rule wins
      }
    }
  }

  return updated
}

/**
 * Delete a learned rule
 */
export async function deleteRule(ruleId: string): Promise<void> {
  await ruleService.delete(ruleId)
  resetCategorizer()
}

/**
 * Clear all learned rules
 */
export async function clearAllRules(): Promise<void> {
  const rules = await ruleService.getAll()
  for (const rule of rules) {
    await ruleService.delete(rule.id)
  }
  resetCategorizer()
}

/**
 * Learn from all manually edited transactions
 * and apply to similar unedited transactions
 */
export async function learnFromAllCorrections(): Promise<{
  rulesCreated: number
  transactionsUpdated: number
}> {
  // 1. Find all manually edited transactions
  const allTransactions = await db.transactions.toArray()
  const manuallyEdited = allTransactions.filter(t => t.isManuallyEdited)

  console.log(`📚 Found ${manuallyEdited.length} manually edited transactions`)

  let rulesCreated = 0

  // 2. Learn from each manually edited transaction
  for (const t of manuallyEdited) {
    const rule = await learnFromCorrection(t, t.category)
    if (rule) {
      rulesCreated++
    }
  }

  // 3. Apply learned rules to unedited transactions
  const rules = await ruleService.getAll()
  const uneditedTransactions = allTransactions.filter(t => !t.isManuallyEdited)

  let transactionsUpdated = 0

  for (const t of uneditedTransactions) {
    for (const rule of rules) {
      if (!rule.isActive) continue

      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(t.description)) {
        if (t.category !== rule.categoryId) {
          await db.transactions.update(t.id, { category: rule.categoryId })
          transactionsUpdated++
          console.log(`✅ Updated: "${t.description.substring(0, 30)}..." → ${rule.categoryId}`)
        }
        break // First matching rule wins
      }
    }
  }

  return { rulesCreated, transactionsUpdated }
}

/**
 * Recategorize all transactions using default patterns + user rules
 * Only updates transactions that are not manually edited
 */
export async function recategorizeAllTransactions(): Promise<{
  updated: number
  total: number
}> {
  const { getCategorizerWithRules } = await import('./index')
  const categorizer = await getCategorizerWithRules()

  const allTransactions = await db.transactions.toArray()
  let updated = 0

  for (const t of allTransactions) {
    // Skip manually edited transactions
    if (t.isManuallyEdited) continue

    const isExpense = t.amount < 0
    const newCategory = categorizer.categorize(t.description, t.type, isExpense)

    if (newCategory && newCategory !== t.category) {
      await db.transactions.update(t.id, { category: newCategory })
      console.log(`🔄 Recategorized: "${t.description.substring(0, 40)}..." → ${newCategory}`)
      updated++
    }
  }

  console.log(`✅ Recategorized ${updated}/${allTransactions.length} transactions`)
  return { updated, total: allTransactions.length }
}
