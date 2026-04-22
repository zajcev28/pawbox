import { Link, useNavigate } from 'react-router-dom'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export default function Navbar({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const logout = async () => { await supabase.auth.signOut(); navigate('/') }

  return (
    <nav style={{background:'white', borderBottom:'1px solid #E8DFD0', position:'sticky', top:0, zIndex:50}}>
      <div style={{maxWidth:1024, margin:'0 auto', padding:'0 1rem', height:64, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <Link to="/" style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', color:'#144830', textDecoration:'none'}}>🐾 PawBox</Link>
        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
          <Link to="/quiz" style={{fontSize:'0.875rem', color:'#4b5563', textDecoration:'none'}}>Quiz</Link>
          {session ? (
            <>
              <Link to="/dashboard" style={{fontSize:'0.875rem', color:'#4b5563', textDecoration:'none'}}>Panel</Link>
              <Link to="/pets"     style={{fontSize:'0.875rem', color:'#4b5563', textDecoration:'none'}}>Pupile</Link>
              <button onClick={logout} style={{fontSize:'0.875rem', color:'#9ca3af', background:'none', border:'none', cursor:'pointer'}}>Wyloguj</button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary" style={{fontSize:'0.875rem', padding:'0.5rem 1rem'}}>Zaloguj się</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
