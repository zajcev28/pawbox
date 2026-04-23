import { useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Checkout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const plan     = sessionStorage.getItem('selectedPlan') || 'comfort'
  const products = JSON.parse(sessionStorage.getItem('selectedProducts') || '[]')
  const profile  = JSON.parse(sessionStorage.getItem('quizProfile') || '{}')

  const [address, setAddress] = useState({ street: '', city: '', postal: '' })
  const [done,    setDone]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const submit = async () => {
    if (!address.street || !address.city || !address.postal) {
      setError('Uzupełnij wszystkie pola adresu')
      return
    }
    setSaving(true)
    setError('')

    try {
      // 1. Zapisz adres do profilu użytkownika
      await supabase.from('user_profiles').upsert({
        id:          session.user.id,
        street:      address.street,
        city:        address.city,
        postal_code: address.postal,
      })

      // 2. Zapisz pupila jeśli mamy profil z quizu
      let petId: string | null = null
      if (profile.name && profile.species) {
        const { data: pet } = await supabase
          .from('pets')
          .insert({
            user_id:           session.user.id,
            name:              profile.name,
            species:           profile.species,
            age_group:         profile.age_group     || 'adult',
            weight_kg:         profile.weight_kg     || 4,
            activity_level:    profile.activity_level || 'medium',
            health_conditions: profile.health_conditions || [],
            allergies:         profile.allergies     || [],
            food_type:         profile.food_type     || 'mixed',
          })
          .select()
          .single()
        petId = pet?.id || null
      }

      // 3. Utwórz subskrypcję
      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + 30)

      const { data: sub } = await supabase
        .from('subscriptions')
        .insert({
          user_id:                session.user.id,
          pet_id:                 petId,
          plan_type:              plan,
          status:                 'active',
          delivery_frequency_days: 30,
          next_delivery_date:     nextDate.toISOString().split('T')[0],
        })
        .select()
        .single()

      // 4. Zapisz pozycje subskrypcji
      if (sub && products.length > 0) {
        await supabase.from('subscription_items').insert(
          products.map((id: string) => ({
            subscription_id: sub.id,
            product_id:      id.startsWith('seed-') ? null : id,
            quantity_g:      500,
            is_active:       true,
          }))
        )
      }

      // 5. Wyczyść sessionStorage
      sessionStorage.removeItem('quizProfile')
      sessionStorage.removeItem('selectedPlan')
      sessionStorage.removeItem('selectedProducts')
      sessionStorage.removeItem('boxItems')

      setDone(true)
      setTimeout(() => navigate('/dashboard'), 3000)

    } catch (e) {
      setError('Coś poszło nie tak. Spróbuj ponownie.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Ekran sukcesu
  if (done) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', padding:'2rem' }}>
        <div style={{ fontSize:'5rem', marginBottom:'1rem' }}>🎉</div>
        <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#1b5c3a' }}>
          Zamówienie przyjęte!
        </h1>
        <p style={{ color:'#6b7280', marginTop:'0.5rem' }}>
          Twój PawBox dla <strong>{profile.name || 'pupila'}</strong> jest w drodze 🐾
        </p>
        <p style={{ color:'#9ca3af', fontSize:'0.875rem', marginTop:'0.5rem' }}>
          Za chwilę przejdziesz do panelu...
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem' }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem' }}>
          Potwierdzenie zamówienia
        </h1>

        {/* Podsumowanie pupila */}
        {profile.name && (
          <div style={{ background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.25rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'1rem' }}>
            <span style={{ fontSize:'2.5rem' }}>{profile.species === 'cat' ? '🐱' : '🐶'}</span>
            <div>
              <div style={{ fontWeight:600 }}>{profile.name}</div>
              <div style={{ fontSize:'0.875rem', color:'#6b7280' }}>
                {profile.weight_kg} kg · plan <strong style={{ textTransform:'capitalize' }}>{plan}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Adres dostawy */}
        <div style={{ background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.5rem', marginBottom:'1.5rem' }}>
          <h3 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 1rem' }}>
            📦 Adres dostawy
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div>
              <label style={{ display:'block', fontSize:'0.875rem', marginBottom:'0.3rem', color:'#374151' }}>
                Ulica i numer
              </label>
              <input className="input" placeholder="np. Marszałkowska 1/2"
                value={address.street}
                onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:'0.75rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'0.875rem', marginBottom:'0.3rem', color:'#374151' }}>
                  Kod pocztowy
                </label>
                <input className="input" placeholder="00-000"
                  value={address.postal}
                  onChange={e => setAddress(a => ({ ...a, postal: e.target.value }))} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'0.875rem', marginBottom:'0.3rem', color:'#374151' }}>
                  Miasto
                </label>
                <input className="input" placeholder="Warszawa"
                  value={address.city}
                  onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        {/* Wybrane karmy */}
        <div style={{ background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.5rem', marginBottom:'1.5rem' }}>
          <h3 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 0.75rem' }}>
            🐾 Twój zestaw
          </h3>
          <div style={{ fontSize:'0.875rem', color:'#6b7280' }}>
            {products.length} karm · dostawa co 30 dni · plan <strong style={{ textTransform:'capitalize', color:'#1b5c3a' }}>{plan}</strong>
          </div>
        </div>

        {error && (
          <div style={{ padding:'0.75rem', background:'#fff5f5', border:'1px solid #fecaca', borderRadius:'0.75rem', fontSize:'0.875rem', color:'#dc2626', marginBottom:'1rem' }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={saving}
          className="btn-primary"
          style={{ width:'100%', padding:'1rem', fontSize:'1rem' }}>
          {saving ? '⏳ Składam zamówienie...' : '✓ Złóż zamówienie'}
        </button>
      </div>
    </div>
  )
}
