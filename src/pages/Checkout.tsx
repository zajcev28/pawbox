import { useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Checkout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const plan = sessionStorage.getItem('selectedPlan') || 'comfort'
  const products = JSON.parse(sessionStorage.getItem('selectedProducts') || '[]')
  const [address, setAddress] = useState({ street:'', city:'', postal:'' })
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 30)
    const { data: sub } = await supabase.from('subscriptions').insert({
      user_id: session.user.id,
      plan_type: plan,
      status: 'active',
      delivery_frequency_days: 30,
      next_delivery_date: nextDate.toISOString().split('T')[0],
    }).select().single()

    if (sub) {
      await supabase.from('subscription_items').insert(
        products.map((id: string) => ({ subscription_id: sub.id, product_id: id, quantity_g: 500 }))
      )
    }
    setSaving(false); setDone(true)
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  if (done) return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'5rem', marginBottom:'1rem'}}>🎉</div>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#1b5c3a'}}>Zamówienie przyjęte!</h1>
        <p style={{color:'#6b7280', marginTop:'0.5rem'}}>Twój PawBox jest w drodze 🐾</p>
        <p style={{color:'#9ca3af', fontSize:'0.875rem', marginTop:'0.5rem'}}>Za chwilę przejdziesz do panelu...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:500, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem'}}>Potwierdzenie zamówienia</h1>
        <div className="card" style={{marginBottom:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem'}}>Plan: <strong style={{textTransform:'capitalize'}}>{plan}</strong></h3>
          <p style={{color:'#6b7280', fontSize:'0.875rem'}}>Wybrano {products.length} karm · dostawa co 30 dni</p>
        </div>
        <div className="card" style={{marginBottom:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem'}}>Adres dostawy</h3>
          <div style={{display:'grid', gap:'0.75rem'}}>
            <input className="input" placeholder="Ulica i numer" value={address.street} onChange={e=>setAddress(a=>({...a,street:e.target.value}))} />
            <input className="input" placeholder="Kod pocztowy (00-000)" value={address.postal} onChange={e=>setAddress(a=>({...a,postal:e.target.value}))} />
            <input className="input" placeholder="Miasto" value={address.city} onChange={e=>setAddress(a=>({...a,city:e.target.value}))} />
          </div>
        </div>
        <button onClick={submit} disabled={saving || !address.street || !address.city} className="btn-primary" style={{width:'100%', padding:'1rem', fontSize:'1rem'}}>
          {saving ? 'Składam zamówienie...' : '✓ Złóż zamówienie'}
        </button>
      </div>
    </div>
  )
}
