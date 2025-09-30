import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BasicApp from './BasicApp.tsx'

// Apply base styles directly
document.body.style.margin = '0'
document.body.style.padding = '0'
document.body.style.overflow = 'hidden'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BasicApp />
  </StrictMode>
)