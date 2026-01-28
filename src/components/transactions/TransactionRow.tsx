import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Transaction, Category } from '@/types'
import { formatMoney, formatDate } from '@utils/formatters'
import { COLORS } from '@utils/constants'

interface TransactionRowProps {
  transaction: Transaction
  category?: Category
  allCategories?: Category[]
  onCategoryChange?: (transactionId: string, categoryId: string) => void
  onBudgetMonthChange?: (transactionId: string, budgetMonth: string | undefined) => void
  isSelected?: boolean
  onSelect?: (transactionId: string, selected: boolean) => void
  showCheckbox?: boolean
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  category,
  allCategories = [],
  onCategoryChange,
  onBudgetMonthChange,
  isSelected = false,
  onSelect,
  showCheckbox = false,
}: TransactionRowProps) {
  const { id, date, description, type, amount, category: categoryId, budgetMonth } = transaction
  const isCredit = amount > 0
  const color = category?.color || COLORS[categoryId] || COLORS.other
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [monthPickerPosition, setMonthPickerPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dateButtonRef = useRef<HTMLButtonElement>(null)
  const monthPickerRef = useRef<HTMLDivElement>(null)

  // Get the natural month from the transaction date
  const naturalMonth = date.substring(0, 7) // YYYY-MM
  const hasOverride = budgetMonth && budgetMonth !== naturalMonth

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown && !showMonthPicker) return

    const handleClickOutside = (e: MouseEvent) => {
      // Handle category dropdown
      if (
        showDropdown &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
      // Handle month picker
      if (
        showMonthPicker &&
        monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node) &&
        dateButtonRef.current && !dateButtonRef.current.contains(e.target as Node)
      ) {
        setShowMonthPicker(false)
      }
    }

    // Close on scroll (but not if scrolling inside the dropdown)
    const handleScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return // Don't close if scrolling inside dropdown
      }
      if (monthPickerRef.current && monthPickerRef.current.contains(e.target as Node)) {
        return // Don't close if scrolling inside month picker
      }
      setShowDropdown(false)
      setShowMonthPicker(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [showDropdown, showMonthPicker])

  const handleCategoryClick = useCallback(() => {
    if (onCategoryChange && allCategories.length > 0 && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
      setShowDropdown(prev => !prev)
    }
  }, [onCategoryChange, allCategories.length])

  const handleDateClick = useCallback(() => {
    if (onBudgetMonthChange && dateButtonRef.current) {
      const rect = dateButtonRef.current.getBoundingClientRect()
      setMonthPickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
      setShowMonthPicker(prev => !prev)
    }
  }, [onBudgetMonthChange])

  const handleBudgetMonthSelect = useCallback((newMonth: string | undefined) => {
    if (onBudgetMonthChange) {
      onBudgetMonthChange(id, newMonth)
    }
    setShowMonthPicker(false)
  }, [onBudgetMonthChange, id])

  // Generate month options (current month, previous month, next month)
  const monthOptions = useCallback(() => {
    const dateObj = new Date(date)
    const months: { value: string; label: string }[] = []

    // Previous month
    const prevMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() - 1, 1)
    months.push({
      value: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`,
      label: prevMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    })

    // Natural month (from transaction date)
    months.push({
      value: naturalMonth,
      label: dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) + ' (naturel)',
    })

    // Next month
    const nextMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 1)
    months.push({
      value: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
      label: nextMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    })

    return months
  }, [date, naturalMonth])

  const handleCategorySelect = (newCategoryId: string) => {
    if (onCategoryChange) {
      onCategoryChange(id, newCategoryId)
    }
    setShowDropdown(false)
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelect) {
      onSelect(id, e.target.checked)
    }
  }

  return (
    <tr className={`hover:bg-gray-700/30 transition-colors ${isSelected ? 'bg-blue-500/10' : ''}`}>
      {showCheckbox && (
        <td className="py-3 pl-2 pr-1 w-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-2 cursor-pointer"
            aria-label={`Sélectionner la transaction ${description}`}
          />
        </td>
      )}
      <td className="py-3">
        <button
          ref={dateButtonRef}
          onClick={handleDateClick}
          disabled={!onBudgetMonthChange}
          className={`text-sm text-gray-400 text-left ${
            onBudgetMonthChange ? 'hover:text-white cursor-pointer' : ''
          }`}
          title={onBudgetMonthChange ? 'Cliquez pour changer le mois budgétaire' : undefined}
        >
          {formatDate(date)}
          {hasOverride && (
            <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded font-medium">
              → {new Date(budgetMonth + '-01').toLocaleDateString('fr-FR', { month: 'short' })}
            </span>
          )}
        </button>

        {/* Month picker - rendered in portal */}
        {showMonthPicker && createPortal(
          <div
            ref={monthPickerRef}
            className="fixed z-[100] bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-[200px] p-2"
            style={{
              top: monthPickerPosition.top,
              left: monthPickerPosition.left,
            }}
          >
            <p className="text-xs text-gray-400 mb-2 px-2">Mois budgétaire :</p>
            {monthOptions().map((option) => (
              <button
                key={option.value}
                onClick={() => handleBudgetMonthSelect(option.value === naturalMonth ? undefined : option.value)}
                className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-700 ${
                  (budgetMonth || naturalMonth) === option.value ? 'bg-gray-700 text-purple-400' : 'text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate max-w-[200px] md:max-w-none">
            {description}
          </p>
          {transaction.source === 'manual' && (
            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded font-medium">
              Manuel
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{type}</p>
      </td>
      <td className="py-3">
        <button
          ref={buttonRef}
          onClick={handleCategoryClick}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
            onCategoryChange ? 'hover:ring-2 hover:ring-white/30 cursor-pointer' : ''
          }`}
          style={{
            backgroundColor: `${color}20`,
            color: color,
          }}
          disabled={!onCategoryChange}
          title={onCategoryChange ? 'Cliquez pour changer la categorie' : undefined}
        >
          {category?.name || categoryId}
        </button>

        {/* Category dropdown - rendered in portal to avoid overflow clipping */}
        {showDropdown && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[100] bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[180px]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {allCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2 ${
                  cat.id === categoryId ? 'bg-gray-700' : ''
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
      </td>
      <td
        className={`py-3 text-right font-medium ${
          isCredit ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {isCredit ? '+' : ''}
        {formatMoney(amount)}
      </td>
    </tr>
  )
})
