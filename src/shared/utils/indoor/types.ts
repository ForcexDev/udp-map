// ─────────────────────────────────────────────────────────────────────────────
// Tipos de la navegación interior.
//
// Toda la lógica de `shared/utils/indoor` trabaja en METROS sobre un plano local
// (x = este, y = SUR) y no sabe nada de React ni de MapLibre. Las coordenadas
// lng/lat solo aparecen al cargar desde la base y al pintar: así ángulos, lados
// y distancias se calculan exactos y se prueban sin mapa. La convención de ejes
// está explicada en `projection.ts`; cambiarla invierte izquierda y derecha.
// ─────────────────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number
  y: number
}

export type NavNodeKind = 'walk' | 'door' | 'room' | 'stairs' | 'elevator' | 'entrance' | 'outdoor'
export type NavEdgeKind = 'walk' | 'stairs' | 'elevator'

/** Un punto donde la persona puede estar o decidir, ya proyectado a metros. */
export interface NavNode {
  id: string
  kind: NavNodeKind
  p: Vec2
  /** null ⇔ `floor` null: es un punto exterior. */
  buildingId: string | null
  floor: number | null
  /** Lo que se ve en este punto ("los torniquetes"). Lleva su artículo. */
  landmark: string | null
  /** Solo exterior: por dónde se camina hasta aquí ("la vereda de Vergara"). */
  via: string | null
  areaId: string | null
  roomCode: string | null
  /** Núcleo vertical ("ESC-A") que agrupa escalera o ascensor entre plantas. */
  shaft: string | null
  widthM: number | null
  /**
   * Nombre visible de una sala ("Sala 413"), sin artículo. La base no lo
   * guarda: lo resuelve quien carga el grafo (área, pin o código).
   */
  name: string | null
  /** Baño o servicio: cuenta como puerta, pero no se nombra al pasar. */
  service: boolean
}

export interface NavEdge {
  id: string
  a: string
  b: string
  kind: NavEdgeKind
  /** false = no apta para silla de ruedas. Una escalera nunca lo es. */
  stepFree: boolean
}

/** Área de una planta en metros locales: lo que pinta la vista explotada. */
export interface IndoorArea {
  id: string
  buildingId: string | null
  floor: number | null
  /** Tipo de `areas.kind`; decide color y si lleva muros. */
  kind: string
  name: string
  ring: Vec2[]
}

export interface Route {
  /** Ids de los nodos en orden. */
  nodes: string[]
  /** `kinds[i]` es el tipo de la arista entre `nodes[i]` y `nodes[i + 1]`. */
  kinds: NavEdgeKind[]
  seconds: number
  /** Solo los tramos a pie: subir una escalera no suma metros de planta. */
  meters: number
}

export type Side = 'left' | 'right'

export type StepIcon =
  | 'depart'
  | 'straight'
  | 'slight-left'
  | 'slight-right'
  | 'left'
  | 'right'
  | 'uturn'
  | 'stairs-up'
  | 'stairs-down'
  | 'elevator'
  | 'arrive'

export type StepKind = 'depart' | 'turn' | 'vertical' | 'arrive' | 'end'

/** Un paso ya redactado, listo para la interfaz. */
export interface Step {
  kind: StepKind
  icon: StepIcon
  text: string
  detail?: string
  meters: number
  /** Planta donde empieza el paso; null = exterior. */
  level: number | null
  /** Índices en `route.nodes`: sincronizan el paso con la animación. */
  from: number
  to: number
}

/**
 * Traductor con la firma de i18next: `t('clave', 'respaldo', { vars })`.
 * La lógica pura lo recibe para no depender de React ni del idioma activo.
 */
export type Translate = (key: string, fallback: string, vars?: Record<string, string | number>) => string
