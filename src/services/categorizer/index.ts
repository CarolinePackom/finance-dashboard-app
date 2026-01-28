import type { CategorizationRule } from '@/types'

// Categories that are income (not expenses)
const INCOME_CATEGORIES = new Set(['salary', 'transfer-in', 'refund', 'caf', 'compte-a-compte'])

// Default patterns for French banking
const DEFAULT_PATTERNS: Record<string, RegExp[]> = {
  'food-grocery': [
    /carrefour|leclerc|auchan|lidl|aldi|intermarche|super\s*u/i,
    /monoprix|franprix|casino|picard|bio\s*c\s*bon|naturalia/i,
    /match|cora|geant|hyper|magasin/i,
  ],
  'food-restaurant': [
    /mcdonald|burger\s*king|kfc|pizza|sushi|restaurant|brasserie/i,
    /uber\s*eats|deliveroo|just\s*eat|frichti/i,
    /cafe|bistro|bar|snack|kebab|thai|chinois|japonais/i,
  ],
  transport: [
    /sncf|ratp|uber|bolt|taxi|vtc|blablacar/i,
    /essence|total|shell|bp|esso|station|carburant/i,
    /parking|autoroute|peage|vinci|sanef/i,
    /velib|lime|bird|tier|trottinette/i,
  ],
  abonnements: [
    /netflix/i,
    /nintendo/i,
    /apple\.com|itunes|apple\s*(tv|music|one)/i,
    /spotify|deezer/i,
    /disney\s*\+|disney\s*plus/i,
    /euro\s*disney/i,
    /bouygues/i,
    /orange|sfr|free|sosh|red\s*by/i,
  ],
  entertainment: [
    /youtube\s*premium/i,
    /cinema|pathe|gaumont|ugc|mk2|theatre|concert|spectacle/i,
    /playstation|xbox|steam|gaming|jeux/i,
    /fnac\s*spectacle|ticketmaster|billeterie/i,
  ],
  amazon: [
    /amazon/i,
    /amzn/i,
    /\bamz\b/i,
    /amz\s*digital/i,
    /amz\s*mktp/i,
  ],
  shopping: [
    /fnac|darty|boulanger|cdiscount/i,
    /zalando|asos|vinted|leboncoin|vestiaire/i,
    /zara|h&m|uniqlo|decathlon|go\s*sport/i,
    /ikea|leroy\s*merlin|castorama|bricorama/i,
  ],
  housing: [
    /edf|engie|electricite|gaz|energie/i,
    /loyer|bailleur|immobilier|syndic|copropriete/i,
    /assurance\s*hab|maif|macif|matmut|axa/i,
    /eau|veolia|suez/i,
    /victorias?\s*keys?/i,
  ],
  telecom: [
    /mobile|forfait|internet|fibre|box/i,
  ],
  health: [
    /pharmacie|medecin|docteur|hopital|clinique/i,
    /mutuelle|sante|cpam|ameli|secu/i,
    /dentiste|ophtalmo|kine|osteo/i,
  ],
  'bank-fees': [
    /frais\s*bancaire|commission|agios|interets/i,
    /cotisation\s*carte|assurance\s*carte/i,
  ],
  salary: [
    /salaire|paie|remuneration/i,
    /vir\s*(inst\s*)?.*employeur/i,
    /bulletin|fiche\s*de\s*paie/i,
    /packom/i,
  ],
  caf: [
    /\bcaf\b/i,
    /allocations?\s*familiales?/i,
  ],
  'compte-a-compte': [
    /faveur\s*de\s*(m\.|mr|mme|mlle)?\s*wirth/i,
  ],
  'transfer-in': [
    /virement\s*(en\s*)?(votre\s*)?faveur/i,
    /vir(ement)?\s*(inst\s*)?(de|recu)/i,
    /vir\s*inst.*\bde\b/i,
    /mangopay|vinted|leboncoin|ebay/i,
    /wero/i,
  ],
  refund: [
    /remboursement|avoir|credit|retrocession/i,
    /c\.?p\.?a\.?m|cpam|ameli|secu/i,
  ],
  'transfer-out': [
    /vir(ement)?\s*(inst\s*)?(vers|emis|pour)/i,
  ],
  internal: [
    /prelevement|prlv/i,
    /cotisation|adhesion/i,
  ],
}

