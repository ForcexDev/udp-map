import type { ObjetivoGuia } from '@/shared/ui/Guia'

// ─────────────────────────────────────────────────────────────────────────────
// Etapas del tutorial del mapa, derivadas del estado de la práctica.
//
// No hay botón «Siguiente»: la etapa sale de lo que la persona ya hizo (buscó
// la facultad, abrió un pin, publicó…). Así no se puede saltar un paso ni
// quedar desfasado si cierra una hoja con Escape: al cambiar el estado, la
// etapa y el objetivo se recalculan solos.
//
// Es una función pura a propósito: se prueba sin DOM ni mapa.
// ─────────────────────────────────────────────────────────────────────────────

type T = (clave: string, respaldo: string, opciones?: Record<string, unknown>) => string

export interface EstadoPractica {
  buscadorAbierto: boolean
  facultadEncontrada: boolean
  pinAbiertoId: string | null
  pinVisto: boolean
  ubicando: boolean
  formularioAbierto: boolean
  categoriaBorrador: string | null
  publicado: boolean
  filtrosAbiertos: boolean
  filtroCategoria: string | null
}

export const ESTADO_INICIAL: EstadoPractica = {
  buscadorAbierto: false,
  facultadEncontrada: false,
  pinAbiertoId: null,
  pinVisto: false,
  ubicando: false,
  formularioAbierto: false,
  categoriaBorrador: null,
  publicado: false,
  filtrosAbiertos: false,
  filtroCategoria: null,
}

/** Lo que el tutorial destaca: ids estables de `data-guia`. */
export const GUIA = {
  buscador: 'buscador',
  resultadoFacultad: 'resultado-facultad',
  pinEjemplo: 'pin-ejemplo',
  cerrarFicha: 'cerrar-ficha',
  ficha: 'ficha',
  publicar: 'publicar',
  confirmarUbicacion: 'confirmar-ubicacion',
  categoria: 'categoria-borrador',
  enviarPublicacion: 'enviar-publicacion',
  filtros: 'filtros',
  filtroCategoria: 'filtro-categoria',
  cerrarFiltros: 'cerrar-filtros',
  pinNuevo: 'pin-nuevo',
  mapa: 'mapa',
  menu: 'menu',
  sede: 'sede',
  vista: 'vista',
} as const

export const sel = (id: string) => `[data-guia="${id}"]`

export interface Etapa {
  titulo: string
  texto: string
}

export function etapas(t: T): Etapa[] {
  return [
    {
      titulo: t('mapTutorial.stageSearchTitle', 'Busca un lugar'),
      texto: t(
        'mapTutorial.stageSearchText',
        'El buscador encuentra facultades, edificios y salas, y te lleva hasta ellos.',
      ),
    },
    {
      titulo: t('mapTutorial.stagePinTitle', 'Abre un pin'),
      texto: t(
        'mapTutorial.stagePinText',
        'Cada pin es algo publicado por la comunidad: comida, salas libres, eventos…',
      ),
    },
    {
      titulo: t('mapTutorial.stagePublishTitle', 'Publica algo'),
      texto: t(
        'mapTutorial.stagePublishText',
        'Con + eliges el punto exacto y cuentas qué hay ahí. Aquí es de práctica: no se publica de verdad.',
      ),
    },
    {
      titulo: t('mapTutorial.stageFilterTitle', 'Filtra el mapa'),
      texto: t(
        'mapTutorial.stageFilterText',
        'Los filtros dejan a la vista solo lo que te interesa ahora.',
      ),
    },
    {
      titulo: t('mapTutorial.stageDoneTitle', '¡Listo!'),
      texto: t(
        'mapTutorial.stageDoneText',
        'Ya sabes moverte por UDP Map. Lo que publiques en el mapa real lo verá toda la comunidad.',
      ),
    },
  ]
}

/** Índice de la etapa actual (0-based). La última es «Listo». */
export function etapaActual(e: EstadoPractica): number {
  if (!e.facultadEncontrada) return 0
  if (!e.pinVisto || e.pinAbiertoId !== null) return 1
  if (!e.publicado) return 2
  if (!e.filtroCategoria || e.filtrosAbiertos) return 3
  return 4
}

