import { type ReactNode } from 'react'
import { Header } from './Header'
import { useTransactions } from '@store/TransactionContext'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { selectedPeriod, months, setPeriod } = useTransactions()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
      >
        Aller au contenu principal
      </a>
      <Header
        selectedPeriod={selectedPeriod}
        months={months}
        onPeriodChange={setPeriod}
      />
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
