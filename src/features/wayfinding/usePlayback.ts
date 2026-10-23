import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Reloj de la animación de una ruta.
//
// El tiempo exacto vive en una ref y avanza en cada frame; `onFrame` mueve la
// figura y la cámara sin pasar por React. El estado React (`t`) solo se
// refresca unas diez veces por segundo: basta para la barra y el paso actual,
// y no re-renderiza la hoja sesenta veces por segundo.
// ─────────────────────────────────────────────────────────────────────────────

export type PlaybackSpeed = 1 | 3 | 6
export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [1, 3, 6]

const UI_INTERVAL_MS = 100
/** Un salto de pestaña no debe teletransportar la figura media ruta. */
const MAX_FRAME_S = 0.25

export function usePlayback(
  duration: number,
  onFrame: (t: number, dt: number) => void,
  defaultSpeed: PlaybackSpeed = 3,
) {
  const tRef = useRef(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(defaultSpeed)
  const onFrameRef = useRef(onFrame)

  useLayoutEffect(() => {
    onFrameRef.current = onFrame
  })

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const loop = (now: number) => {
      const dt = Math.min(MAX_FRAME_S, (now - last) / 1000)
      last = now
      tRef.current = Math.min(duration, tRef.current + dt * speed)
      onFrameRef.current(tRef.current, dt)
      const done = tRef.current >= duration
      if (done || now - lastUi >= UI_INTERVAL_MS) {
        lastUi = now
        setT(tRef.current)
      }
      if (done) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, duration])

  const seek = useCallback(
    (time: number) => {
      tRef.current = Math.max(0, Math.min(duration, time))
      setT(tRef.current)
      onFrameRef.current(tRef.current, 0)
    },
    [duration],
  )

  const play = useCallback(() => {
    // Al final, reproducir vuelve a empezar.
    if (tRef.current >= duration) seek(0)
    setPlaying(true)
  }, [duration, seek])

  const pause = useCallback(() => setPlaying(false), [])

  return { t, tRef, playing, speed, setSpeed, play, pause, seek }
}
