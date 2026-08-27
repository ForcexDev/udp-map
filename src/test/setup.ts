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

// Y `localStorage` llega sin llegar. Node 26 declara el global —`'localStorage'
// in globalThis` da true— pero vale `undefined` mientras no se arranque con
// `--localstorage-file`; y el entorno jsdom de vitest solo instala las claves
// que NO existen ya, así que ve la de Node, se la salta, y el localStorage real
// de jsdom nunca aparece. El síntoma era feo de leer: `uiStore` lee el tema
// guardado al crearse, así que cualquier test que lo importara reventaba antes
// de correr un solo caso. Un doble en memoria basta: nada depende de persistir.
if (!globalThis.localStorage) {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() { return store.size },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(String(key)) ?? null,
    setItem: (key, value) => { store.set(String(key), String(value)) },
    removeItem: (key) => { store.delete(String(key)) },
    clear: () => { store.clear() },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  })
}
