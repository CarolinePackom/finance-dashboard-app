import { useLiveQuery } from 'dexie-react-hooks'
import { transactionService } from '@services/db'

export function useAllTransactions() {
  const transactions = useLiveQuery(() => transactionService.getAll()) ?? []
  return transactions
}
