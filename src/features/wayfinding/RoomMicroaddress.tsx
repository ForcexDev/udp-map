import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMapping } from '@/features/mapping/useMapping'
import type { Pin } from '@/shared/types/database'
import { microaddress } from '@/shared/utils/indoor/microaddress'
import { resolveTarget } from './resolveTarget'
import { useNavGraph } from './useNavGraph'

// ─────────────────────────────────────────────────────────────────────────────
// La microdirección en la ficha de una sala, antes de pedir "Cómo llegar":
//
//   Vergara 432 · Piso 4 · Pasillo central, lado sur
//   Saliendo de la escalera, a la derecha: 1.ª puerta a tu izquierda
//
// Solo para pines con sala en el grafo. Un pin cualquiera dentro del edificio
// no la lleva: ajustarlo al pasillo más cercano sirve para rutear, no para
// describir dónde está.
// ─────────────────────────────────────────────────────────────────────────────

export function RoomMicroaddress({ pin }: { pin: Pin }) {
  const { t } = useTranslation()
  const { mapping } = useMapping()
  // Solo se pide el grafo si el pin puede ser una sala: el resto de fichas no
  // necesita una consulta más.
  const wanted = pin.faculty_id !== null && (pin.room_code !== null || pin.area_id !== null)
  const { model } = useNavGraph(wanted ? pin.faculty_id : null)

  const address = useMemo(() => {
    if (!model) return null
    const target = resolveTarget(pin, model)
    if (!target || model.graph.node(target).kind !== 'room') return null
    return microaddress(target, {
      graph: model.graph,
      areas: model.areas,
      buildingName: (id) => {
        const building = mapping.buildings.find((b) => b.id === id)
        return building ? building.name : null
      },
      t,
    })
  }, [model, pin, mapping.buildings, t])

  if (!address) return null
  return (
    <div className="mt-3 rounded-2xl border border-[#F2D0CE] bg-[#FBECEB] px-3.5 py-2.5 text-xs dark:border-[#D93846]/30 dark:bg-[#D93846]/10">
      <div className="font-semibold text-[#B02330] dark:text-rose-300">{address.line1}</div>
      {address.line2 ? (
        <div className="mt-0.5 text-stone-700 dark:text-stone-300">{address.line2}</div>
      ) : (
        <div className="mt-0.5 text-stone-500 dark:text-stone-400">
          {t('wayfinder.indoor.noStairsMapped', 'Esta planta no tiene escalera mapeada.')}
        </div>
      )}
    </div>
  )
}
