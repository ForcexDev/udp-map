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
    <div role="group" aria-label={label} className={`flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#D41F2D] ${
            value === option.value
              ? 'bg-[#D41F2D] text-white shadow-sm'
              : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
