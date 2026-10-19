import { createContext, useContext } from 'react'

/** Abre la lista de ejercicios del día para saltar a otro (si la máquina está ocupada). */
export interface JumpUi {
  open: () => void
}

export const JumpContext = createContext<JumpUi>({ open: () => {} })

export const useJumpUi = () => useContext(JumpContext)