export class TransactionCategorizer {
  private userRules: CategorizationRule[]
  private defaultPatterns: typeof DEFAULT_PATTERNS

  constructor(userRules: CategorizationRule[] = []) {
    this.userRules = userRules.sort((a, b) => b.priority - a.priority)
    this.defaultPatterns = DEFAULT_PATTERNS
  }

  /**
   * Categorize a transaction based on description and type
   * @param description - Transaction description
   * @param type - Transaction type (optional)
   * @param isExpense - Whether the transaction is an expense (negative amount)
   * @returns Category ID or null if no match
   */
  categorize(description: string, type?: string, isExpense?: boolean): string | null {
    const normalizedDesc = description.toLowerCase().trim()
    const normalizedType = type?.toLowerCase().trim() || ''

    // 1. Try user-defined rules first (highest priority)
    // User rules are ALWAYS applied regardless of income/expense type
    // because the user explicitly chose that category
    for (const rule of this.userRules) {
      if (!rule.isActive) continue

      const regex = new RegExp(rule.pattern, 'i')
      const value = rule.field === 'description' ? normalizedDesc : normalizedType

      if (regex.test(value)) {
        console.log(`✅ User rule matched: "${rule.pattern}" → ${rule.categoryId}`)
        return rule.categoryId
      }
    }

    // 2. Fall back to default patterns
    for (const [categoryId, patterns] of Object.entries(this.defaultPatterns)) {
      // Skip income categories for expenses and vice versa
      if (isExpense !== undefined) {
        const isIncomeCategory = INCOME_CATEGORIES.has(categoryId)
        if (isExpense && isIncomeCategory) continue
        if (!isExpense && !isIncomeCategory && categoryId !== 'other') continue
      }

      for (const pattern of patterns) {
        if (pattern.test(normalizedDesc) || pattern.test(normalizedType)) {
          return categoryId
        }
      }
    }

    // 3. Default to 'other'
    return 'other'
  }

  /**
   * Add a new user rule based on a correction
   */
  addRule(rule: CategorizationRule): void {
    this.userRules.push(rule)
    this.userRules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Update user rules
   */
  setRules(rules: CategorizationRule[]): void {
    this.userRules = rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Detect transaction type from description
   */
  detectType(description: string): string {
    const desc = description.toLowerCase()

    if (/cb\s*\*|carte\s*\*|paiement\s*carte/i.test(desc)) {
      return 'PAIEMENT_CARTE'
    }
    if (/vir(ement)?\s*(inst\s*)?(de|recu|faveur)/i.test(desc)) {
      return 'VIREMENT_RECU'
    }
    if (/vir(ement)?\s*(inst\s*)?(vers|emis|pour)/i.test(desc)) {
      return 'VIREMENT_EMIS'
    }
    if (/prlv|prelevement/i.test(desc)) {
      return 'PRELEVEMENT'
    }
    if (/avoir|credit|remboursement/i.test(desc)) {
      return 'AVOIR'
    }
    if (/cotisation|adhesion/i.test(desc)) {
      return 'COTISATION'
    }

    return 'AUTRE'
  }
}

// Singleton instance
let categorizerInstance: TransactionCategorizer | null = null
let rulesLoaded = false

export function getCategorizer(rules?: CategorizationRule[]): TransactionCategorizer {
  if (!categorizerInstance || rules) {
    categorizerInstance = new TransactionCategorizer(rules)
    if (rules) rulesLoaded = true
  }
  return categorizerInstance
}

export async function getCategorizerWithRules(): Promise<TransactionCategorizer> {
  // Dynamically import to avoid circular dependency
  const { ruleService } = await import('@services/db')
  const rules = await ruleService.getAll()
  console.log(`📚 Loaded ${rules.length} user rules`)
  return getCategorizer(rules)
}

export function resetCategorizer(): void {
  categorizerInstance = null
  rulesLoaded = false
}
