import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context'
import { SinAcceso } from './SinAcceso'

/** Sin sesión manda a ingresar. El profe también puede usar la app para entrenar su propia rutina. */
export function RequireAuth() {
  const { status } = useAuth()
  if (status === 'loading') return null
  if (status === 'out') return <Navigate to="/ingreso" replace />
  if (status === 'sin-acceso') return <SinAcceso />
  return <Outlet />
}
