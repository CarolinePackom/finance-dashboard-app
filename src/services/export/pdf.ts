import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Transaction, Category, MonthlyStats } from '@/types'
import { formatMoney, formatFullDate, formatMonth } from '@utils/formatters'

/**
 * Generate PDF report for a month
 */
export function generateMonthlyReport(
  month: string,
  transactions: Transaction[],
  categories: Category[],
  stats: MonthlyStats
): void {
  const doc = new jsPDF()
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  // Title
  doc.setFontSize(20)
  doc.setTextColor(31, 41, 55) // gray-800
  doc.text('Rapport Financier', 14, 22)

  doc.setFontSize(14)
  doc.setTextColor(107, 114, 128) // gray-500
  doc.text(formatMonth(month), 14, 32)

  // Summary box
  const summaryY = 42
  doc.setFillColor(249, 250, 251) // gray-50
  doc.roundedRect(14, summaryY, 182, 40, 3, 3, 'F')

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text('Revenus', 24, summaryY + 12)
  doc.text('Dépenses', 74, summaryY + 12)
  doc.text('Balance', 124, summaryY + 12)
  doc.text('Transactions', 164, summaryY + 12)

  doc.setFontSize(14)
  doc.setTextColor(34, 197, 94) // green-500
  doc.text(`+${formatMoney(stats.income)}`, 24, summaryY + 26)

  doc.setTextColor(239, 68, 68) // red-500
  doc.text(`-${formatMoney(stats.expenses)}`, 74, summaryY + 26)

  doc.setTextColor(stats.balance >= 0 ? 34 : 239, stats.balance >= 0 ? 197 : 68, stats.balance >= 0 ? 94 : 68)
  doc.text(formatMoney(stats.balance), 124, summaryY + 26)

  doc.setTextColor(139, 92, 246) // purple-500
  doc.text(String(stats.transactionCount), 174, summaryY + 26)

  // Category breakdown
  if (stats.byCategory.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(31, 41, 55)
    doc.text('Dépenses par catégorie', 14, summaryY + 52)

    autoTable(doc, {
      startY: summaryY + 56,
      head: [['Catégorie', 'Montant', '%']],
      body: stats.byCategory.slice(0, 10).map((cat) => [
        cat.name,
        formatMoney(cat.amount),
        `${cat.percentage.toFixed(1)}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
    })
  }

  // Transactions table
  const transactionsY = (doc as any).lastAutoTable?.finalY || summaryY + 80

  if (transactionsY < 250) {
    doc.setFontSize(12)
    doc.setTextColor(31, 41, 55)
    doc.text('Transactions', 14, transactionsY + 12)

    autoTable(doc, {
      startY: transactionsY + 16,
      head: [['Date', 'Description', 'Catégorie', 'Montant']],
      body: transactions.slice(0, 30).map((t) => [
        formatFullDate(t.date),
        t.description.substring(0, 40),
        categoryMap.get(t.category) || t.category,
        formatMoney(t.amount),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { halign: 'right' },
      },
      didDrawCell: (data) => {
        // Color negative amounts red
        if (data.column.index === 3 && data.section === 'body') {
          const amount = transactions[data.row.index]?.amount
          if (amount && amount < 0) {
            doc.setTextColor(239, 68, 68)
          }
        }
      },
    })
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    )
  }

  // Download
  doc.save(`rapport-${month}.pdf`)
}

/**
 * Generate a full transactions list PDF
 */
export function generateTransactionsPDF(
  transactions: Transaction[],
  categories: Category[],
  title = 'Liste des transactions'
): void {
  const doc = new jsPDF()
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  // Title
  doc.setFontSize(18)
  doc.setTextColor(31, 41, 55)
  doc.text(title, 14, 22)

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`${transactions.length} transactions`, 14, 30)

  // Table
  autoTable(doc, {
    startY: 36,
    head: [['Date', 'Description', 'Type', 'Catégorie', 'Montant']],
    body: transactions.map((t) => [
      formatFullDate(t.date),
      t.description.substring(0, 35),
      t.type,
      categoryMap.get(t.category) || t.category,
      formatMoney(t.amount),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    columnStyles: {
      4: { halign: 'right' },
    },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    )
  }

  doc.save('transactions.pdf')
}
