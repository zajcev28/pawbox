import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('🐾 PawBox main.tsx ładuje się...')
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? '✓ ustawiony' : '✗ BRAK!')
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ ustawiony' : '✗ BRAK!')

const root = document.getElementById('root')
console.log('Root element:', root ? '✓ znaleziony' : '✗ BRAK elementu #root w HTML!')

createRoot(root!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
