import { useState, useCallback, useMemo, memo } from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import type { Period, PeriodType } from '@/types'

interface PeriodSelectorProps {
  selectedPeriod: Period
  availableMonths: string[] // YYYY-MM format
  onPeriodChange: (period: Period) => void
}

// Get quarter info from month
function getQuarter(month: string): { quarter: number; year: string } {
  const [year, m] = month.split('-')
  const monthNum = parseInt(m, 10)
  const quarter = Math.ceil(monthNum / 3)
  return { quarter, year }
}

// Get quarter date range
function getQuarterRange(year: string, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = quarter * 3
  const lastDay = new Date(parseInt(year), endMonth, 0).getDate()
  return {
    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`,
  }
}

// Get year date range
function getYearRange(year: string): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  }
}

// Get month date range
function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split('-')
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
  return {
    start: `${month}-01`,
    end: `${month}-${lastDay}`,
  }
}

// Format period for display
function formatPeriodLabel(type: PeriodType, value: string): string {
  switch (type) {
    case 'month':
      return new Date(value + '-01').toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
    case 'quarter':
      const [year, q] = value.split('-Q')
      return `T${q} ${year}`
    case 'year':
      return `Année ${value}`
    case 'all':
      return 'Toutes les données'
    case 'custom':
      return 'Période personnalisée'
    default:
      return value
  }
}

export const PeriodSelector = memo(function PeriodSelector({
  selectedPeriod,
  availableMonths,
  onPeriodChange,
}: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<PeriodType>(selectedPeriod.type)

  // Derive available periods from months
  const { years, quarters, months } = useMemo(() => {
    const yearsSet = new Set<string>()
    const quartersSet = new Set<string>()

    for (const month of availableMonths) {
      const [year] = month.split('-')
      yearsSet.add(year)
      const { quarter } = getQuarter(month)
      quartersSet.add(`${year}-Q${quarter}`)
    }

    return {
      years: Array.from(yearsSet).sort().reverse(),
      quarters: Array.from(quartersSet).sort().reverse(),
      months: [...availableMonths].sort().reverse(),
    }
  }, [availableMonths])

  // Get all data range
  const allDataRange = useMemo(() => {
    if (months.length === 0) return { start: '', end: '' }
    const sortedMonths = [...months].sort()
    const firstMonth = sortedMonths[0]
    const lastMonth = sortedMonths[sortedMonths.length - 1]
    return {
      start: `${firstMonth}-01`,
      end: getMonthRange(lastMonth).end,
    }
  }, [months])

  const handleSelect = useCallback(
    (type: PeriodType, value: string) => {
      let period: Period

      switch (type) {
        case 'month': {
          const range = getMonthRange(value)
          period = {
            type: 'month',
            label: formatPeriodLabel('month', value),
            startDate: range.start,
            endDate: range.end,
          }
          break
        }
        case 'quarter': {
          const [year, q] = value.split('-Q')
          const range = getQuarterRange(year, parseInt(q))
          period = {
            type: 'quarter',
            label: formatPeriodLabel('quarter', value),
            startDate: range.start,
            endDate: range.end,
          }
          break
        }
        case 'year': {
          const range = getYearRange(value)
          period = {
            type: 'year',
            label: formatPeriodLabel('year', value),
            startDate: range.start,
            endDate: range.end,
          }
          break
        }
        case 'all': {
          period = {
            type: 'all',
            label: formatPeriodLabel('all', ''),
            startDate: allDataRange.start,
            endDate: allDataRange.end,
          }
          break
        }
        default:
          return
      }

      onPeriodChange(period)
      setIsOpen(false)
    },
    [onPeriodChange, allDataRange]
  )

  const tabs: { type: PeriodType; label: string }[] = [
    { type: 'month', label: 'Mois' },
    { type: 'quarter', label: 'Trimestre' },
    { type: 'year', label: 'Année' },
    { type: 'all', label: 'Tout' },
  ]

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm border border-gray-600 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Calendar className="w-4 h-4 text-blue-400" />
        <span className="font-medium">{selectedPeriod.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              {tabs.map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => setActiveTab(tab.type)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.type
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-64 overflow-y-auto p-2">
              {activeTab === 'month' && (
                <div className="space-y-1">
                  {months.map((month) => {
                    const isSelected =
                      selectedPeriod.type === 'month' &&
                      selectedPeriod.startDate === `${month}-01`
                    return (
                      <button
                        key={month}
                        onClick={() => handleSelect('month', month)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span className="capitalize">
                          {new Date(month + '-01').toLocaleDateString('fr-FR', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeTab === 'quarter' && (
                <div className="space-y-1">
                  {quarters.map((q) => {
                    const [year, quarter] = q.split('-Q')
                    const range = getQuarterRange(year, parseInt(quarter))
                    const isSelected =
                      selectedPeriod.type === 'quarter' &&
                      selectedPeriod.startDate === range.start
                    return (
                      <button
                        key={q}
                        onClick={() => handleSelect('quarter', q)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span>Trimestre {quarter} - {year}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeTab === 'year' && (
                <div className="space-y-1">
                  {years.map((year) => {
                    const range = getYearRange(year)
                    const isSelected =
                      selectedPeriod.type === 'year' &&
                      selectedPeriod.startDate === range.start
                    return (
                      <button
                        key={year}
                        onClick={() => handleSelect('year', year)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span>Année {year}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeTab === 'all' && (
                <div className="p-2">
                  <button
                    onClick={() => handleSelect('all', '')}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                      selectedPeriod.type === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-medium">Toutes les données</p>
                      {months.length > 0 && (
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(allDataRange.start).toLocaleDateString('fr-FR', {
                            month: 'short',
                            year: 'numeric',
                          })}
                          {' → '}
                          {new Date(allDataRange.end).toLocaleDateString('fr-FR', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                    {selectedPeriod.type === 'all' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})
