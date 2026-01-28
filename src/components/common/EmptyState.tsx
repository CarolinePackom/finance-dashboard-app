import { type ReactNode } from 'react'
import { FileQuestion, Upload, Tags, TrendingUp } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
        {icon || <FileQuestion className="w-8 h-8 text-gray-500" />}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm max-w-sm mb-6">{description}</p>
      {action && (
        <Button
          variant="primary"
          onClick={action.onClick}
          leftIcon={action.icon}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Pre-configured empty states for common scenarios
export function EmptyTransactions({ onImport }: { onImport?: () => void }) {
  return (
    <EmptyState
      icon={<TrendingUp className="w-8 h-8 text-blue-400" />}
      title="Aucune transaction"
      description="Importez votre relevé bancaire pour commencer à suivre vos finances."
      action={onImport ? {
        label: "Importer un relevé",
        onClick: onImport,
        icon: <Upload className="w-4 h-4" />
      } : undefined}
    />
  )
}

export function EmptyCategories({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Tags className="w-8 h-8 text-purple-400" />}
      title="Aucune catégorie"
      description="Créez des catégories pour organiser vos transactions."
      action={onCreate ? {
        label: "Créer une catégorie",
        onClick: onCreate,
        icon: <Tags className="w-4 h-4" />
      } : undefined}
    />
  )
}

export function EmptySearch({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={<FileQuestion className="w-8 h-8 text-gray-400" />}
      title="Aucun résultat"
      description="Aucune transaction ne correspond à vos critères de recherche."
      action={onClear ? {
        label: "Effacer les filtres",
        onClick: onClear,
      } : undefined}
    />
  )
}
