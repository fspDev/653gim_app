import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Ingreso } from './auth/Ingreso'
import { RequireAuth } from './auth/RequireAuth'
import { Entreno } from './entreno/Entreno'
import { Hoy } from './hoy/Hoy'
import { Perfil } from './perfil/Perfil'
import { Progreso } from './progreso/Progreso'
import { Plan } from './rutina/Plan'
import { useSettings } from './settings'
import { TabsLayout } from './tabs/TabsLayout'
import { applyPalette } from './theme'
import { UpdateBanner } from './UpdateBanner'

// El panel del profe se baja aparte: los estudiantes no lo cargan nunca.
const Panel = lazy(() => import('./panel/Panel').then((m) => ({ default: m.Panel })))

export default function App() {
  const { paleta } = useSettings()
  useEffect(() => applyPalette(paleta), [paleta])

  return (
    <>
      <UpdateBanner />
      <Routes>
        <Route path="/ingreso" element={<Ingreso />} />
        <Route element={<RequireAuth />}>
          <Route element={<TabsLayout />}>
            <Route index element={<Hoy />} />
            <Route path="plan" element={<Plan />} />
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
