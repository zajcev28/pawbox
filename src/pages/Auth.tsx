import { type Session } from '@supabase/supabase-js'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'

export default function AuthPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const intended = sessionStorage.getItem('intendedPath') || '/dashboard'

  const goOn = () => {
    sessionStorage.removeItem('intendedPath')
    navigate(intended, { replace: true })
  }

  if (session) {
    sessionStorage.removeItem('intendedPath')
    return <Navigate to={intended} replace />
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#144830' }}>🐾 PawBox</h1>
          <p style={{ color:'#6b7280', marginTop:'0.5rem' }}>Twoje konto</p>
        </div>
        <div className="card">
          <AuthForm onSignedIn={goOn} />
        </div>
      </div>
    </div>
  )
}
