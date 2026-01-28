import { memo } from 'react'

interface LoadingOverlayProps {
  message?: string
  fullScreen?: boolean
}

export const LoadingOverlay = memo(function LoadingOverlay({
  message = 'Chargement...',
  fullScreen = false
}: LoadingOverlayProps) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0 z-10'

  return (
    <div
      className={`${containerClasses} bg-gray-900/80 backdrop-blur-sm flex items-center justify-center`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Outer ring */}
          <div className="w-12 h-12 rounded-full border-4 border-gray-700" />
          {/* Spinning ring */}
          <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
        </div>
        <p className="text-gray-300 text-sm font-medium">{message}</p>
      </div>
    </div>
  )
})

// Simple inline spinner
export const Spinner = memo(function Spinner({
  size = 'md',
  className = ''
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-gray-600 border-t-blue-500 animate-spin ${className}`}
      role="status"
      aria-label="Chargement"
    />
  )
})
