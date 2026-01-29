import { memo, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoney } from '@utils/formatters'
import { TOOLTIP_STYLE } from '@utils/constants'

interface PieChartData {
  id?: string // categoryId for click handling
  name: string // Display name (French)
  value: number
  color: string
}

interface ExpensesPieChartProps {
  data: PieChartData[]
  selectedCategory: string | null
  onCategoryClick: (categoryName: string) => void
}

export const ExpensesPieChart = memo(function ExpensesPieChart({
  data,
  selectedCategory,
  onCategoryClick,
}: ExpensesPieChartProps) {
  const handleClick = useCallback(
    (entry: PieChartData) => {
      // Use id (categoryId) if available, otherwise use name
      onCategoryClick(entry.id || entry.name)
    },
    [onCategoryClick]
  )

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Aucune donnée à afficher
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          onClick={handleClick}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              stroke={selectedCategory === (entry.id || entry.name) ? '#fff' : 'transparent'}
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatMoney(Number(value) || 0)}
          contentStyle={TOOLTIP_STYLE.contentStyle}
          itemStyle={TOOLTIP_STYLE.itemStyle}
          labelStyle={TOOLTIP_STYLE.labelStyle}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})
