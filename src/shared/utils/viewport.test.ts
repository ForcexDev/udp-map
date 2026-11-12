import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IOS_APP_HEIGHT_VAR,
  IOS_VIEWPORT_FIX_ATTR,
  computeIosViewportFix,
  initIosViewportFix,
  syncIosViewportFix,
  type IosViewportSnapshot,
} from './viewport'

function makeSnapshot(overrides: Partial<IosViewportSnapshot> = {}): IosViewportSnapshot {
  return {
    ios: true,
    standalone: true,
    viewportWidth: 393,
    viewportHeight: 793,
    screenWidth: 393,
    screenHeight: 852,
    insetTop: 59,
    insetBottom: 34,
    visualViewportHeight: 793,
    visualViewportScale: 1,
    ...overrides,
  }
}

describe('computeIosViewportFix', () => {
  it('devuelve height=null fuera de iOS o fuera de modo standalone', () => {
    expect(computeIosViewportFix(makeSnapshot({ ios: false }))).toEqual({
      height: null,
      landscape: false,
    })
    expect(computeIosViewportFix(makeSnapshot({ standalone: false }))).toEqual({
      height: null,
      landscape: false,
    })
  })

  it('corrige a screenHeight en iPhone 15/16 vertical cuando falta safe-area-inset-top', () => {
    expect(computeIosViewportFix(makeSnapshot())).toEqual({
      height: 852,
      landscape: false,
    })
  })

  it('corrige en iPhone 16 Pro vertical (402x874, insetTop=62) y en iPhone con botón físico (insetTop=20)', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 402,
          viewportHeight: 812,
          screenWidth: 402,
          screenHeight: 874,
          insetTop: 62,
          insetBottom: 34,
          visualViewportHeight: 812,
        }),
      ),
    ).toEqual({ height: 874, landscape: false })

    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 375,
          viewportHeight: 647,
          screenWidth: 375,
          screenHeight: 667,
          insetTop: 20,
          insetBottom: 0,
          visualViewportHeight: 647,
        }),
      ),
    ).toEqual({ height: 667, landscape: false })
  })

  it('también cubre el caso en que WebKit descuente safeAreaTop + safeAreaBottom', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportHeight: 759,
          insetTop: 59,
          insetBottom: 34,
        }),
      ),
    ).toEqual({ height: 852, landscape: false })
  })

  it('devuelve null cuando WebKit ya cubre la altura física completa (sin recorte)', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportHeight: 852,
          visualViewportHeight: 852,
        }),
      ),
    ).toEqual({ height: null, landscape: false })

    // Tolerancia de subpíxel (<= 1 px)
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportHeight: 851.5,
          visualViewportHeight: 852,
        }),
      ),
    ).toEqual({ height: null, landscape: false })
  })

  it('devuelve null si ambos safe-area insets son 0 (barra opaca o env aún sin resolver)', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          insetTop: 0,
          insetBottom: 0,
        }),
      ),
    ).toEqual({ height: null, landscape: false })
  })

  it('no interviene si el déficit supera los safe-area insets (ej. barra de estado opaca de 59 px)', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportHeight: 793,
          insetTop: 0,
          insetBottom: 34,
        }),
      ),
    ).toEqual({ height: null, landscape: false })
  })

  it('orienta correctamente en horizontal aunque screen siga en retrato en iOS', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 852,
          viewportHeight: 372,
          screenWidth: 393,
          screenHeight: 852,
          insetTop: 0,
          insetBottom: 21,
          visualViewportHeight: 372,
        }),
      ),
    ).toEqual({ height: 393, landscape: true })

    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 852,
          viewportHeight: 393,
          screenWidth: 393,
          screenHeight: 852,
          insetTop: 0,
          insetBottom: 21,
          visualViewportHeight: 393,
        }),
      ),
    ).toEqual({ height: null, landscape: true })
  })

  it('respeta Split View, Slide Over y Stage Manager en iPad sin estirar la ventana', () => {
    // Split View estrecho en iPad Pro 11" (834x1194)
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 417,
          viewportHeight: 1170,
          screenWidth: 834,
          screenHeight: 1194,
          insetTop: 24,
          insetBottom: 20,
          visualViewportHeight: 1170,
        }),
      ),
    ).toEqual({ height: null, landscape: false })

    // Stage Manager con dock (altura recortada más allá de los insets)
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 834,
          viewportHeight: 1090,
          screenWidth: 834,
          screenHeight: 1194,
          insetTop: 24,
          insetBottom: 20,
          visualViewportHeight: 1090,
        }),
      ),
    ).toEqual({ height: null, landscape: false })
  })

  it('conserva la altura activa mientras el teclado en pantalla reduce visualViewport en la misma orientación', () => {
    const active = { height: 852, landscape: false }
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportHeight: 793,
          visualViewportHeight: 470,
        }),
        active,
      ),
    ).toEqual(active)

    // Si rota a horizontal, descarta el valor de retrato aunque visualViewport esté reducido
    expect(
      computeIosViewportFix(
        makeSnapshot({
          viewportWidth: 852,
          viewportHeight: 372,
          insetTop: 0,
          insetBottom: 21,
          visualViewportHeight: 200,
        }),
        active,
      ),
    ).toEqual({ height: null, landscape: true })
  })

  it('ignora viewports con zoom activo', () => {
    expect(
      computeIosViewportFix(
        makeSnapshot({
          visualViewportScale: 1.5,
        }),
      ),
    ).toEqual({ height: null, landscape: false })
  })
})

