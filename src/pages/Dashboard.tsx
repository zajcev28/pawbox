import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Pet, Subscription } from '../types'

export default function Dashboard({ session }: { session: Session }) {
  const [pets, setPets] = useState<Pet[]>([])
  const [sub, setSub] = useState<Subscription | null>(null)

  useEffect(() => {
    supabase.from('pets').select('*').eq('user_id', session.user.id).then(r => r.data && setPets(r.data))
    supabase.from('subscriptions').select('*').eq('user_id', session.user.id).eq('status','active').maybeSingle().then(r => r.data && setSub(r.data))
  }, [session])

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'0.5rem'}}>Cześć! 🐾</h1>
        <p style={{color:'#6b7280', marginBottom:'2rem'}}>Witaj w swoim panelu PawBox</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'1.5rem'}}>
          <div className="card">
            <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'1rem'}}>Moja subskrypcja</h2>
            {sub ? (
              <div>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
                  <span style={{fontSize:'1.75rem'}}>{sub.plan_type==='starter'?'🌱':sub.plan_type==='comfort'?'⭐':'💎'}</span>
                  <div>
                    <div style={{fontWeight:600, textTransform:'capitalize'}}>{sub.plan_type}</div>
                    <span style={{fontSize:'0.75rem', padding:'2px 8px', borderRadius:20, background:'#d9ede2', color:'#1b5c3a'}}>Aktywna</span>
                  </div>
                </div>
                {sub.next_delivery_date && <p style={{fontSize:'0.875rem', color:'#6b7280'}}>📦 Następna dostawa: <strong>{sub.next_delivery_date}</strong></p>}
                <Link to="/subscription" style={{display:'inline-block', marginTop:'1rem', color:'#1b5c3a', fontSize:'0.875rem'}}>Zarządzaj →</Link>
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'1.5rem 0'}}>
                <p style={{color:'#6b7280', marginBottom:'1rem'}}>Nie masz aktywnej subskrypcji</p>
                <Link to="/quiz" className="btn-primary" style={{fontSize:'0.875rem'}}>Zacznij quiz →</Link>
              </div>
            )}
          </div>
          <div className="card">
            <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'1rem'}}>Moje pupile</h2>
            {pets.length > 0 ? (
              <div>
                {pets.map(p => (
                  <div key={p.id} style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'#E8DFD0', borderRadius:'0.75rem', marginBottom:'0.5rem'}}>
                    <span style={{fontSize:'1.5rem'}}>{p.species==='cat'?'🐱':'🐶'}</span>
                    <div>
                      <div style={{fontWeight:600}}>{p.name}</div>
                      <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{p.weight_kg} kg · {p.age_group}</div>
                    </div>
                  </div>
                ))}
                <Link to="/pets" style={{fontSize:'0.875rem', color:'#1b5c3a'}}>Zarządzaj pupilami →</Link>
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'1.5rem 0'}}>
                <p style={{color:'#6b7280', marginBottom:'1rem'}}>Dodaj swojego pierwszego pupila</p>
                <Link to="/pets" className="btn-secondary" style={{fontSize:'0.875rem'}}>Dodaj pupila →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
