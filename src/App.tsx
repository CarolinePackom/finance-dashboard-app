import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TransactionProvider } from '@store/TransactionContext'
import { ToastProvider, SaveReminder, ErrorBoundary } from '@components/common'
import { AppShell } from '@components/layout'
import { DashboardPage, ImportPage, TransactionsPage, CategoriesPage, SettingsPage, BudgetPage, PatrimoinePage } from '@pages/index'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <TransactionProvider>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route path="/patrimoine" element={<PatrimoinePage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppShell>
          </TransactionProvider>
          <SaveReminder />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
