import '@testing-library/jest-dom/vitest'

// jsdom no implementa matchMedia (usado por el tema claro/oscuro)
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom tampoco implementa ResizeObserver (lo usa MapView para avisarle al
// mapa que su contenedor cambió de tamaño). No hay layout que observar en los
// tests, así que basta con un doble que no haga nada.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
