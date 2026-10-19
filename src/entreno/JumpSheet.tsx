import type { Workout } from '../workout/types'
import { blockDetail } from './describe'
import { Sheet } from './Sheet'
import styles from './JumpSheet.module.css'

interface Props {
  w: Workout
  onPick: (index: number) => void
  onClose: () => void
}

/** "¿Máquina ocupada?": todos los bloques del día; se puede ir a cualquiera que falte. El que se deja queda pendiente. */
export function JumpSheet({ w, onPick, onClose }: Props) {
  const done = new Set(w.results.map((r) => r.blockId))
  return (
    <Sheet label="Elegir otro ejercicio" onClose={onClose}>
      <div className={styles.title}>¿MÁQUINA OCUPADA?</div>
      <p className={styles.text}>Elegí otro ejercicio. Lo que dejes queda para después.</p>
      <ol className={styles.list}>
        {w.day.blocks.map((b, i) => {
          const isDone = done.has(b.id)
          const isNow = i === w.index && w.stage === 'block'
          const series = b.kind === 'fuerza' ? w.logs.filter((l) => l.blockId === b.id).length : 0
          const state = isDone ? 'Hecho' : isNow ? 'Ahora' : series && b.kind === 'fuerza' ? `${series}/${b.series} series` : ''
          return (
            <li key={b.id}>
              <button
                className={`${styles.item} ${isDone ? styles.done : ''} ${isNow ? styles.now : ''}`}
                disabled={isDone || isNow}
                onClick={() => onPick(i)}
              >
                <span className={styles.num}>{i + 1}</span>
                <span className={styles.body}>
                  <span className={styles.name}>{b.name}</span>
                  <span className={styles.detail}>{blockDetail(b)}</span>
                </span>
                {state && <span className={styles.state}>{state}</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <button className={styles.close} onClick={onClose}>
        SEGUIR CON ESTE
      </button>
    </Sheet>
  )
}
