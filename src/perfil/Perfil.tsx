import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { fmtTime } from '../format'
import { useDays } from '../rutina/useDays'
import { updateSettings, useSettings, type Settings } from '../settings'
import { askNotificationPermission, notificationPermission, showAlert } from '../notify'
import { isPiPSupported } from '../pip/pipEngine'
import styles from './Perfil.module.css'

const REST_STEP = 15
const REST_MIN = 30
const REST_MAX = 300

const TOGGLES: { key: 'vibracion' | 'sonido' | 'pantallaEncendida'; label: string }[] = [
  { key: 'vibracion', label: 'Vibrar al terminar el descanso' },
  { key: 'sonido', label: 'Sonido al terminar el descanso' },
  { key: 'pantallaEncendida', label: 'Mantener la pantalla encendida' },
]

const THEMES: { value: Settings['temaDescanso']; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'claro', label: 'Claro' },
  { value: 'oscuro', label: 'Oscuro' },
]

const FLOTANTE: { value: Settings['flotante']; label: string; hint: string }[] = [
  { value: 'salir', label: 'Al salir', hint: 'Aparece sola cuando cambiás de app y se va cuando volvés.' },
  { value: 'serie', label: 'Al marcar', hint: 'Se abre al tocar HECHA. Usala si tu celular no la abre solo al salir.' },
  { value: 'boton', label: 'Botón', hint: 'Un botón arriba del entreno la abre y la cierra.' },
  { value: 'nunca', label: 'Nunca', hint: 'Sin ventana flotante.' },
]

const PERMISO: Record<string, string> = {
  granted: 'Activados',
  denied: 'Bloqueados: activalos en los permisos del sitio',
  default: 'Sin activar',
  unsupported: 'Este navegador no los permite',
}

export function Perfil() {
  const [permiso, setPermiso] = useState(notificationPermission)
  const [probado, setProbado] = useState<string | null>(null)
  const s = useSettings()
  const navigate = useNavigate()
  const { status, profile, signOut } = useAuth()
  const { rutina } = useDays()
  const nombre = profile?.nombre.trim() || (status === 'in' ? profile?.email : null) || 'Socio'
  const plan = rutina?.diasPorSemana ? ` · plan de ${rutina.diasPorSemana} días` : ''
  const sub = profile?.profeNombre ? `Tu profe: ${profile.profeNombre}${plan}` : 'Tus entrenos quedan guardados en este teléfono'
  const setRest = (delta: number) => updateSettings({ restSeconds: Math.min(REST_MAX, Math.max(REST_MIN, s.restSeconds + delta)) })

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>PERFIL</h1>

      <div className={styles.who}>
        <div className={styles.avatar} aria-hidden="true">
          {profile ? nombre.charAt(0).toUpperCase() : '653'}
        </div>
        <div>
          <div className={styles.name}>{nombre}</div>
          <div className={styles.sub}>{sub}</div>
        </div>
      </div>

      <div className={styles.section}>DURANTE EL ENTRENO</div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>Descanso entre series</div>
            <div className={styles.hint}>Si tu profe no indica otro</div>
          </div>
          <div className={styles.stepper}>
            <button className={styles.round} aria-label="Menos descanso" onClick={() => setRest(-REST_STEP)} disabled={s.restSeconds <= REST_MIN}>
              −
            </button>
            <span className={styles.rest} aria-live="polite">
              {fmtTime(s.restSeconds)}
            </span>
            <button className={styles.round} aria-label="Más descanso" onClick={() => setRest(REST_STEP)} disabled={s.restSeconds >= REST_MAX}>
              +
            </button>
          </div>
        </div>

        {TOGGLES.map((t) => (
          <div key={t.key} className={styles.row}>
            <div className={styles.label}>{t.label}</div>
            <button className={styles.switch} role="switch" aria-checked={s[t.key]} aria-label={t.label} onClick={() => updateSettings({ [t.key]: !s[t.key] })}>
              <span className={styles.knob} />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.section} style={{ marginTop: 24 }}>
        PANTALLA DE DESCANSO
      </div>
      <div className={styles.segmented} role="radiogroup" aria-label="Tema">
        {THEMES.map((t) => (
          <button key={t.value} className={styles.option} role="radio" aria-checked={s.temaDescanso === t.value} onClick={() => updateSettings({ temaDescanso: t.value })}>
            {t.label}
          </button>
        ))}
      </div>

      {isPiPSupported() && (
        <>
          <div className={styles.section} style={{ marginTop: 24 }}>
            VENTANA FLOTANTE
          </div>
          <div className={styles.segmented} role="radiogroup" aria-label="Ventana flotante">
            {FLOTANTE.map((t) => (
              <button key={t.value} className={styles.option} role="radio" aria-checked={s.flotante === t.value} onClick={() => updateSettings({ flotante: t.value })}>
                {t.label}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            {FLOTANTE.find((t) => t.value === s.flotante)?.hint} Desde la ventanita: ⏭ marca HECHA o salta el descanso, ⏮ suma 15 s y ⏯ pausa la bici.
          </p>
        </>
      )}

      <div className={styles.section} style={{ marginTop: 24 }}>
        AVISOS CON LA APP CERRADA
      </div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>Notificación al terminar el descanso</div>
            <div className={styles.hint}>{probado ?? PERMISO[permiso]}</div>
          </div>
          {permiso === 'granted' ? (
            <button
              className={styles.small}
              onClick={async () => {
                const ok = await showAlert('Así te avisa 653 💪', 'Cuando termine el descanso vas a sentir esta vibración.', '653-prueba')
                setProbado(ok ? 'Enviado. ¿Vibró?' : 'No se pudo mandar')
              }}
            >
              PROBAR
            </button>
          ) : permiso === 'default' ? (
            <button
              className={styles.small}
              onClick={async () => {
                await askNotificationPermission()
                setPermiso(notificationPermission())
              }}
            >
              ACTIVAR
            </button>
          ) : null}
        </div>
      </div>

      {status === 'in' && (
        <button
          className={styles.signOut}
          onClick={async () => {
            await signOut()
            navigate('/ingreso', { replace: true })
          }}
        >
          Cerrar sesión
        </button>
      )}
    </main>
  )
}
