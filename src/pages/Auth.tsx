import { useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const intended = sessionStorage.getItem('intendedPath') || '/dashboard'

  if (session) {
    sessionStorage.removeItem('intendedPath')
    return <Navigate to={intended} replace />
  }

  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setError(''); setLoading(true)
    let result
    if (tab === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.signUp({ email, password })
    }
    setLoading(false)
    if (result.error) {
      setError(result.error.message)
    } else if (tab === 'register' && !result.data.session) {
      setError('Sprawdź email i kliknij link potwierdzający konto.')
    } else {
      sessionStorage.removeItem('intendedPath')
      navigate(intended)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#144830' }}>🐾 PawBox</h1>
          <p style={{ color:'#6b7280', marginTop:'0.5rem' }}>Twoje konto</p>
        </div>

        <div className="card">
          {/* Taby */}
          <div style={{ display:'flex', marginBottom:'1.5rem', borderBottom:'2px solid #E8DFD0' }}>
            {(['login','register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                style={{ flex:1, padding:'0.75rem', background:'none', border:'none', cursor:'pointer',
                  fontWeight: tab===t ? 600 : 400,
                  color: tab===t ? '#1b5c3a' : '#6b7280',
                  borderBottom: tab===t ? '2px solid #1b5c3a' : '2px solid transparent',
                  marginBottom:'-2px', fontSize:'0.95rem' }}>
                {t === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
              </button>
            ))}
          </div>

          {/* Formularz */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label style={{ display:'block', fontSize:'0.875rem', marginBottom:'0.4rem', color:'#374151' }}>
                Email
              </label>
              <input className="input" type="email" placeholder="twoj@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'0.875rem', marginBottom:'0.4rem', color:'#374151' }}>
                Hasło
              </label>
              <input className="input" type="password" placeholder="minimum 6 znaków"
                value={password} onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>

            {error && (
              <div style={{ padding:'0.75rem', background:'#fff5f5', border:'1px solid #fecaca',
                borderRadius:'0.75rem', fontSize:'0.875rem', color:'#dc2626' }}>
                {error}
              </div>
            )}

            <button onClick={handle} disabled={loading || !email || !password}
              className="btn-primary" style={{ width:'100%', padding:'0.875rem', fontSize:'1rem' }}>
              {loading ? '⏳ Ładowanie...' : tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
