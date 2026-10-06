import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/context'
import { store } from '../backend'
import { problemaClave } from '../cuentas'
import { estadoCuota, estadoLabel, fechaCorta, fmtPesos, type CuotaConfig, type CuotaManual } from '../cuotas'
import { COL } from '../firebase'
import { fmtTime } from '../format'
import { useDays } from '../rutina/useDays'
import { updateSettings, useSettings, type Settings } from '../settings'
import { askNotificationPermission, notificationPermission, showAlert } from '../notify'
import { closePiP, isIOS, isPiPOpen, isPiPSupported, lastPiPError, openPiP, preparePiP } from '../pip/pipEngine'
import { PALETTES } from '../theme'
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
  { value: 'salir', label: 'Al salir', hint: 'Intenta aparecer sola cuando cambiás de app (no todos los celulares lo permiten).' },
  { value: 'serie', label: 'Al tocar', hint: 'Se abre con tu primer toque del entreno: deslizar para empezar, HECHA o pausar la bici.' },
  { value: 'boton', label: 'Botón', hint: 'Solo cuando la abrís vos.' },
  { value: 'nunca', label: 'Nunca', hint: 'Sin ventana flotante ni botón.' },
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
  const [pipTest, setPipTest] = useState<string | null>(null)
  const s = useSettings()
  useEffect(preparePiP, [])
  const { profile, signOut } = useAuth()
  const { rutina } = useDays()
  const nombre = `${profile?.nombre ?? ''} ${profile?.apellido ?? ''}`.trim() || 'Vos'
  const plan = rutina?.diasPorSemana ? ` · plan de ${rutina.diasPorSemana} ${rutina.diasPorSemana === 1 ? 'día' : 'días'}` : ''
  const sub = `${profile?.username ?? ''}${plan}`
  const setRest = (delta: number) => updateSettings({ restSeconds: Math.min(REST_MAX, Math.max(REST_MIN, s.restSeconds + delta)) })

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>PERFIL</h1>

      <div className={styles.who}>
        <div className={styles.avatar} aria-hidden="true">
          {nombre.charAt(0).toUpperCase()}
        </div>
        <div className={styles.whoText}>
          <div className={styles.name}>{nombre}</div>
          <div className={styles.sub}>{sub}</div>
        </div>
      </div>

      {profile?.sid && <Cuota sid={profile.sid} />}

      <div className={styles.section}>DURANTE EL ENTRENO</div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>Descanso entre series</div>
            <div className={styles.hint}>Si el ejercicio no tiene uno propio</div>
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

      <div className={styles.section} style={{ marginTop: 24 }}>
        COLORES
      </div>
      <div className={styles.palettes} role="radiogroup" aria-label="Colores de fondo y texto">
        {PALETTES.map((p) => (
          <button key={p.id} className={styles.palette} role="radio" aria-checked={s.paleta === p.id} aria-label={p.nombre} onClick={() => updateSettings({ paleta: p.id })}>
            <span className={styles.swatch} style={{ background: p.bg, color: p.ink }}>
              Aa
            </span>
            <span className={styles.paletteName}>{p.nombre}</span>
          </button>
        ))}
      </div>

      <div className={styles.section} style={{ marginTop: 24 }}>
        VENTANA FLOTANTE
      </div>
      {isPiPSupported() ? (
        <>
          <div className={styles.segmented} role="radiogroup" aria-label="Ventana flotante">
            {FLOTANTE.map((t) => (
              <button key={t.value} className={styles.option} role="radio" aria-checked={s.flotante === t.value} onClick={() => updateSettings({ flotante: t.value })}>
                {t.label}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            {FLOTANTE.find((t) => t.value === s.flotante)?.hint}
            {s.flotante !== 'nunca' && ' Siempre la podés abrir con el botón 🗗 de arriba del entreno.'} Desde la ventanita: ⏭ marca HECHA o salta el descanso, ⏮ suma 15 s y ⏯ pausa la bici.
          </p>
          <div className={styles.rows}>
            <div className={styles.row}>
              <div>
                <div className={styles.label}>Probar la ventana flotante</div>
                <div className={styles.hint}>{pipTest ?? 'Se abre con un cartel de prueba'}</div>
              </div>
              <button
                className={styles.small}
                onClick={async () => {
                  if (isPiPOpen()) {
                    closePiP()
                    setPipTest('Cerrada.')
                    return
                  }
                  const ok = await openPiP()
                  setPipTest(ok ? '✓ Funcionó. Tocá de nuevo para cerrarla.' : `No se abrió: ${lastPiPError ?? 'motivo desconocido'}${isIOS() ? ' En iPhone probá con iOS actualizado y abriendo la app desde Safari.' : ''}`)
                }}
              >
                PROBAR
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className={styles.note}>{isIOS() ? 'Este iPhone no permite ventanas flotantes desde la web. Actualizá iOS y probá abriendo la app desde Safari.' : 'Este navegador no permite ventanas flotantes. En Android usá Chrome actualizado.'}</p>
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
                const ok = await showAlert('Así te avisa el 653 💪', 'Cuando termine el descanso vas a sentir esta vibración.', 'am-prueba')
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

      <div className={styles.section} style={{ marginTop: 24 }}>
        CUENTA
      </div>
      <CambiarClave />
      <button className={styles.signOut} onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </main>
  )
}

/** Cuota del mes: lo mismo que ve el profe en el panel. */
function Cuota({ sid }: { sid: string }) {
  const [texto, setTexto] = useState<{ estado: string; detalle: string; alerta: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([store.get(`${COL.students}/${sid}`), store.list(`${COL.students}/${sid}/pagos`)])
      .then(([st, pagos]) => {
        if (cancelled || !st) return
        const cfg = st.cuota as CuotaConfig | undefined
        const manual = (st.cuotaManual as CuotaManual | null | undefined) ?? null
        const e = estadoCuota(cfg, pagos.map((p) => ({ periodo: String(p.data.periodo) })), Number(st.createdAt ?? Date.now()), Date.now(), manual)
        if (e.tipo === 'sin-cuota') return
        const detalle = cfg?.monto ? `Cuota mensual ${fmtPesos(cfg.monto)} · vence el ${cfg.dia} de cada mes` : manual?.vence ? `Pagada hasta el ${fechaCorta(manual.vence)}` : ''
        setTexto({ estado: estadoLabel(e), detalle, alerta: e.tipo === 'vencida' })
      })
      .catch(() => {
        /* sin señal: no se muestra */
      })
    return () => {
      cancelled = true
    }
  }, [sid])

  if (!texto) return null
  return (
    <div className={styles.cuota} data-alerta={texto.alerta}>
      <div className={styles.label}>{texto.estado}</div>
      <div className={styles.hint}>{texto.detalle}</div>
    </div>
  )
}

function CambiarClave() {
  const { cambiarClave } = useAuth()
  const [open, setOpen] = useState(false)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const problema = nueva ? problemaClave(nueva) : null
  const ok = !!actual && !problemaClave(nueva) && nueva === repetir

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setMsg(null)
    const r = await cambiarClave(actual, nueva)
    setBusy(false)
    if (r.ok) {
      setMsg({ ok: true, text: '✓ Listo: la próxima vez entrás con la nueva.' })
      setActual('')
      setNueva('')
      setRepetir('')
      setOpen(false)
    } else {
      setMsg({ ok: false, text: r.reason === 'datos' ? 'La contraseña actual no es esa.' : r.reason === 'red' ? 'No hay conexión.' : 'No se pudo cambiar. Probá de nuevo.' })
    }
  }

  if (!open) {
    return (
      <div className={styles.rows}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>Contraseña</div>
            {msg && <div className={styles.hint}>{msg.text}</div>}
          </div>
          <button className={styles.small} onClick={() => setOpen(true)}>
            CAMBIAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.claveForm} onSubmit={submit} noValidate>
      <label className={styles.fieldLabel} htmlFor="clave-actual">
        Contraseña actual
      </label>
      <input id="clave-actual" className={styles.field} type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      <label className={styles.fieldLabel} htmlFor="clave-nueva">
        Nueva
      </label>
      <input id="clave-nueva" className={styles.field} type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      <label className={styles.fieldLabel} htmlFor="clave-repetir">
        Repetila
      </label>
      <input id="clave-repetir" className={styles.field} type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      <div className={styles.hint} role={msg ? 'alert' : undefined}>
        {msg?.text ?? problema ?? (repetir && nueva !== repetir ? 'No coinciden.' : ' ')}
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button type="submit" className={styles.small} disabled={!ok || busy}>
          {busy ? 'GUARDANDO…' : 'GUARDAR'}
        </button>
      </div>
    </form>
  )
}
