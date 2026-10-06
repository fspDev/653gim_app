import { ProfeNota } from '../ui/ProfeNota'
import { Sheet } from './Sheet'
import styles from './NoteSheet.module.css'

/** Hoja con la indicación del profe para el ejercicio actual, entera. */
export function NoteSheet({ name, note, onClose }: { name: string; note?: string; onClose: () => void }) {
  return (
    <Sheet label={`Indicación del profe para ${name}`} onClose={onClose}>
      <div className={styles.title}>{name.toUpperCase()}</div>
      <div className={styles.body}>
        <ProfeNota note={note} />
      </div>
      <button className={styles.ok} onClick={onClose}>
        SEGUIR
      </button>
    </Sheet>
  )
}