describe('initIosViewportFix y syncIosViewportFix en el DOM', () => {
  const originalNavigator = window.navigator
  const originalMatchMedia = window.matchMedia
  const originalScreen = window.screen
  const originalResizeObserver = globalThis.ResizeObserver
  const originalGetComputedStyle = window.getComputedStyle
  const originalVisualViewport = window.visualViewport

  let observerCallbacks: Array<() => void> = []
  let mockIcbHeight = 793
  let mockIcbWidth = 393
  let mockInsetTop = 59
  let mockInsetBottom = 34
  let mockVvHeight = 793
  const vvListeners = new Map<string, Set<() => void>>()

  function mockIosStandaloneEnv(opts: { ios?: boolean; standalone?: boolean } = {}) {
    const ios = opts.ios ?? true
    const standalone = opts.standalone ?? true

    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: {
        userAgent: ios
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15'
          : 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0',
        platform: ios ? 'iPhone' : 'Linux x86_64',
        maxTouchPoints: ios ? 5 : 0,
        standalone,
      },
    })

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' ? standalone : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
  }

  beforeEach(() => {
    observerCallbacks = []
    mockIcbHeight = 793
    mockIcbWidth = 393
    mockInsetTop = 59
    mockInsetBottom = 34
    mockVvHeight = 793
    vvListeners.clear()

    Object.defineProperty(window, 'screen', {
      configurable: true,
      value: { width: 393, height: 852 },
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 393,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 793,
    })

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        get height() {
          return mockVvHeight
        },
        scale: 1,
        addEventListener: (name: string, fn: () => void) => {
          if (!vvListeners.has(name)) vvListeners.set(name, new Set())
          vvListeners.get(name)!.add(fn)
        },
        removeEventListener: (name: string, fn: () => void) => {
          vvListeners.get(name)?.delete(fn)
        },
      },
    })

    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        observerCallbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver

    window.getComputedStyle = vi.fn().mockImplementation((el: Element) => {
      if (el.getAttribute('data-ios-viewport-probe') === 'safe-area') {
        return {
          paddingTop: `${mockInsetTop}px`,
          paddingBottom: `${mockInsetBottom}px`,
        } as CSSStyleDeclaration
      }
      return originalGetComputedStyle(el)
    })

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.getAttribute('data-ios-viewport-probe') === 'icb') {
        return {
          width: mockIcbWidth,
          height: mockIcbHeight,
          top: 0,
          left: 0,
          right: mockIcbWidth,
          bottom: mockIcbHeight,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect
      }
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute(IOS_VIEWPORT_FIX_ATTR)
    document.documentElement.style.removeProperty(IOS_APP_HEIGHT_VAR)
    Object.defineProperty(window, 'navigator', { configurable: true, value: originalNavigator })
    window.matchMedia = originalMatchMedia
    Object.defineProperty(window, 'screen', { configurable: true, value: originalScreen })
    globalThis.ResizeObserver = originalResizeObserver
    window.getComputedStyle = originalGetComputedStyle
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport,
    })
  })

  it('no modifica el DOM fuera de iOS standalone y limpia sondas en desktop/Safari normal', () => {
    mockIosStandaloneEnv({ ios: false, standalone: true })
    const beforeChildren = document.documentElement.children.length
    const stopDesktop = initIosViewportFix()
    expect(document.documentElement.hasAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe(false)
    expect(document.documentElement.style.getPropertyValue(IOS_APP_HEIGHT_VAR)).toBe('')
    expect(document.documentElement.children.length).toBe(beforeChildren)
    stopDesktop()

    mockIosStandaloneEnv({ ios: true, standalone: false })
    syncIosViewportFix()
    expect(document.documentElement.hasAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe(false)
  })

  it('aplica --app-height síncronamente y reacciona cuando env(safe-area-inset-*) o la ICB cambian', () => {
    mockIosStandaloneEnv({ ios: true, standalone: true })
    const initialChildren = document.documentElement.children.length

    syncIosViewportFix()
    expect(document.documentElement.getAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe('true')
    expect(document.documentElement.style.getPropertyValue(IOS_APP_HEIGHT_VAR)).toBe('852px')
    expect(document.documentElement.children.length).toBe(initialChildren)

    // Simula arranque donde safe-area empieza en 0 y llega después vía ResizeObserver
    mockInsetTop = 0
    mockInsetBottom = 0
    const dispose = initIosViewportFix()
    expect(document.documentElement.hasAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe(false)

    mockInsetTop = 59
    mockInsetBottom = 34
    observerCallbacks.forEach((cb) => cb())
    expect(document.documentElement.getAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe('true')
    expect(document.documentElement.style.getPropertyValue(IOS_APP_HEIGHT_VAR)).toBe('852px')

    // Con teclado abierto, visualViewport baja a 470 pero se conserva 852px
    mockVvHeight = 470
    vvListeners.get('resize')?.forEach((fn) => fn())
    expect(document.documentElement.getAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe('true')
    expect(document.documentElement.style.getPropertyValue(IOS_APP_HEIGHT_VAR)).toBe('852px')

    // Al cerrar teclado y si WebKit recupera la ICB completa, retira el parche
    mockVvHeight = 852
    mockIcbHeight = 852
    vvListeners.get('resize')?.forEach((fn) => fn())
    expect(document.documentElement.hasAttribute(IOS_VIEWPORT_FIX_ATTR)).toBe(false)
    expect(document.documentElement.style.getPropertyValue(IOS_APP_HEIGHT_VAR)).toBe('')

    dispose()
    expect(document.documentElement.children.length).toBe(initialChildren)
  })
})
