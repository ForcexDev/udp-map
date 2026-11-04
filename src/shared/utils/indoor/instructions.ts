import type { NavGraph } from './graph'
import {
  cardinalOf,
  dist,
  length,
  levelIndex,
  sub,
  turnAngle,
  floorSpan,
  type Cardinal,
} from './projection'
import type { Route, Side, Step, StepIcon, StepKind, Translate, Vec2 } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// De una ruta a pasos que se leen.
//
// La GEOMETRÍA decide la maniobra ("gira a la derecha" sale del ángulo entre
// tramos) y el GRAFO pone las referencias ("pasando la Sala 412" sale de qué
// puertas cuelgan del punto por el que pasas). Dentro de un edificio no hay
// nombres de calle: orientan las cosas que se ven.
//
// Se hace en dos pasadas. `planSteps` decide QUÉ decir sin idioma, y
// `renderSteps` lo redacta con `t`. La microdirección reutiliza la primera sin
// pasar por textos: necesita el lado del primer giro y el ordinal de la puerta,
// no una frase que luego habría que volver a desarmar.
// ─────────────────────────────────────────────────────────────────────────────

/** Por debajo de este giro se sigue derecho y no hay paso nuevo. */
const STRAIGHT_DEG = 30
/** Una puerta "se pasa" si queda a un lado; de frente o detrás no cuenta. */
const SIDE_MIN_DEG = 45
const SIDE_MAX_DEG = 135
/** Dos giros a menos de esto se dicen juntos: "…y enseguida a la derecha". */
const QUICK_TURN_M = 3
/** Un tramo más corto que esto no merece "Avanza 0 m". */
const MIN_WALK_M = 0.4

export type TurnKind = 'straight' | 'slight' | 'turn' | 'uturn'

export interface Turn {
  kind: TurnKind
  side: Side
}

export function classifyTurn(angle: number): Turn {
  const a = Math.abs(angle)
  const side: Side = angle > 0 ? 'right' : 'left'
  if (a < STRAIGHT_DEG) return { kind: 'straight', side }
  if (a < 60) return { kind: 'slight', side }
  if (a < 150) return { kind: 'turn', side }
  return { kind: 'uturn', side }
}

function turnIcon(turn: Turn): StepIcon {
  if (turn.kind === 'straight') return 'straight'
  if (turn.kind === 'slight') return turn.side === 'left' ? 'slight-left' : 'slight-right'
  if (turn.kind === 'uturn') return 'uturn'
  return turn.side
}

/** Lo que se va a decir en un paso, todavía sin idioma. */
export interface PlannedStep {
  kind: StepKind
  icon: StepIcon
  from: number
  to: number
  meters: number
  level: number | null
  crosses: string[]
  passes: { name: string; side: Side }[]
  depart?: {
    mode: 'outdoor' | 'indoor' | 'stairs' | 'elevator'
    landmark: string | null
    via: string | null
    dir: Cardinal
    level: number | null
  }
  turn?: Turn
  /** Segundo giro dicho junto con el primero. */
  then?: Turn
  /** "hacia la escalera principal": el núcleo que está justo delante. */
  target?: string | null
  /** "en el lobby": dónde se gira. */
  place?: string | null
  /** Dónde se da el segundo giro de un par dicho junto. */
  thenPlace?: string | null
  vertical?: {
    kind: 'stairs' | 'elevator'
    up: boolean
    floors: number
    toLevel: number
    core: string | null
  }
  arrive?: {
    name: string
    side: Side | 'ahead'
    /** Puertas de ese lado desde el último giro, contando la de destino. */
    ordinal: number
    code: string | null
  }
  end?: { name: string | null }
}

export interface PlanOptions {
  /** Cómo se llama el destino cuando no es una sala ("Impresora del piso 2"). */
  targetName?: string | null
}

interface Segment {
  kind: Route['kinds'][number]
  s: number
  e: number
}

/** Tramos consecutivos del mismo tipo: a pie, escalera o ascensor. */
function segmentsOf(route: Route): Segment[] {
  const segments: Segment[] = []
  route.kinds.forEach((kind, i) => {
    const last = segments[segments.length - 1]
    if (last && last.kind === kind) last.e = i + 1
    else segments.push({ kind, s: i, e: i + 1 })
  })
  return segments
}

