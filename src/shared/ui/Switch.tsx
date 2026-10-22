// El interruptor de la aplicación. Había tres escritos a mano (preferencias de
// avisos, hilo oficial del foro, pin oficial), cada uno con su foco y su color,
// y el del pin sin nombre accesible.

// Clases literales, no interpoladas: Tailwind 4 solo genera las que ve escritas.
const TONES = {
  red: 'bg-[#C22B38] dark:bg-[#D93846] focus-visible:ring-[#C22B38]',
  blue: 'bg-blue-600 focus-visible:ring-blue-500',
  sky: 'bg-sky-600 focus-visible:ring-sky-500',
} as const

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
  tone = 'red',
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Sin `label` hace falta un `<label htmlFor={id}>` fuera. */
  label?: string
  id?: string
  disabled?: boolean
  tone?: keyof typeof TONES
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? TONES[tone] : 'bg-stone-300 dark:bg-stone-600'
      } ${disabled ? '' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
