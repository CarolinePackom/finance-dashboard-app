import { memo, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMoney } from '@utils/formatters'
import type { Transaction } from '@/types'

interface TransactionCalendarProps {
  transactions: Transaction[]
  onDayClick?: (date: string, transactions: Transaction[]) => void
}

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

interface DayData {
  date: string
  day: number
  income: number
  expenses: number
  transactions: Transaction[]
  isCurrentMonth: boolean
  isToday: boolean
}

export const TransactionCalendar = memo(function TransactionCalendar({
  transactions,
  onDayClick,
}: TransactionCalendarProps) {
  // Get initial month from transactions or current date
  const initialDate = useMemo(() => {
    if (transactions.length > 0) {
      const dates = transactions.map(t => t.date).sort()
      return new Date(dates[Math.floor(dates.length / 2)])
    }
    return new Date()
  }, [transactions])

  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth())
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Group transactions by date
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number; transactions: Transaction[] }>()

    for (const t of transactions) {
      const existing = map.get(t.date) || { income: 0, expenses: 0, transactions: [] }
      if (t.amount > 0) {
        existing.income += t.amount
      } else {
        existing.expenses += Math.abs(t.amount)
      }
      existing.transactions.push(t)
      map.set(t.date, existing)
    }

    return map
  }, [transactions])

  // Generate calendar days
  const calendarDays = useMemo((): DayData[] => {
    const days: DayData[] = []
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // First day of the month
    const firstDay = new Date(currentYear, currentMonth, 1)
    // Last day of the month
    const lastDay = new Date(currentYear, currentMonth + 1, 0)

    // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
    let startDayOfWeek = firstDay.getDay() - 1
    if (startDayOfWeek < 0) startDayOfWeek = 6 // Sunday becomes 6

    // Add days from previous month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i
      const date = new Date(currentYear, currentMonth - 1, day)
      const dateStr = date.toISOString().split('T')[0]
      const data = transactionsByDate.get(dateStr)

      days.push({
        date: dateStr,
        day,
        income: data?.income || 0,
        expenses: data?.expenses || 0,
        transactions: data?.transactions || [],
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      })
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(currentYear, currentMonth, day)
      const dateStr = date.toISOString().split('T')[0]
      const data = transactionsByDate.get(dateStr)

      days.push({
        date: dateStr,
        day,
        income: data?.income || 0,
        expenses: data?.expenses || 0,
        transactions: data?.transactions || [],
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      })
    }

    // Add days from next month to complete the grid (6 rows max)
    const remainingDays = 42 - days.length // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth + 1, day)
      const dateStr = date.toISOString().split('T')[0]
      const data = transactionsByDate.get(dateStr)

      days.push({
        date: dateStr,
        day,
        income: data?.income || 0,
        expenses: data?.expenses || 0,
        transactions: data?.transactions || [],
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      })
    }

    return days
  }, [currentYear, currentMonth, transactionsByDate])

  // Selected day transactions
  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null
    return calendarDays.find(d => d.date === selectedDay) || null
  }, [selectedDay, calendarDays])

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
    setSelectedDay(null)
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
    setSelectedDay(null)
  }

  const handleDayClick = (dayData: DayData) => {
    setSelectedDay(dayData.date)
    if (onDayClick) {
      onDayClick(dayData.date, dayData.transactions)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">
          {MONTHS[currentMonth]} {currentYear}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map(day => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayData, index) => {
          const hasTransactions = dayData.income > 0 || dayData.expenses > 0
          const isSelected = selectedDay === dayData.date
          const netAmount = dayData.income - dayData.expenses

          return (
            <button
              key={index}
              onClick={() => handleDayClick(dayData)}
              className={`
                relative p-1 min-h-[60px] md:min-h-[70px] rounded-lg transition-all text-left
                ${dayData.isCurrentMonth ? 'bg-gray-800' : 'bg-gray-800/30'}
                ${dayData.isToday ? 'ring-2 ring-blue-500' : ''}
                ${isSelected ? 'ring-2 ring-white' : ''}
                ${hasTransactions ? 'hover:bg-gray-700' : 'hover:bg-gray-800/50'}
              `}
            >
              {/* Day number */}
              <span className={`
                text-xs font-medium
                ${dayData.isCurrentMonth ? 'text-white' : 'text-gray-600'}
                ${dayData.isToday ? 'text-blue-400' : ''}
              `}>
                {dayData.day}
              </span>

              {/* Transaction indicators */}
              {hasTransactions && (
                <div className="mt-1 space-y-0.5">
                  {dayData.income > 0 && (
                    <div className="text-[10px] md:text-xs text-green-400 truncate">
                      +{formatMoney(dayData.income)}
                    </div>
                  )}
                  {dayData.expenses > 0 && (
                    <div className="text-[10px] md:text-xs text-red-400 truncate">
                      -{formatMoney(dayData.expenses)}
                    </div>
                  )}
                </div>
              )}

              {/* Transaction count dot */}
              {dayData.transactions.length > 0 && (
                <div className="absolute bottom-1 right-1">
                  <span className={`
                    inline-flex items-center justify-center w-4 h-4 text-[9px] font-medium rounded-full
                    ${netAmount >= 0 ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}
                  `}>
                    {dayData.transactions.length}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day details */}
      {selectedDayData && selectedDayData.transactions.length > 0 && (
        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
          <h4 className="font-medium mb-3">
            {new Date(selectedDayData.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedDayData.transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b border-gray-600 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{t.description}</p>
                  <p className="text-xs text-gray-500">{t.type}</p>
                </div>
                <span className={`text-sm font-medium ml-2 ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.amount >= 0 ? '+' : ''}{formatMoney(t.amount)}
                </span>
              </div>
            ))}
          </div>
          {/* Day summary */}
          <div className="mt-3 pt-3 border-t border-gray-600 flex justify-between text-sm">
            <span className="text-gray-400">Solde du jour</span>
            <span className={selectedDayData.income - selectedDayData.expenses >= 0 ? 'text-green-400' : 'text-red-400'}>
              {selectedDayData.income - selectedDayData.expenses >= 0 ? '+' : ''}
              {formatMoney(selectedDayData.income - selectedDayData.expenses)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
