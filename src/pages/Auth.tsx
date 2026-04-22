import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { type Session } from '@supabase/supabase-js'
import { Navigate } from 'react-router-dom'

export default function AuthPage({ session }: { session: Session | null }) {
  if (session) return <Navigate to="/dashboard" replace />
  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
      <div style={{width:'100%', maxWidth:440}}>
        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#144830'}}>🐾 PawBox</h1>
          <p style={{color:'#6b7280', marginTop:'0.5rem'}}>Zaloguj się lub utwórz konto</p>
        </div>
        <div className="card">
          <Auth supabaseClient={supabase}
            appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand:'#1B5C3A', brandAccent:'#144830' }}}}}
            providers={[]}
            redirectTo={window.location.origin + '/dashboard'}
          />
        </div>
      </div>
    </div>
  )
}
