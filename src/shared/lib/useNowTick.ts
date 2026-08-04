import { useEffect, useState } from 'react'

/**
 * Reloj compartido para lo que depende de "ahora" sin que nadie lo provoque:
 * un evento que empieza, un pin que entra en su última hora. Sin esto el mapa
 * solo recalculaba el estado cuando cambiaba la lista de pines, así que un
 * evento podía llevar media hora en curso sin que se notara.
 *
 * El intervalo se limpia al desmontar y se pausa mientras la pestaña está
 * oculta: no tiene sentido despertar el render de un mapa que nadie mira.
 */
export function useNowTick(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer !== null) return
      timer = setInterval(() => setNow(Date.now()), intervalMs)
    }
    const stop = () => {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        // Al volver puede haber pasado mucho: refrescar antes de reanudar.
        setNow(Date.now())
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
