import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Landing from './pages/Landing'
import Quiz from './pages/Quiz'
import Recommendations from './pages/Recommendations'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Pets from './pages/Pets'
import Subscription from './pages/Subscription'
import Checkout from './pages/Checkout'
import AdminImport from './pages/AdminImport'

function Protected({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#FAF6EF'}}>
      <p style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', color:'#1b5c3a'}}>🐾 Ładowanie PawBox...</p>
    </div>
  )

  return (
    <BrowserRouter>
      <Navbar session={session} />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/auth" element={<Auth session={session} />} />
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="/dashboard" element={<Protected session={session}><Dashboard session={session!} /></Protected>} />
          <Route path="/pets" element={<Protected session={session}><Pets session={session!} /></Protected>} />
          <Route path="/subscription" element={<Protected session={session}><Subscription session={session!} /></Protected>} />
          <Route path="/checkout" element={<Protected session={session}><Checkout session={session!} /></Protected>} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
