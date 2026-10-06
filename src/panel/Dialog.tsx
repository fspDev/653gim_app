import { useEffect, useRef, useState, type ReactNode } from 'react'
import ui from './ui.module.css'
import { whatsappLink } from './whatsapp'

/** Diálogo modal nativo: Escape lo cierra y el foco queda adentro. */
export function Dialog({ title, text, onClose, children }: { title: string; text?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className={ui.dialog}
      onClose={onClose}
      aria-labelledby="dialog-titulo"
    >
      <h2 id="dialog-titulo" className={ui.dialogTitle}>
        {title}
      </h2>
      {text && <p className={ui.dialogText}>{text}</p>}
      {children}
    </dialog>
  )
}

/** Usuario y contraseña listos para pasarle al estudiante (copiar o mandar por WhatsApp). */
export function Credenciales({ username, clave, nombre, telefono }: { username: string; clave: string; nombre: string; telefono: string }) {
  const url = `${location.origin}${import.meta.env.BASE_URL}`
  const texto = `Hola ${nombre}! Ya tenés tu plan en la app de 653 Gimnasio 💪\n\nEntrá a ${url}\nUsuario: ${username}\nContraseña: ${clave}\n\nDesde Perfil podés cambiar la contraseña.`
  const wa = whatsappLink(telefono, texto)
  return (
    <>
      <div className={ui.cred}>
        <div className={ui.credRow}>
          <div>
            <div className={ui.credLabel}>Usuario</div>
            <div className={ui.credValue}>{username}</div>
          </div>
        </div>
        <div className={ui.credRow}>
          <div>
            <div className={ui.credLabel}>Contraseña</div>
            <div className={ui.credValue}>{clave}</div>
          </div>
        </div>
      </div>
      <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
        <CopyButton text={texto} label="Copiar mensaje" />
        {wa && (
          <a className={ui.primary} href={wa} target="_blank" rel="noreferrer">
            Mandar por WhatsApp
          </a>
        )}
      </div>
    </>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={ui.ghost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } catch {
          /* sin permiso de portapapeles: queda a la vista para copiar a mano */
        }
      }}
    >
      {done ? '✓ Copiado' : label}
    </button>
  )
}
