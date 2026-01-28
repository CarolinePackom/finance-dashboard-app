import { lazy, Suspense, type ComponentProps } from 'react'
import { ChartSkeleton } from '@components/common'

// Lazy load heavy chart components
const ExpensesPieChartLazy = lazy(() =>
  import('./ExpensesPieChart').then((m) => ({ default: m.ExpensesPieChart }))
)

const DailyBarChartLazy = lazy(() =>
  import('./DailyBarChart').then((m) => ({ default: m.DailyBarChart }))
)

const MonthlyComparisonChartLazy = lazy(() =>
  import('./MonthlyComparisonChart').then((m) => ({ default: m.MonthlyComparisonChart }))
)

// Wrapped components with Suspense
type PieChartProps = ComponentProps<typeof ExpensesPieChartLazy>
type BarChartProps = ComponentProps<typeof DailyBarChartLazy>
type ComparisonChartProps = ComponentProps<typeof MonthlyComparisonChartLazy>

export function LazyExpensesPieChart(props: PieChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton type="pie" />}>
      <ExpensesPieChartLazy {...props} />
    </Suspense>
  )
}

export function LazyDailyBarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton type="bar" />}>
      <DailyBarChartLazy {...props} />
    </Suspense>
  )
}

export function LazyMonthlyComparisonChart(props: ComparisonChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton type="bar" />}>
      <MonthlyComparisonChartLazy {...props} />
    </Suspense>
  )
}
