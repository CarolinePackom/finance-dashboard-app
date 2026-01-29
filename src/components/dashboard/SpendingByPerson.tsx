import { memo, useMemo } from 'react'
import { User, Users } from 'lucide-react'
import { formatMoney, formatPercent } from '@utils/formatters'
import type { Transaction } from '@/types'

interface SpendingByPersonProps {
  transactions: Transaction[]
  householdMembers: string[]
}

interface PersonSpending {
  name: string
  amount: number
  percentage: number
  count: number
}

export const SpendingByPerson = memo(function SpendingByPerson({
  transactions,
  householdMembers,
}: SpendingByPersonProps) {
  const data = useMemo(() => {
    // Only count expenses (negative amounts)
    const expenses = transactions.filter(t => t.amount < 0)
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

    // Group by assigned person
    const byPerson = new Map<string, { amount: number; count: number }>()

    // Initialize with all household members
    for (const member of householdMembers) {
      byPerson.set(member, { amount: 0, count: 0 })
    }
    // Add "Non assigné" category
    byPerson.set('__unassigned__', { amount: 0, count: 0 })

    for (const t of expenses) {
      const person = t.assignedTo || '__unassigned__'
      const current = byPerson.get(person) || { amount: 0, count: 0 }
      byPerson.set(person, {
        amount: current.amount + Math.abs(t.amount),
        count: current.count + 1,
      })
    }

    // Convert to array and calculate percentages
    const result: PersonSpending[] = []

    for (const [name, { amount, count }] of byPerson) {
      if (amount > 0 || householdMembers.includes(name)) {
        result.push({
          name: name === '__unassigned__' ? 'Non assigné' : name,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
          count,
        })
      }
    }

    // Sort by amount descending
    return result.sort((a, b) => b.amount - a.amount)
  }, [transactions, householdMembers])

  // Calculate totals
  const totalAssigned = data
    .filter(d => d.name !== 'Non assigné')
    .reduce((sum, d) => sum + d.amount, 0)
  const totalUnassigned = data.find(d => d.name === 'Non assigné')?.amount || 0

  if (householdMembers.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {data.map((person) => {
        const isUnassigned = person.name === 'Non assigné'
        const color = isUnassigned ? '#6b7280' : '#a855f7'

        return (
          <div key={person.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isUnassigned ? (
                  <Users className="w-4 h-4 text-gray-500" />
                ) : (
                  <User className="w-4 h-4 text-purple-400" />
                )}
                <span className={isUnassigned ? 'text-gray-400' : 'text-white'}>
                  {person.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({person.count} transaction{person.count > 1 ? 's' : ''})
                </span>
              </div>
              <div className="text-right">
                <span className={`font-medium ${isUnassigned ? 'text-gray-400' : 'text-red-400'}`}>
                  {formatMoney(person.amount)}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatPercent(person.percentage)}
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${person.percentage}%`,
                  backgroundColor: color,
                  opacity: isUnassigned ? 0.5 : 1,
                }}
              />
            </div>
          </div>
        )
      })}

      {/* Summary */}
      {totalAssigned > 0 && totalUnassigned > 0 && (
        <div className="pt-2 mt-2 border-t border-gray-700 flex justify-between text-sm">
          <span className="text-gray-400">Assigné vs Non assigné</span>
          <span className="text-gray-300">
            {formatPercent((totalAssigned / (totalAssigned + totalUnassigned)) * 100)} / {formatPercent((totalUnassigned / (totalAssigned + totalUnassigned)) * 100)}
          </span>
        </div>
      )}
    </div>
  )
})
