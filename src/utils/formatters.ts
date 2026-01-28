// Currency formatter for EUR
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

// Date formatters
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
})

const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
})

const fullDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Format a number as EUR currency
 */
export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount)
}

/**
 * Format a date string to short format (ex: "15 nov.")
 */
export function formatDate(dateStr: string): string {
  return dateFormatter.format(new Date(dateStr))
}

/**
 * Format a month string to full format (ex: "Novembre 2025")
 */
export function formatMonth(monthStr: string): string {
  // monthStr is YYYY-MM
  const date = new Date(monthStr + '-01')
  return monthFormatter.format(date)
}

/**
 * Format a date string to full format (ex: "15 novembre 2025")
 */
export function formatFullDate(dateStr: string): string {
  return fullDateFormatter.format(new Date(dateStr))
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get previous month from a YYYY-MM string
 */
export function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get next month from a YYYY-MM string
 */
export function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  const date = new Date(year, month, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Check if a month string is the current month
 */
export function isCurrentMonth(monthStr: string): boolean {
  return monthStr === getCurrentMonth()
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}
