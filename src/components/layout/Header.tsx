import { memo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Upload, Settings, FileText, Tags, PiggyBank, Target } from 'lucide-react'
import { clsx } from 'clsx'
import { PeriodSelector } from '@components/common'
import type { Period } from '@/types'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/budget', label: 'Budget', icon: PiggyBank },
  { path: '/patrimoine', label: 'Patrimoine', icon: Target },
  { path: '/import', label: 'Import', icon: Upload },
  { path: '/transactions', label: 'Transactions', icon: FileText },
  { path: '/categories', label: 'Categories', icon: Tags },
  { path: '/settings', label: 'Parametres', icon: Settings },
]

interface HeaderProps {
  selectedPeriod?: Period
  months?: string[]
  onPeriodChange?: (period: Period) => void
}

export const Header = memo(function Header({
  selectedPeriod,
  months = [],
  onPeriodChange,
}: HeaderProps) {
  const location = useLocation()

  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">💵</span>
            <span className="hidden sm:inline">Road to Milli</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="w-4 h-4" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Period selector */}
          {selectedPeriod && months.length > 0 && onPeriodChange && (
            <PeriodSelector
              selectedPeriod={selectedPeriod}
              availableMonths={months}
              onPeriodChange={onPeriodChange}
            />
          )}
        </div>

        {/* Mobile navigation */}
        <nav
          className="flex md:hidden items-center gap-1 pb-2 overflow-x-auto"
          aria-label="Navigation mobile"
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
})