function emptyStep(
  kind: StepKind,
  icon: StepIcon,
  from: number,
  level: number | null,
): PlannedStep {
  return { kind, icon, from, to: from, meters: 0, level, crosses: [], passes: [] }
}

export function planSteps(route: Route, graph: NavGraph, options: PlanOptions = {}): PlannedStep[] {
  const node = (i: number) => graph.node(route.nodes[i])
  const last = node(route.nodes.length - 1)
  const endName = options.targetName ?? last.name ?? last.landmark ?? null

  if (route.nodes.length < 2) {
    const step = emptyStep('end', 'arrive', 0, last.floor)
    step.end = { name: endName }
    return [step]
  }

  const steps: PlannedStep[] = []
  const segments = segmentsOf(route)
  let lastVertical: 'stairs' | 'elevator' | null = null
  let arrived = false

  segments.forEach((seg, si) => {
    if (arrived) return
    const start = node(seg.s)

    if (seg.kind !== 'walk') {
      const end = node(seg.e)
      const fa = start.floor ?? 1
      const fb = end.floor ?? 1
      const up = levelIndex(fb) > levelIndex(fa)
      const icon: StepIcon = seg.kind === 'elevator' ? 'elevator' : up ? 'stairs-up' : 'stairs-down'
      const step = emptyStep('vertical', icon, seg.s, start.floor)
      step.to = seg.e
      // El nombre del núcleo puede estar en el descanso o en su puerta.
      const before = seg.s > 0 ? node(seg.s - 1) : null
      step.vertical = {
        kind: seg.kind,
        up,
        floors: floorSpan(fa, fb),
        toLevel: fb,
        core: start.landmark ?? (before?.kind === 'door' ? before.landmark : null),
      }
      steps.push(step)
      lastVertical = seg.kind
      return
    }

    const isLastSegment = si === segments.length - 1
    const firstNext = node(seg.s + 1)
    let current = emptyStep('depart', 'depart', seg.s, start.floor)
    current.depart = {
      mode: lastVertical ?? (si === 0 && start.buildingId === null ? 'outdoor' : 'indoor'),
      landmark: start.landmark,
      via: firstNext.via ?? start.via,
      dir: cardinalOf(sub(firstNext.p, start.p)),
      level: start.floor,
    }

    let sideDoors = { left: 0, right: 0 }
    let heading: Vec2 = sub(firstNext.p, start.p)

    const close = (to: number) => {
      current.to = to
      steps.push(current)
    }

    for (let k = seg.s + 1; k <= seg.e; k++) {
      const here = node(k)
      const prev = node(k - 1)
      current.meters += dist(prev.p, here.p)
      const step = sub(here.p, prev.p)
      // Un tramo de largo cero (dos nodos encimados) no cambia el rumbo.
      if (length(step) > 1e-6) heading = step
      if (k === seg.e) {
        close(k)
        break
      }

      const next = node(k + 1)
      for (const { door, room, core } of graph.doorsAt(here.id)) {
        if (door.id === next.id || door.id === prev.id) continue
        const rel = turnAngle(heading, sub(door.p, here.p))
        const a = Math.abs(rel)
        if (a < SIDE_MIN_DEG || a > SIDE_MAX_DEG) continue
        const side: Side = rel > 0 ? 'right' : 'left'
        sideDoors[side] += 1
        if (!core && room?.name && !room.service) current.passes.push({ name: room.name, side })
      }

      if (
        (here.kind === 'door' || here.kind === 'entrance') &&
        here.landmark &&
        !graph.isCoreDoor(here.id)
      ) {
        current.crosses.push(here.landmark)
      }

      const out = sub(next.p, here.p)
      const angle = length(out) < 1e-6 ? 0 : turnAngle(heading, out)
      const remaining = seg.e - k
      const goal = node(seg.e)

      // Llegar no es girar: "La Sala 413 está a tu izquierda" es la frase más
      // útil de toda la ruta, y el ordinal de la puerta la remata.
      if (isLastSegment && remaining === 2 && next.kind === 'door' && goal.kind === 'room') {
        close(k)
        const turn = classifyTurn(angle)
        const side: Side | 'ahead' = Math.abs(angle) < SIDE_MIN_DEG ? 'ahead' : turn.side
        const arrive = emptyStep('arrive', 'arrive', k, here.floor)
        arrive.to = seg.e
        arrive.meters = dist(here.p, next.p) + dist(next.p, goal.p)
        arrive.arrive = {
          name: goal.name ?? endName ?? goal.roomCode ?? '',
          side,
          ordinal: side === 'ahead' ? 0 : sideDoors[side] + 1,
          code: goal.roomCode,
        }
        steps.push(arrive)
        arrived = true
        return
      }

      const turn = classifyTurn(angle)
      if (turn.kind === 'straight') continue

      close(k)
      current = emptyStep('turn', turnIcon(turn), k, here.floor)
      current.turn = turn
      if (remaining <= 2 && graph.isCoreDoor(next.id)) {
        current.target = next.landmark ?? node(k + 2 <= seg.e ? k + 2 : k + 1).landmark
      } else if (here.landmark) {
        current.place = here.landmark
      }
      sideDoors = { left: 0, right: 0 }
    }

    if (isLastSegment && !arrived) {
      const end = emptyStep('end', 'arrive', seg.e, node(seg.e).floor)
      end.to = seg.e
      end.end = { name: endName }
      steps.push(end)
    }
  })

  if (!arrived && segments[segments.length - 1].kind !== 'walk') {
    const end = emptyStep('end', 'arrive', route.nodes.length - 1, last.floor)
    end.to = route.nodes.length - 1
    end.end = { name: endName }
    steps.push(end)
  }

  return mergeQuickTurns(steps)
}

