import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Tipografías empaquetadas (nada de Google Fonts): la app abre igual sin conexión.
import '@fontsource/anton/latin-400.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './index.css'
import { AuthProvider } from './auth/AuthProvider.tsx'
import App from './App.tsx'
import { getSettings } from './settings'
import { applyPalette } from './theme'

// Antes de pintar: así no aparece un instante con los colores por defecto.
applyPalette(getSettings().paleta)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
