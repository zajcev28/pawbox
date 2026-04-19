import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Subscription } from '../types'
import { Link } from 'react-router-dom'

export default function SubscriptionPage({ session }: { session: Session }) {
  const [sub, setSub] = useState<Subscription | null>(null)

  useEffect(() => {
    supabase.from('subscriptions').select('*').eq('user_id', session.user.id).eq('status','active').maybeSingle().then(r => r.data && setSub(r.data))
  }, [session])

  const pause = async () => {
    if (!sub) return
    await supabase.from('subscriptions').update({ status:'paused' }).eq('id', sub.id)
    setSub(s => s ? {...s, status:'paused'} : s)
  }

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:700, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem'}}>Moja subskrypcja</h1>
        {sub ? (
          <div className="card">
            <div style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem'}}>
              <span style={{fontSize:'2.5rem'}}>{sub.plan_type==='starter'?'🌱':sub.plan_type==='comfort'?'⭐':'💎'}</span>
              <div>
                <h2 style={{fontFamily:'Lora,Georgia,serif', textTransform:'capitalize'}}>{sub.plan_type}</h2>
                <span style={{fontSize:'0.75rem', padding:'2px 10px', borderRadius:20, background: sub.status==='active'?'#d9ede2':'#f3f4f6', color:sub.status==='active'?'#1b5c3a':'#6b7280'}}>
                  {sub.status==='active'?'Aktywna':'Wstrzymana'}
                </span>
              </div>
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{fontSize:'0.875rem', display:'block', marginBottom:'0.5rem'}}>
                Częstotliwość dostaw: co <strong>{sub.delivery_frequency_days}</strong> dni
              </label>
              <input type="range" min={7} max={60} value={sub.delivery_frequency_days}
                onChange={async e => {
                  const v = parseInt(e.target.value)
                  setSub(s => s ? {...s, delivery_frequency_days:v} : s)
                  await supabase.from('subscriptions').update({delivery_frequency_days:v}).eq('id',sub.id)
                }}
                style={{width:'100%', accentColor:'#1b5c3a'}} />
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af'}}>
                <span>7 dni</span><span>60 dni</span>
              </div>
            </div>
            {sub.status==='active' && (
              <button onClick={pause} className="btn-secondary" style={{width:'100%', marginTop:'1rem'}}>
                Wstrzymaj subskrypcję
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{textAlign:'center', padding:'3rem'}}>
            <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📦</div>
            <p style={{color:'#6b7280', marginBottom:'1rem'}}>Nie masz aktywnej subskrypcji</p>
            <Link to="/quiz" className="btn-primary">Zacznij quiz →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