/** "Gira a la izquierda y enseguida a la derecha": dos giros casi seguidos. */
function mergeQuickTurns(steps: PlannedStep[]): PlannedStep[] {
  const merged: PlannedStep[] = []
  for (let i = 0; i < steps.length; i++) {
    const a = steps[i]
    const b = steps[i + 1]
    if (a.kind === 'turn' && b?.kind === 'turn' && !a.then && a.meters < QUICK_TURN_M) {
      merged.push({
        ...a,
        to: b.to,
        meters: a.meters + b.meters,
        crosses: [...a.crosses, ...b.crosses],
        passes: [...a.passes, ...b.passes],
        then: b.turn,
        target: b.target,
        // El lugar del primero se conserva: "en el lobby y enseguida…".
        place: a.place,
        thenPlace: b.place,
      })
      i += 1
    } else {
      merged.push(a)
    }
  }
  return merged
}

// ── Redacción ───────────────────────────────────────────────────────────────

/** Traductor que solo interpola el respaldo. Para pruebas y usos sin i18next. */
export const fallbackTranslate: Translate = (_key, fallback, vars) =>
  fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars?.[name] ?? ''))

const CARDINAL_ES: Record<Cardinal, string> = {
  n: 'norte',
  ne: 'noreste',
  e: 'este',
  se: 'sureste',
  s: 'sur',
  sw: 'suroeste',
  w: 'oeste',
  nw: 'noroeste',
}

export function cardinalWord(c: Cardinal, t: Translate): string {
  return t(`wayfinder.dir.${c}`, CARDINAL_ES[c])
}

export function sideWord(side: Side, t: Translate): string {
  return side === 'left'
    ? t('wayfinder.indoor.left', 'izquierda')
    : t('wayfinder.indoor.right', 'derecha')
}

/**
 * Artículo de un nombre de sala. Los landmarks traen el suyo desde la base; los
 * nombres de sala no, porque también se usan sin él ("Sala 413 está…").
 * La regla del sustantivo inicial acierta con lo que hay en el campus (Sala,
 * Secretaría, Auditorio, Laboratorio); "aula" y "área" llevan "el" por fonética.
 */
export function isFeminine(name: string): boolean {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (first === 'aula' || first === 'área' || first === 'area') return false
  return /(a|ión|dad|tad)$/.test(first)
}

function articleFor(name: string, t: Translate): string {
  return isFeminine(name)
    ? t('wayfinder.indoor.articleF', 'la')
    : t('wayfinder.indoor.articleM', 'el')
}

