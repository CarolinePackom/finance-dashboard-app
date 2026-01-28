import { memo, useCallback } from 'react'
import { clsx } from 'clsx'

interface CategoryFilterButtonProps {
  name: string
  color: string
  isSelected: boolean
  onClick: (name: string) => void
}

export const CategoryFilterButton = memo(function CategoryFilterButton({
  name,
  color,
  isSelected,
  onClick,
}: CategoryFilterButtonProps) {
  const handleClick = useCallback(() => {
    onClick(name)
  }, [onClick, name])

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all',
        isSelected
          ? 'bg-white/20 ring-2 ring-white/40'
          : 'bg-gray-700 hover:bg-gray-600'
      )}
      aria-pressed={isSelected}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {name}
    </button>
  )
})