/**
 * Objetivos del momento, en orden de preferencia: la capa destaca el primero
 * que encuentre en el DOM. El resto son respaldo, por ejemplo el mapa entero
 * mientras el marcador todavía va de camino.
 */
export function objetivos(
  e: EstadoPractica,
  t: T,
  nombres: {
    facultad: string
    pin: string
    categoria: string
    /** Rótulos de botones, de las mismas claves que los pintan. */
    confirmar: string
    publicar: string
    filtros: string
  },
): ObjetivoGuia[] {
  switch (etapaActual(e)) {
    case 0:
      return e.buscadorAbierto
        ? [
            {
              selector: sel(GUIA.resultadoFacultad),
              instruccion: t('mapTutorial.tapResult', 'Toca «{{name}}»', {
                name: nombres.facultad,
              }),
            },
            {
              selector: sel(GUIA.buscador),
              instruccion: t('mapTutorial.typeSearch', 'Escribe el nombre de una facultad'),
            },
          ]
        : [
            {
              selector: sel(GUIA.buscador),
              instruccion: t('mapTutorial.tapSearch', 'Toca el buscador'),
            },
          ]
    case 1:
      return e.pinAbiertoId
        ? [
            {
              selector: sel(GUIA.cerrarFicha),
              instruccion: t(
                'mapTutorial.closeSheet',
                'Aquí ves quién lo publicó y cuándo vence. Toca la X para cerrar',
              ),
            },
          ]
        : [
            {
              selector: sel(GUIA.pinEjemplo),
              instruccion: t('mapTutorial.tapPin', 'Toca el pin «{{name}}»', { name: nombres.pin }),
              // Es un marcador del mapa: si quedó fuera de la vista no se
              // hace scroll (movería el contenedor del mapa), se espera.
              scroll: false,
            },
            {
              selector: sel(GUIA.mapa),
              instruccion: t('mapTutorial.waitMap', 'El mapa está llegando a la facultad…'),
              mirar: true,
            },
          ]
    case 2:
      if (e.formularioAbierto) {
        return e.categoriaBorrador
          ? [
              {
                selector: sel(GUIA.enviarPublicacion),
                instruccion: t('mapTutorial.tapPublish', 'Toca «{{name}}»', {
                  name: nombres.publicar,
                }),
              },
            ]
          : [
              {
                selector: sel(GUIA.categoria),
                instruccion: t('mapTutorial.chooseCategory', 'Elige «{{name}}»', {
                  name: nombres.categoria,
                }),
              },
            ]
      }
      if (e.ubicando) {
        return [
          {
            selector: sel(GUIA.confirmarUbicacion),
            instruccion: t(
              'mapTutorial.confirmLocation',
              'El pin cae donde apunta la marca. Toca «{{name}}»',
              { name: nombres.confirmar },
            ),
          },
        ]
      }
      return [
        {
          selector: sel(GUIA.publicar),
          instruccion: t('mapTutorial.tapPlus', 'Toca + para publicar'),
        },
      ]
    case 3:
      if (e.filtrosAbiertos) {
        return e.filtroCategoria
          ? [
              {
                selector: sel(GUIA.cerrarFiltros),
                instruccion: t('mapTutorial.closeFilters', 'Toca la X para ver el mapa filtrado'),
              },
            ]
          : [
              {
                selector: sel(GUIA.filtroCategoria),
                instruccion: t('mapTutorial.tapFilter', 'Toca «{{name}}»', {
                  name: nombres.categoria,
                }),
              },
            ]
      }
      return [
        {
          selector: sel(GUIA.filtros),
          instruccion: t('mapTutorial.tapFilters', 'Toca «{{name}}»', { name: nombres.filtros }),
        },
      ]
    default:
      return [
        {
          selector: sel(GUIA.pinNuevo),
          instruccion: t('mapTutorial.lookNewPin', 'Este es tu pin. Solo quedó lo que filtraste'),
          mirar: true,
          scroll: false,
        },
        {
          selector: sel(GUIA.mapa),
          instruccion: t('mapTutorial.lookMap', 'Solo quedó a la vista lo que filtraste'),
          mirar: true,
        },
      ]
  }
}