function joinList(items: string[], t: Translate): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} ${t('wayfinder.indoor.and', 'y')} ${items[items.length - 1]}`
}

function verbPhrase(turn: Turn, t: Translate): string {
  const side = sideWord(turn.side, t)
  switch (turn.kind) {
    case 'straight':
      return t('wayfinder.indoor.straight', 'Sigue derecho')
    case 'slight':
      return t('wayfinder.indoor.slight', 'Gira levemente a la {{side}}', { side })
    case 'uturn':
      return t('wayfinder.indoor.uturn', 'Da media vuelta')
    default:
      return t('wayfinder.indoor.turn', 'Gira a la {{side}}', { side })
  }
}

/** La forma que sigue a "y enseguida…" o a "Saliendo de la escalera,". */
export function turnContinuation(turn: Turn, t: Translate): string {
  const side = sideWord(turn.side, t)
  switch (turn.kind) {
    case 'straight':
      return t('wayfinder.indoor.thenStraight', 'sigue derecho')
    case 'slight':
      return t('wayfinder.indoor.thenSlight', 'levemente a la {{side}}', { side })
    case 'uturn':
      return t('wayfinder.indoor.thenUturn', 'da media vuelta')
    default:
      return t('wayfinder.indoor.thenTurn', 'a la {{side}}', { side })
  }
}

export function floorRef(level: number, t: Translate): string {
  return level < 0
    ? t('wayfinder.indoor.floorRefBasement', 'el subterráneo {{n}}', { n: -level })
    : t('wayfinder.indoor.floorRef', 'el piso {{n}}', { n: level })
}

function withTarget(
  verb: string,
  target: string | null | undefined,
  place: string | null | undefined,
  t: Translate,
) {
  if (target) return t('wayfinder.indoor.toward', '{{verb}} hacia {{target}}', { verb, target })
  if (place) return t('wayfinder.indoor.at', '{{verb}} en {{place}}', { verb, place })
  return verb
}

function walkDetail(step: PlannedStep, t: Translate): string | undefined {
  if (step.meters <= MIN_WALK_M) return undefined
  let detail = t('wayfinder.indoor.walk', 'Avanza {{meters}} m', {
    meters: Math.round(step.meters),
  })
  if (step.crosses.length > 0) {
    detail += t('wayfinder.indoor.crossing', ', cruzando {{list}}', {
      list: joinList(step.crosses, t),
    })
  }
  if (step.passes.length > 0) {
    const list = joinList(
      step.passes.map(({ name, side }) =>
        t('wayfinder.indoor.passItem', '{{article}} {{name}} (a tu {{side}})', {
          article: articleFor(name, t),
          name,
          side: sideWord(side, t),
        }),
      ),
      t,
    )
    detail +=
      step.crosses.length > 0
        ? t('wayfinder.indoor.andPassing', ', y pasando {{list}}', { list })
        : t('wayfinder.indoor.passing', ', pasando {{list}}', { list })
  }
  return detail
}

function departText(step: PlannedStep, t: Translate): string {
  const d = step.depart!
  if (d.mode === 'stairs') {
    return t('wayfinder.indoor.exitStairs', 'Sal de la escalera en {{floor}}', {
      floor: floorRef(d.level ?? 1, t),
    })
  }
  if (d.mode === 'elevator') {
    return t('wayfinder.indoor.exitElevator', 'Sal del ascensor en {{floor}}', {
      floor: floorRef(d.level ?? 1, t),
    })
  }
  if (d.mode === 'outdoor') {
    const dir = cardinalWord(d.dir, t)
    if (!d.landmark) return t('wayfinder.indoor.departWalk', 'Camina hacia el {{dir}}', { dir })
    return d.via
      ? t(
          'wayfinder.indoor.departOutdoorVia',
          'Desde {{from}}, camina hacia el {{dir}} por {{via}}',
          {
            from: d.landmark,
            dir,
            via: d.via,
          },
        )
      : t('wayfinder.indoor.departOutdoor', 'Desde {{from}}, camina hacia el {{dir}}', {
          from: d.landmark,
          dir,
        })
  }
  return d.landmark
    ? t('wayfinder.indoor.departIndoor', 'Sal desde {{from}}', { from: d.landmark })
    : t('wayfinder.indoor.departStart', 'Empieza a caminar')
}

function verticalText(step: PlannedStep, t: Translate): { text: string; detail: string } {
  const v = step.vertical!
  if (v.kind === 'elevator') {
    const core = v.core ?? t('wayfinder.indoor.theElevator', 'el ascensor')
    const text = t('wayfinder.indoor.elevator', 'Toma {{core}} y marca el {{n}}', {
      core,
      n: v.toLevel,
    })
    const detail = v.up
      ? v.floors === 1
        ? t('wayfinder.indoor.elevatorUpOne', 'Subes 1 piso')
        : t('wayfinder.indoor.elevatorUp', 'Subes {{n}} pisos', { n: v.floors })
      : v.floors === 1
        ? t('wayfinder.indoor.elevatorDownOne', 'Bajas 1 piso')
        : t('wayfinder.indoor.elevatorDown', 'Bajas {{n}} pisos', { n: v.floors })
    return { text, detail }
  }
  const core = v.core ?? t('wayfinder.indoor.theStairs', 'la escalera')
  const floor = floorRef(v.toLevel, t)
  const text = v.up
    ? t('wayfinder.indoor.stairsUp', 'Sube por {{core}} hasta {{floor}}', { core, floor })
    : t('wayfinder.indoor.stairsDown', 'Baja por {{core}} hasta {{floor}}', { core, floor })
  const detail =
    v.floors === 1
      ? t('wayfinder.indoor.flightsOne', '1 piso · 2 tramos con descanso')
      : t('wayfinder.indoor.flights', '{{n}} pisos · {{flights}} tramos con descanso', {
          n: v.floors,
          flights: v.floors * 2,
        })
  return { text, detail }
}

function arriveText(step: PlannedStep, t: Translate): { text: string; detail?: string } {
  const a = step.arrive!
  if (a.side === 'ahead') {
    return {
      text: t('wayfinder.indoor.arriveAhead', '{{name}} está enfrente', { name: a.name }),
      detail: a.code ?? undefined,
    }
  }
  const side = sideWord(a.side, t)
  const door = t(
    'wayfinder.indoor.arriveDoor',
    'Es la {{n}}.ª puerta a tu {{side}} desde el último giro',
    {
      n: a.ordinal,
      side,
    },
  )
  return {
    text: t('wayfinder.indoor.arrive', '{{name}} está a tu {{side}}', { name: a.name, side }),
    detail: a.code ? `${door} · ${a.code}` : door,
  }
}

/**
 * "a el" → "al" y "de el" → "del". Los landmarks traen su artículo desde la
 * base ("el hall al patio") y la plantilla no puede saber si lo llevan.
 */
export function contractArticles(text: string): string {
  return text.replace(/\b([Aa]) el\b/g, '$1l').replace(/\b([Dd])e el\b/g, '$1el')
}

export function renderSteps(planned: PlannedStep[], t: Translate): Step[] {
  return planned.map((step) => polish(renderStep(step, t)))
}

function polish(step: Step): Step {
  return {
    ...step,
    text: contractArticles(step.text),
    ...(step.detail ? { detail: contractArticles(step.detail) } : {}),
  }
}

function renderStep(step: PlannedStep, t: Translate): Step {
  const base = {
    kind: step.kind,
    icon: step.icon,
    meters: step.meters,
    level: step.level,
    from: step.from,
    to: step.to,
  }
  switch (step.kind) {
    case 'depart':
      return { ...base, text: departText(step, t), detail: walkDetail(step, t) }
    case 'vertical':
      return { ...base, ...verticalText(step, t) }
    case 'arrive':
      return { ...base, ...arriveText(step, t) }
    case 'end':
      return {
        ...base,
        text: t('wayfinder.indoor.end', 'Llegaste a {{name}}', {
          name: step.end?.name ?? t('wayfinder.indoor.destination', 'tu destino'),
        }),
      }
    default: {
      let verb = verbPhrase(step.turn!, t)
      if (!step.then) {
        return {
          ...base,
          text: withTarget(verb, step.target, step.place, t),
          detail: walkDetail(step, t),
        }
      }
      const first = step.place
        ? t('wayfinder.indoor.at', '{{verb}} en {{place}}', { verb, place: step.place })
        : verb
      verb = t('wayfinder.indoor.thenJoin', '{{first}} y enseguida {{next}}', {
        first,
        next: turnContinuation(step.then, t),
      })
      return {
        ...base,
        text: withTarget(verb, step.target, step.thenPlace, t),
        detail: walkDetail(step, t),
      }
    }
  }
}

export function buildInstructions(
  route: Route,
  graph: NavGraph,
  t: Translate = fallbackTranslate,
  options: PlanOptions = {},
): Step[] {
  return renderSteps(planSteps(route, graph, options), t)
}
