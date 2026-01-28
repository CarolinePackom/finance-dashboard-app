import { memo, type CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  animate?: boolean
  style?: CSSProperties
}

export const Skeleton = memo(function Skeleton({
  className = '',
  animate = true,
  style
}: SkeletonProps) {
  return (
    <div
      className={`bg-gray-700 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
})

// Stat Card Skeleton
export const StatCardSkeleton = memo(function StatCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-20 h-4" />
      </div>
      <Skeleton className="w-32 h-8" />
    </div>
  )
})

// Transaction Row Skeleton
export const TransactionRowSkeleton = memo(function TransactionRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="py-3 px-2">
        <Skeleton className="w-16 h-4" animate={false} />
      </td>
      <td className="py-3 px-2">
        <Skeleton className="w-48 h-4" animate={false} />
      </td>
      <td className="py-3 px-2">
        <Skeleton className="w-24 h-6 rounded-full" animate={false} />
      </td>
      <td className="py-3 px-2 text-right">
        <Skeleton className="w-20 h-4 ml-auto" animate={false} />
      </td>
    </tr>
  )
})

// Transaction List Skeleton
export const TransactionListSkeleton = memo(function TransactionListSkeleton({
  rows = 5
}: { rows?: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="w-40 h-6" />
        <div className="flex gap-2">
          <Skeleton className="w-16 h-8 rounded-lg" />
          <Skeleton className="w-20 h-8 rounded-lg" />
          <Skeleton className="w-18 h-8 rounded-lg" />
        </div>
      </div>
      <table className="w-full">
        <thead className="text-left text-gray-400 text-sm border-b border-gray-700">
          <tr>
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Description</th>
            <th className="pb-3 font-medium">Catégorie</th>
            <th className="pb-3 font-medium text-right">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {Array.from({ length: rows }).map((_, i) => (
            <TransactionRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
})

// Chart Skeleton
export const ChartSkeleton = memo(function ChartSkeleton({
  type = 'pie'
}: { type?: 'pie' | 'bar' }) {
  if (type === 'pie') {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-48 h-48 rounded-full bg-gray-700 animate-pulse relative">
          <div className="absolute inset-8 rounded-full bg-gray-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-64 flex items-end justify-around gap-2 p-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col gap-1">
          <Skeleton
            className="w-full rounded-t"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
          <Skeleton className="w-full h-3" />
        </div>
      ))}
    </div>
  )
})

// Card Skeleton
export const CardSkeleton = memo(function CardSkeleton({
  lines = 3
}: { lines?: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <Skeleton className="w-40 h-6 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="w-full h-4" />
        ))}
      </div>
    </div>
  )
})

// Dashboard Skeleton (Full page)
export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Skeleton className="w-64 h-8 mb-2" />
        <Skeleton className="w-40 h-5" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <Skeleton className="w-48 h-6 mb-4" />
          <ChartSkeleton type="pie" />
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <Skeleton className="w-48 h-6 mb-4" />
          <ChartSkeleton type="bar" />
        </div>
      </div>

      {/* Transactions */}
      <TransactionListSkeleton rows={5} />
    </div>
  )
})
