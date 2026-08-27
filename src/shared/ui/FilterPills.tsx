interface FilterPillsProps<T extends string> {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

/**
 * Filtro de una lista, NO un tablist: no hay un panel por opción, hay una sola
 * lista que se filtra. Por eso son botones con `aria-pressed` dentro de un
 * `role="group"` y no @radix-ui/react-tabs.
 */
export function FilterPills<T extends string>({ options, value, onChange, label, className = '' }: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex gap-2 overflow-x-auto no-scrollbar ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex h-11 shrink-0 items-center rounded-full px-3.5 text-xs font-bold transition-colors active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#D41F2D] ${
            value === option.value
              ? 'bg-[#D41F2D] text-white shadow-sm'
              : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
