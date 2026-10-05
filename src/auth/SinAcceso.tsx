import { LogoMark } from '../ui/Logo'
import { useAuth } from './context'
import styles from './Auth.module.css'

/** Entró con una cuenta que ya no tiene ficha: el profe le dio una contraseña nueva o lo dio de baja. */
export function SinAcceso() {
  const { signOut } = useAuth()
  return (
    <div className={styles.page}>
      <LogoMark height={56} />
      <p className={styles.lead}>Esta contraseña ya no sirve: tu profe te dio una nueva. Entrá de nuevo con la que te pasó.</p>
      <div className={styles.grow} />
      <button className={styles.primary} onClick={() => void signOut()}>
        VOLVER A ENTRAR
      </button>
    </div>
  )
}
