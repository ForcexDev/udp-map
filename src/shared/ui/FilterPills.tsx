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
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: FilterPillsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-2 overflow-x-auto no-scrollbar ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex h-10 shrink-0 items-center rounded-2xl px-3.5 text-xs font-semibold transition-colors active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#C22B38] ${
            value === option.value
              ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
              : 'border border-[#E5DEC9] bg-white text-stone-600 hover:bg-[#FAF8F5] dark:border-white/10 dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-[#252A37]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
