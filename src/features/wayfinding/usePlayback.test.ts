import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePlayback } from './usePlayback'

afterEach(() => vi.restoreAllMocks())

it('limita los cambios de escena a 30 FPS sin ralentizar el recorrido', () => {
  let frame: FrameRequestCallback = () => {}
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb
    return 1
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const onFrame = vi.fn()
  const { result } = renderHook(() => usePlayback(60, onFrame, 1))
  act(() => result.current.play())
  act(() => frame(16))
  expect(onFrame).not.toHaveBeenCalled()
  act(() => frame(34))
  expect(onFrame).toHaveBeenCalledTimes(1)
  expect(result.current.tRef.current).toBeCloseTo(0.034)
  act(() => frame(50))
  expect(onFrame).toHaveBeenCalledTimes(1)
})

it('pausa al ocultar la pestaña y no reanuda sin intervención', () => {
  const { result } = renderHook(() => usePlayback(60, vi.fn()))
  act(() => result.current.play())
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(result.current.playing).toBe(false)
})
