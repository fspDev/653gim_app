import { createContext, useContext } from 'react'

/** Si el bloque actual tiene indicación del profe, el encabezado muestra el botón para verlos. */
export interface NoteUi {
  available: boolean
  open: () => void
}

export const NoteContext = createContext<NoteUi>({ available: false, open: () => {} })

export const useNoteUi = () => useContext(NoteContext)
