import { createContext, useContext } from 'react'

export interface PipUi {
  /** Mostrar el botón de ventana flotante (ajuste "Solo con el botón"). */
  manual: boolean
  open: boolean
  toggle: () => void
}

export const PipContext = createContext<PipUi>({ manual: false, open: false, toggle: () => {} })

export const usePipUi = () => useContext(PipContext)
