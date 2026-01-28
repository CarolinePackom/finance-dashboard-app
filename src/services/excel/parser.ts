import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction, TransactionType } from '@/types'
import { getCategorizer, getCategorizerWithRules } from '@services/categorizer'

export interface ColumnMapping {
  date?: number
  type?: number
  description?: number
  debit?: number
  credit?: number
  amount?: number
}

export interface ParsedRow {
  date: string
  type: string
  description: string
  debit: number
  credit: number
  raw: Record<string, unknown>
}

export interface ParseResult {
  rows: ParsedRow[]
  headers: string[]
  errors: ParseError[]
  detectedMapping: ColumnMapping
  filename: string
}

export interface ParseError {
  row: number
  field: string
  message: string
  value: unknown
}

/**
 * Parse an Excel file and extract transaction data
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  if (jsonData.length < 2) {
    return {
      rows: [],
      headers: [],
      errors: [{ row: 0, field: 'file', message: 'Le fichier est vide ou invalide', value: null }],
      detectedMapping: {},
      filename: file.name,
    }
  }

  // Find the actual header row (skip title rows)
  // Bank exports often have 1-3 rows of metadata before the actual headers
  const headerRowIndex = findHeaderRow(jsonData)

  // Extract headers from the detected row
  const headers = (jsonData[headerRowIndex] as unknown[]).map((h) => String(h || '').trim())

  // Auto-detect column mapping
  const mapping = detectColumnMapping(headers)

  // Parse rows (skip everything before and including the header row)
  const dataRows = jsonData.slice(headerRowIndex + 1) as unknown[][]
  const { rows, errors } = parseRows(dataRows, mapping, headers)

  return {
    rows,
    headers,
    errors,
    detectedMapping: mapping,
    filename: file.name,
  }
}

/**
 * Find the header row by looking for rows with multiple columns
 * that match common banking header patterns
 */
function findHeaderRow(data: unknown[][]): number {
  // Common header keywords for French bank exports
  const headerKeywords = [
    /date/i, /libelle/i, /montant/i, /debit/i, /credit/i,
    /operation/i, /valeur/i, /description/i, /type/i,
    /solde/i, /référence/i, /reference/i
  ]

  // Check first 10 rows to find headers
  const maxRowsToCheck = Math.min(10, data.length)

  for (let i = 0; i < maxRowsToCheck; i++) {
    const row = data[i]
    if (!row) continue

    // Count non-empty cells
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '').length

    // A header row should have at least 3 columns
    if (nonEmptyCells < 3) continue

    // Check if this row contains header-like keywords
    const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ')
    const matchCount = headerKeywords.filter(kw => kw.test(rowText)).length

    // If at least 2 keywords match, this is likely the header row
    if (matchCount >= 2) {
      console.log(`Found header row at index ${i}:`, row)
      return i
    }
  }

  // Fallback: find first row with at least 3 non-empty cells
  for (let i = 0; i < maxRowsToCheck; i++) {
    const row = data[i]
    if (!row) continue

    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '').length
    if (nonEmptyCells >= 3) {
      console.log(`Using row ${i} as header (first row with 3+ columns):`, row)
      return i
    }
  }

  // Default to first row
  return 0
}

/**
 * Auto-detect column mapping based on header names
 */
