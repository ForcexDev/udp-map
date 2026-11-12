import { isIOSDevice, isStandaloneDisplay } from './pwa'

export const IOS_VIEWPORT_FIX_ATTR = 'data-ios-viewport-fix'
export const IOS_APP_HEIGHT_VAR = '--app-height'

export interface IosViewportSnapshot {
  ios: boolean
  standalone: boolean
  viewportWidth: number
  viewportHeight: number
  screenWidth: number
  screenHeight: number
  insetTop: number
  insetBottom: number
  visualViewportHeight?: number | null
  visualViewportScale?: number | null
}

export interface IosViewportFixState {
  height: number | null
  landscape: boolean
}

const SUBPIXEL_TOLERANCE_PX = 1
const SCREEN_MATCH_TOLERANCE_PX = 2
const INSET_SUM_TOLERANCE_PX = 4
const MAX_RESTING_SCALE = 1.02

/**
 * En PWA standalone de iOS con barra de estado traslúcida (`black-translucent`)
 * y `viewport-fit=cover`, WebKit suele iniciar el containing block fijo
 * (`inset: 0`, `100dvh`, `window.innerHeight`) restándole `safe-area-inset-top`
 * a la altura física, aunque el lienzo pinta hasta el borde inferior. Eso deja
 * la barra de navegación colgada unos ~59–62 px por encima del borde real.
 *
 * Solo devolvemos la altura completa cuando verificamos ese recorte en pantalla
 * completa y sin teclado abierto ni multitarea de iPad; en cualquier otro caso
 * devolvemos `null` para dejar actuar al `inset: 0` nativo.
 */
export function computeIosViewportFix(
  snapshot: IosViewportSnapshot,
  previous: IosViewportFixState | null = null,
): IosViewportFixState {
  if (
    !snapshot.ios ||
    !snapshot.standalone ||
    snapshot.viewportWidth <= 0 ||
    snapshot.viewportHeight <= 0 ||
    snapshot.screenWidth <= 0 ||
    snapshot.screenHeight <= 0
  ) {
    return { height: null, landscape: false }
  }

  // En iOS `window.screen.width` y `height` conservan las dimensiones en
  // vertical incluso tras rotar, así que orientamos la pantalla física según
  // el aspecto actual del viewport.
  const landscape = snapshot.viewportWidth > snapshot.viewportHeight
  const expectedScreenWidth = landscape
    ? Math.max(snapshot.screenWidth, snapshot.screenHeight)
    : Math.min(snapshot.screenWidth, snapshot.screenHeight)
  const expectedScreenHeight = landscape
    ? Math.min(snapshot.screenWidth, snapshot.screenHeight)
    : Math.max(snapshot.screenWidth, snapshot.screenHeight)

  const scale = snapshot.visualViewportScale ?? 1
  if (scale > MAX_RESTING_SCALE) {
    return { height: null, landscape }
  }

  // Si el ancho no coincide con la pantalla física (Split View, Slide Over o
  // ventana estrecha de Stage Manager en iPad), no forzamos el alto completo.
  if (Math.abs(snapshot.viewportWidth - expectedScreenWidth) > SCREEN_MATCH_TOLERANCE_PX) {
    return { height: null, landscape }
  }

  // Con el teclado en pantalla, `visualViewport.height` cae muy por debajo del
  // viewport fijo mientras la orientación no cambie. Conservamos el estado
  // previo para que `.bottom-nav` y el mapa no salten mientras se escribe.
  const visualHeight = snapshot.visualViewportHeight
  if (
    typeof visualHeight === 'number' &&
    visualHeight > 0 &&
    visualHeight < snapshot.viewportHeight - SCREEN_MATCH_TOLERANCE_PX
  ) {
    if (previous && previous.landscape === landscape) {
      return previous
    }
    return { height: null, landscape }
  }

  // Si ambos insets son 0, o la barra de estado es opaca (`default` WebClip) o
  // WebKit todavía no entrega `env(safe-area-inset-*)`; en ambos casos hay que
  // abstenerse hasta recibir medidas reales.
  const insetTop = Math.max(0, snapshot.insetTop)
  const insetBottom = Math.max(0, snapshot.insetBottom)
  if (insetTop <= 0 && insetBottom <= 0) {
    return { height: null, landscape }
  }

  const deficit = expectedScreenHeight - snapshot.viewportHeight
  const maxExpectedDeficit = insetTop + insetBottom + INSET_SUM_TOLERANCE_PX
  if (deficit > SUBPIXEL_TOLERANCE_PX && deficit <= maxExpectedDeficit) {
    return { height: Math.round(expectedScreenHeight), landscape }
  }

  return { height: null, landscape }
}

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function createProbe(name: 'icb' | 'safe-area', cssText: string): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.setAttribute('data-ios-viewport-probe', name)
  el.style.cssText = cssText
  return el
}

