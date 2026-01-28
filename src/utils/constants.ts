// Category colors map
export const COLORS: Record<string, string> = {
  'food-grocery': '#22c55e',
  'food-restaurant': '#f97316',
  transport: '#3b82f6',
  entertainment: '#a855f7',
  shopping: '#ec4899',
  housing: '#eab308',
  telecom: '#14b8a6',
  health: '#ef4444',
  'bank-fees': '#6b7280',
  salary: '#10b981',
  'transfer-in': '#22d3ee',
  refund: '#84cc16',
  'transfer-out': '#f43f5e',
  internal: '#8b5cf6',
  other: '#94a3b8',
}

// Transaction type labels
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  PAIEMENT_CARTE: 'Paiement carte',
  VIREMENT_RECU: 'Virement recu',
  VIREMENT_EMIS: 'Virement emis',
  PRELEVEMENT: 'Prelevement',
  AVOIR: 'Avoir',
  COTISATION: 'Cotisation',
  AUTRE: 'Autre',
}

// Tooltip styles for Recharts
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
  },
  itemStyle: { color: '#e5e7eb' },
  labelStyle: { color: '#9ca3af' },
}

// Chart margins
export const CHART_MARGINS = {
  top: 10,
  right: 10,
  left: 10,
  bottom: 10,
}

// Default filter state
export const DEFAULT_FILTERS = {
  dateRange: { start: null, end: null },
  categories: [],
  types: [],
  amountRange: { min: null, max: null },
  searchQuery: '',
  showIncome: true,
  showExpenses: true,
}