function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}

  // Priority-ordered patterns for better detection
  // More comprehensive patterns for French banking exports
  const patterns: Record<keyof ColumnMapping, RegExp[]> = {
    date: [
      /^date$/i,
      /date\s*(op|oper|operation|valeur|comptable)/i,
      /^dt$/i,
      /^jour$/i,
      /date\s*d/i,
    ],
    type: [
      /^type$/i,
      /type\s*(op|oper)/i,
      /^nature$/i,
      /^operation$/i,
      /^categorie$/i,
    ],
    description: [
      // Prefer "complet" or longer description columns first
      /libell[ée]\s*(complet|d[ée]taill[ée])/i,
      /^libell[ée]$/i,
      /libell[ée]\s*(simplifi[ée]|operation|op)/i,
      /^d[ée]tail$/i,
      /^description$/i,
      /^motif$/i,
      /^lib$/i,
      /^intitul[ée]$/i,
      /^d[ée]signation$/i,
      /^communication$/i,
      /^op[ée]ration$/i,
    ],
    debit: [
      /^debit$/i,
      /^débit$/i,
      /montant\s*debit/i,
      /^sortie/i,
      /^retrait/i,
      /debit\s*euro/i,
    ],
    credit: [
      /^credit$/i,
      /^crédit$/i,
      /montant\s*credit/i,
      /^entree/i,
      /^entrée/i,
      /^encaissement/i,
      /^depot/i,
      /^dépôt/i,
      /^versement/i,
      /credit\s*euro/i,
    ],
    amount: [
      /^montant$/i,
      /montant\s*(en\s*)?(eur|euro|€)/i,
      /^somme$/i,
      /^valeur$/i,
      /montant\s*(op|operation)/i,
    ],
  }

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim()

    for (const [field, patternList] of Object.entries(patterns)) {
      // Check if any pattern matches
      const matches = patternList.some(pattern => pattern.test(normalizedHeader))
      if (matches && mapping[field as keyof ColumnMapping] === undefined) {
        mapping[field as keyof ColumnMapping] = index
        break
      }
    }
  })

  // If no date column found, use first column as default
  if (mapping.date === undefined) {
    mapping.date = 0
  }

  // If no amount columns found, try to find numeric columns
  if (mapping.debit === undefined && mapping.credit === undefined && mapping.amount === undefined) {
    // Look for columns that might be amounts based on position (usually last columns)
    // Common pattern: Date, Description, Debit, Credit or Date, Description, Amount
    const numCols = headers.length
    if (numCols >= 4) {
      // Assume last two columns might be debit/credit
      mapping.debit = numCols - 2
      mapping.credit = numCols - 1
    } else if (numCols === 3) {
      // Assume last column is amount
      mapping.amount = numCols - 1
    }
  }

  console.log('Detected column mapping:', mapping, 'from headers:', headers)

  return mapping
}

/**
 * Parse rows based on column mapping
 */
function parseRows(
  rows: unknown[][],
  mapping: ColumnMapping,
  headers: string[]
): { rows: ParsedRow[]; errors: ParseError[] } {
  const parsedRows: ParsedRow[] = []
  const errors: ParseError[] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2 // Account for header row and 0-index

    // Skip empty rows
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) {
      return
    }

    // Extract values - use explicit checks for undefined/null
    const dateValue = mapping.date !== undefined ? row[mapping.date] : null
    const typeValue = mapping.type !== undefined ? String(row[mapping.type] ?? '') : ''
    const descValue = mapping.description !== undefined ? String(row[mapping.description] ?? '') : ''
    const debitValue = mapping.debit !== undefined ? row[mapping.debit] : null
    const creditValue = mapping.credit !== undefined ? row[mapping.credit] : null
    const amountValue = mapping.amount !== undefined ? row[mapping.amount] : null

    // Parse date
    let date: string
    try {
      date = parseDate(dateValue)
    } catch {
      errors.push({
        row: rowNum,
        field: 'date',
        message: 'Date invalide',
        value: dateValue,
      })
      return
    }

    // Parse amounts
    let debit = 0
    let credit = 0

    if (amountValue !== null && amountValue !== undefined) {
      // Single amount column
      const amount = parseAmount(amountValue)
      if (amount < 0) {
        debit = Math.abs(amount)
      } else {
        credit = amount
      }
    } else {
      // Separate debit/credit columns
      debit = debitValue ? parseAmount(debitValue) : 0
      credit = creditValue ? parseAmount(creditValue) : 0
    }

    // Create raw record for reference
    const raw: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      raw[h] = row[i]
    })

    // Build description from available data
    let description = descValue || typeValue

    // If still empty, try to build from raw data
    if (!description) {
      // Try to find any text column that might have a description
      const textValues = row
        .map((cell, i) => {
          // Skip date and amount columns
          if (i === mapping.date || i === mapping.debit || i === mapping.credit || i === mapping.amount) {
            return null
          }
          const val = String(cell ?? '').trim()
          // Only use if it's not a number and has reasonable length
          if (val && val.length > 2 && isNaN(Number(val.replace(/[,.\s]/g, '')))) {
            return val
          }
          return null
        })
        .filter(Boolean)

      description = textValues.join(' - ') || `Transaction du ${date}`
    }

    parsedRows.push({
      date,
      type: typeValue,
      description,
      debit: Math.abs(debit),
      credit: Math.abs(credit),
      raw,
    })
  })

  return { rows: parsedRows, errors }
}

/**
 * Parse a date value to ISO format (YYYY-MM-DD)
 */
function parseDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    throw new Error('Empty date')
  }

  // If already a Date object (from XLSX with cellDates: true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new Error('Invalid Date object')
    }
    return value.toISOString().split('T')[0]
  }

  // Handle Excel serial date numbers (days since 1899-12-30)
  if (typeof value === 'number') {
    // Excel serial dates: 1 = 1900-01-01, but Excel has a bug thinking 1900 was a leap year
    // So we use 1899-12-30 as base
    const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }

  const str = String(value).trim()

  // Skip if it's clearly not a date
  if (!str || str.length < 6) {
    throw new Error(`Too short for date: ${str}`)
  }

  // Try common French and international formats
  const patterns = [
    // DD/MM/YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: (m: string[]) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    // DD/MM/YY (2 digit year)
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, format: (m: string[]) => {
      const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`
      return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }},
    // DD-MM-YYYY
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: (m: string[]) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    // DD-MM-YY
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{2})$/, format: (m: string[]) => {
      const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`
      return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }},
    // YYYY-MM-DD (ISO)
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})/, format: (m: string[]) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    // DD.MM.YYYY
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, format: (m: string[]) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    // DD.MM.YY
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/, format: (m: string[]) => {
      const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`
      return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }},
    // YYYY/MM/DD
    { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, format: (m: string[]) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    // DD MMM YYYY (e.g., "15 nov 2025" or "15 Nov 2025")
    { regex: /^(\d{1,2})\s+(jan|fev|feb|mar|avr|apr|mai|may|jun|jui|jul|aou|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})$/i, format: (m: string[]) => {
      const monthMap: Record<string, string> = {
        jan: '01', fev: '02', feb: '02', mar: '03', avr: '04', apr: '04',
        mai: '05', may: '05', jun: '06', jui: '07', jul: '07', aou: '08', aug: '08',
        sep: '09', oct: '10', nov: '11', dec: '12'
      }
      const month = monthMap[m[2].toLowerCase().substring(0, 3)] || '01'
      return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
    }},
  ]

  for (const { regex, format } of patterns) {
    const match = str.match(regex)
    if (match) {
      return format(match)
    }
  }

  // Try parsing with Date constructor as last resort
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  throw new Error(`Cannot parse date: ${str}`)
}

/**
 * Parse an amount value to a number
 */
function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  let str = String(value).trim()

  // Handle French number format: "1 234,56" or "1.234,56"
  // First, check if comma is used as decimal separator
  const hasCommaDecimal = /,\d{1,2}$/.test(str)

  if (hasCommaDecimal) {
    // French format: spaces or dots as thousands separator, comma as decimal
    str = str
      .replace(/\s/g, '')      // Remove spaces (thousand separator)
      .replace(/\.(?=\d{3})/g, '') // Remove dots used as thousand separator
      .replace(',', '.')       // Replace comma decimal with dot
  } else {
    // English format or just spaces
    str = str.replace(/\s/g, '')
  }

  // Remove currency symbols and other non-numeric chars (except . and -)
  str = str.replace(/[^0-9.\-]/g, '')

  // Handle multiple dots (keep only the last one as decimal)
  const parts = str.split('.')
  if (parts.length > 2) {
    str = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]
  }

  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

/**
 * Convert parsed rows to Transaction objects
 * Now async to load user-learned rules from database
 */
export async function convertToTransactions(
  rows: ParsedRow[],
  importId: string
): Promise<Transaction[]> {
  // Load categorizer with user-learned rules
  const categorizer = await getCategorizerWithRules()
  const now = new Date().toISOString()

  const transactions = rows.map((row, index) => {
    const amount = row.credit > 0 ? row.credit : -row.debit
    const isExpense = amount < 0
    const categoryId = categorizer.categorize(row.description, row.type, isExpense)
    const detectedType = categorizer.detectType(row.description) as TransactionType

    const transaction = {
      id: uuidv4(),
      date: row.date,
      type: detectedType,
      description: row.description,
      amount,
      category: categoryId || 'other',
      importId,
      originalRow: index + 2,
      isManuallyEdited: false,
      source: 'import' as const,
      createdAt: now,
      updatedAt: now,
    }

    return transaction
  })

  return transactions
}

/**
 * Get period (start/end dates) from transactions
 */
export function getTransactionPeriod(transactions: Transaction[]): { start: string; end: string } {
  if (transactions.length === 0) {
    const today = new Date().toISOString().split('T')[0]
    return { start: today, end: today }
  }

  const dates = transactions.map((t) => t.date).sort()
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  }
}