function applyRootState(root: HTMLElement, height: number | null): void {
  if (height !== null) {
    const heightValue = `${height}px`
    if (root.getAttribute(IOS_VIEWPORT_FIX_ATTR) !== 'true') {
      root.setAttribute(IOS_VIEWPORT_FIX_ATTR, 'true')
    }
    if (root.style.getPropertyValue(IOS_APP_HEIGHT_VAR) !== heightValue) {
      root.style.setProperty(IOS_APP_HEIGHT_VAR, heightValue)
    }
    return
  }

  if (root.hasAttribute(IOS_VIEWPORT_FIX_ATTR)) {
    root.removeAttribute(IOS_VIEWPORT_FIX_ATTR)
  }
  if (root.style.getPropertyValue(IOS_APP_HEIGHT_VAR)) {
    root.style.removeProperty(IOS_APP_HEIGHT_VAR)
  }
}

function measureSnapshot(icbProbe: HTMLElement, safeAreaProbe: HTMLElement): IosViewportSnapshot {
  const icbRect = icbProbe.getBoundingClientRect()
  const safeStyle = window.getComputedStyle(safeAreaProbe)
  const vv = window.visualViewport

  return {
    ios: isIOSDevice(),
    standalone: isStandaloneDisplay(),
    viewportWidth: icbRect.width > 0 ? icbRect.width : window.innerWidth,
    viewportHeight: icbRect.height > 0 ? icbRect.height : window.innerHeight,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    insetTop: parsePx(safeStyle.paddingTop),
    insetBottom: parsePx(safeStyle.paddingBottom),
    visualViewportHeight: vv?.height ?? null,
    visualViewportScale: vv?.scale ?? null,
  }
}

const ICB_PROBE_CSS =
  'position:fixed;top:0;right:0;bottom:0;left:0;margin:0;padding:0;border:0;pointer-events:none;visibility:hidden;z-index:-1;'

const SAFE_AREA_PROBE_CSS = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:0',
  'height:0',
  'margin:0',
  'border:0',
  'box-sizing:content-box',
  'padding-top:env(safe-area-inset-top, 0px)',
  'padding-right:env(safe-area-inset-right, 0px)',
  'padding-bottom:env(safe-area-inset-bottom, 0px)',
  'padding-left:env(safe-area-inset-left, 0px)',
  'pointer-events:none',
  'visibility:hidden',
  'z-index:-1',
].join(';')

/**
 * Sincroniza de forma síncrona el alto corregido en `:root` antes del primer
 * render de React para evitar saltos visibles al abrir la PWA en iOS.
 */
export function syncIosViewportFix(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const root = document.documentElement
  if (!isIOSDevice() || !isStandaloneDisplay()) {
    applyRootState(root, null)
    return
  }

  const icbProbe = createProbe('icb', ICB_PROBE_CSS)
  const safeAreaProbe = createProbe('safe-area', SAFE_AREA_PROBE_CSS)
  root.appendChild(icbProbe)
  root.appendChild(safeAreaProbe)
  try {
    const next = computeIosViewportFix(measureSnapshot(icbProbe, safeAreaProbe))
    applyRootState(root, next.height)
  } finally {
    icbProbe.remove()
    safeAreaProbe.remove()
  }
}

/**
 * Mantiene observadas las sondas de viewport fijo y área segura en iOS
 * standalone para activar, actualizar o retirar `--app-height` en cuanto
 * WebKit resuelva `env(safe-area-inset-*)`, rote la pantalla o recupere la ICB.
 */
export function initIosViewportFix(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const root = document.documentElement
  if (!isIOSDevice() || !isStandaloneDisplay()) {
    applyRootState(root, null)
    return () => {}
  }

  const icbProbe = createProbe('icb', ICB_PROBE_CSS)
  const safeAreaProbe = createProbe('safe-area', SAFE_AREA_PROBE_CSS)
  root.appendChild(icbProbe)
  root.appendChild(safeAreaProbe)

  let state: IosViewportFixState | null = null
  let rafId: number | null = null

  const sync = () => {
    state = computeIosViewportFix(measureSnapshot(icbProbe, safeAreaProbe), state)
    applyRootState(root, state.height)
  }

  const scheduleSync = () => {
    sync()
    if (typeof window.requestAnimationFrame === 'function') {
      if (rafId !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId)
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        sync()
      })
    }
  }

  const onVisibilityChange = () => {
    if (!document.hidden) scheduleSync()
  }

  let probeObserver: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    probeObserver = new ResizeObserver(sync)
    probeObserver.observe(icbProbe)
    probeObserver.observe(safeAreaProbe)
  }

  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', scheduleSync)
  window.addEventListener('pageshow', scheduleSync)
  window.addEventListener('focus', sync)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.visualViewport?.addEventListener('resize', sync)

  scheduleSync()

  return () => {
    if (rafId !== null && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(rafId)
    }
    probeObserver?.disconnect()
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', scheduleSync)
    window.removeEventListener('pageshow', scheduleSync)
    window.removeEventListener('focus', sync)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.visualViewport?.removeEventListener('resize', sync)
    icbProbe.remove()
    safeAreaProbe.remove()
    applyRootState(root, null)
  }
}
