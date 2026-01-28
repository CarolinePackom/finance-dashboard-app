import { type ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-gray-800 rounded-xl border border-gray-700',
        'transition-all duration-200',
        'hover:border-gray-600 hover:shadow-lg hover:shadow-black/20',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center gap-2 mb-4', className)}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  icon?: ReactNode
  className?: string
}

export function CardTitle({ children, icon, className }: CardTitleProps) {
  return (
    <h2 className={clsx('text-lg font-semibold flex items-center gap-2', className)}>
      {icon}
      {children}
    </h2>
  )
}
