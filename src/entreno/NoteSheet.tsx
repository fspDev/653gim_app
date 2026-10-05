import { ProfeNota } from '../ui/ProfeNota'
import { Sheet } from './Sheet'
import styles from './NoteSheet.module.css'

/** Hoja con la indicación del profe y el video del ejercicio actual. */
export function NoteSheet({ name, note, video, onClose }: { name: string; note?: string; video?: string; onClose: () => void }) {
  return (
    <Sheet label={`Indicación del profe para ${name}`} onClose={onClose}>
      <div className={styles.title}>{name.toUpperCase()}</div>
      <div className={styles.body}>
        <ProfeNota note={note} video={video} />
      </div>
      <button className={styles.ok} onClick={onClose}>
        SEGUIR
      </button>
    </Sheet>
  )
}
