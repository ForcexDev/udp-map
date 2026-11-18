import { useEffect, useState } from 'react'

/**
 * Devuelve el último valor no nulo durante `ms` después de que `value` pase a
 * `null`. Sirve para que una hoja siga montada mientras anima su salida: si el
 * padre la desmonta en el mismo render, no hay nada que animar.
 */
export function useLingeringValue<T>(value: T | null, ms: number): T | null {
  const [lingering, setLingering] = useState<T | null>(value)

  useEffect(() => {
    if (value !== null) {
      setLingering(value)
      return
    }
    const timer = setTimeout(() => setLingering(null), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return value ?? lingering
}
