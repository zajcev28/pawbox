import { useEffect, useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Subscription } from '../types'
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

  const updateFrequency = async (days: number) => {
    if (!sub) return
    setSub(s => s ? {...s, delivery_frequency_days: days} : s)

    // Przelicz next_delivery_date tylko jeśli jest w przeszłości lub dziś
    const today = new Date()
    today.setHours(0,0,0,0)
    const nextDate = sub.next_delivery_date ? new Date(sub.next_delivery_date) : null

    let newNextDate = sub.next_delivery_date

    if (!nextDate || nextDate <= today) {
      // Data minęła — ustaw od dziś + nowa częstotliwość
      const d = new Date()
      d.setDate(d.getDate() + days)
      newNextDate = d.toISOString().split('T')[0]
    }
    // Jeśli data jest w przyszłości — nie ruszamy jej, tylko zmieniamy częstotliwość

    await supabase.from('subscriptions').update({
      delivery_frequency_days: days,
      next_delivery_date: newNextDate,
    }).eq('id', sub.id)

    setSub(s => s ? {...s, delivery_frequency_days: days, next_delivery_date: newNextDate} : s)
  }

  // Oblicz kolejne 3 daty dostaw
  const getNextDates = () => {
    if (!sub?.next_delivery_date) return []
    const dates = []
    const freq = sub.delivery_frequency_days || 30
    let d = new Date(sub.next_delivery_date)
    for (let i = 0; i < 3; i++) {
      dates.push(d.toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' }))
      d = new Date(d)
      d.setDate(d.getDate() + freq)
    }
    return dates
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
                onChange={e => updateFrequency(parseInt(e.target.value))}
                style={{width:'100%', accentColor:'#1b5c3a'}} />
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af'}}>
                <span>7 dni</span><span>60 dni</span>
              </div>
              {/* Kolejne daty dostaw */}
              <div style={{marginTop:'0.75rem', padding:'0.75rem', background:'#f0f7f3', borderRadius:'0.75rem'}}>
                <p style={{fontSize:'0.75rem', fontWeight:600, color:'#1b5c3a', margin:'0 0 0.4rem'}}>
                  Planowane dostawy:
                </p>
                {getNextDates().map((d, i) => (
                  <div key={i} style={{fontSize:'0.8rem', color:'#374151', padding:'0.2rem 0', display:'flex', alignItems:'center', gap:'0.5rem'}}>
                    <span style={{color:'#1b5c3a'}}>{'📦'}</span>
                    <span>{i === 0 ? <strong>{d}</strong> : d}</span>
                    {i === 0 && <span style={{fontSize:'0.7rem', background:'#1b5c3a', color:'white', padding:'1px 6px', borderRadius:10}}>następna</span>}
                  </div>
                ))}
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
