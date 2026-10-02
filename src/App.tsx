import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Ingreso } from './auth/Ingreso'
import { RequireAuth } from './auth/RequireAuth'
import { Entreno } from './entreno/Entreno'
import { Hoy } from './hoy/Hoy'
import { Perfil } from './perfil/Perfil'
import { Progreso } from './progreso/Progreso'
import { TabsLayout } from './tabs/TabsLayout'
import { UpdateBanner } from './UpdateBanner'

// El panel del profe se baja aparte: los socios no lo cargan nunca.
const Panel = lazy(() => import('./panel/Panel').then((m) => ({ default: m.Panel })))

export default function App() {
  return (
    <>
    <UpdateBanner />
    <Routes>
      <Route path="/ingreso" element={<Ingreso />} />
      <Route element={<RequireAuth />}>
        <Route element={<TabsLayout />}>
          <Route index element={<Hoy />} />
          <Route path="progreso" element={<Progreso />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>
        <Route path="/entreno" element={<Entreno />} />
      </Route>
      <Route
        path="/panel/*"
        element={
          <Suspense fallback={null}>
            <Panel />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
