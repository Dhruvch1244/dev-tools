import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getStoredTheme } from './lib/themes'
import { applyAllAppearance } from './lib/appearance'

// Paint theme + text size before the first render so nobody sees a flash of the wrong look.
applyTheme(getStoredTheme())
applyAllAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
