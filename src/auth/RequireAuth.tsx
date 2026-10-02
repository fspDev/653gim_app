import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context'

/** Deja pasar con sesión (o en el modo demo de desarrollo); si no, manda a ingresar. */
export function RequireAuth() {
  const { status, profile } = useAuth()
  if (status === 'loading') return null
  if (status === 'out') return <Navigate to="/ingreso" replace />
  // El profe trabaja desde el panel; la app de entreno es de los socios.
  if (profile?.rol === 'profe') return <Navigate to="/panel" replace />
  return <Outlet />
}
