import { memo } from 'react'
import {
  ShoppingCart,
  Utensils,
  Car,
  Gamepad2,
  CreditCard,
  Home,
  Smartphone,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  RefreshCw,
  Receipt,
  HelpCircle,
  HeartPulse,
} from 'lucide-react'

// Map des icônes par ID de catégorie
const CATEGORY_ICON_MAP: Record<string, typeof CreditCard> = {
  'food-grocery': ShoppingCart,
  'food-restaurant': Utensils,
  transport: Car,
  entertainment: Gamepad2,
  shopping: CreditCard,
  housing: Home,
  telecom: Smartphone,
  health: HeartPulse,
  'bank-fees': Receipt,
  salary: Banknote,
  'transfer-in': ArrowDownCircle,
  'transfer-out': ArrowUpCircle,
  internal: RefreshCw,
  refund: Wallet,
  other: HelpCircle,
}

interface CategoryIconProps {
  categoryId: string
  color?: string
  className?: string
}

export const CategoryIcon = memo(function CategoryIcon({
  categoryId,
  color,
  className = 'w-4 h-4',
}: CategoryIconProps) {
  const IconComponent = CATEGORY_ICON_MAP[categoryId] || CATEGORY_ICON_MAP.other

  return (
    <span style={{ color }} aria-hidden="true">
      <IconComponent className={className} />
    </span>
  )
})

export { CATEGORY_ICON_MAP }
