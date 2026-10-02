import { Sheet } from './Sheet'
import styles from './ExitSheet.module.css'

export type ExitKind = 'guardar' | 'descartar'

interface Props {
  minutes: number
  blocksDone: number
  blocksTotal: number
  onContinue: () => void
  onExit: (kind: ExitKind) => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Hoja "¿Cortás acá?" (Salir.dc.html). El descanso sigue corriendo detrás. */
export function ExitSheet({ minutes, blocksDone, blocksTotal, onContinue, onExit }: Props) {
  return (
    <Sheet label="Salir del entrenamiento" onClose={onContinue}>
      <div className={styles.title}>¿CORTÁS ACÁ?</div>
      <p className={styles.text}>
        Llevás {plural(minutes, 'minuto', 'minutos')} y {blocksDone} de {plural(blocksTotal, 'bloque', 'bloques')}. Lo que hiciste cuenta para tu
        racha.
      </p>
      <button className={styles.keep} onClick={onContinue}>
        SEGUIR ENTRENANDO
      </button>
      <button className={styles.save} onClick={() => onExit('guardar')}>
        GUARDAR Y TERMINAR
      </button>
      <button className={styles.discard} onClick={() => onExit('descartar')}>
        Descartar este entreno
      </button>
    </Sheet>
  )
}
