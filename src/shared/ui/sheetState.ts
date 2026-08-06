import { createContext, useContext } from 'react'

// En qué punto de anclaje está la hoja, para el contenido que necesita
// adaptarse. Lo usa `FacultyDetail` para plegar la foto de portada al
// expandirse: a pantalla completa esa imagen se come el sitio de lo que se vino
// a leer.
//
// En su propio archivo y no junto a `DraggableBottomSheet` porque mezclar
// componentes con hooks en un mismo módulo rompe el fast refresh de Vite.

export const SheetStateContext = createContext<{ isExpanded: boolean; isDesktop: boolean }>({
  isExpanded: false,
  isDesktop: false,
})

export function useSheetState() {
  return useContext(SheetStateContext)
}
