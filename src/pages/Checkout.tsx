import { useState, useEffect } from 'react'
import { type Session } from '@supabase/supabase-js'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadPendingOrder, clearOrderState, gramsPerDelivery, PLAN_RANK, type PendingOrder } from '../lib/order'
import type { PetProfile } from '../types'

// Model: jeden box (subskrypcja) na użytkownika, każda karma przypisana do pupila.
// Zamówienie dla kolejnego pupila dopisuje jego karmy do istniejącego boxa
// i podmienia wyłącznie karmy TEGO pupila — karmy pozostałych pupili zostają.

const PLAN_NAME = { starter: 'Podstawowy', comfort: 'Komfortowy', premium: 'Premium' }
const FIRST_DELIVERY_IN_DAYS = 3

type Result = { kind: 'new' | 'added'; petName: string; frequency: number; resumed: boolean }

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function resolvePet(userId: string, profile: PetProfile): Promise<string> {
  const fields = {
    name:              profile.name.trim(),
    species:           profile.species,
    age_group:         profile.age_group || 'adult',
    weight_kg:         profile.weight_kg || 4,
    activity_level:    profile.activity_level || 'medium',
    health_conditions: profile.health_conditions || [],
    allergies:         profile.allergies || [],
    food_type:         profile.food_type || 'mixed',
  }

  // 1. Quiz uruchomiony z istniejącego pupila, albo 2. pupil o tym samym imieniu i gatunku
  let petId = profile.pet_id ?? null
  if (!petId) {
    const { data } = await supabase
      .from('pets').select('id')
      .eq('user_id', userId).eq('species', fields.species)
      .ilike('name', fields.name.replace(/[%_\\]/g, '\\$&')) // dokładne dopasowanie bez względu na wielkość liter
      .limit(1).maybeSingle()
    petId = data?.id ?? null
  }

  if (petId) {
    // Profil z quizu jest najświeższy — aktualizujemy pupila zamiast tworzyć duplikat
    const { error } = await supabase.from('pets').update(fields).eq('id', petId).eq('user_id', userId)
    if (error) throw new Error('Nie udało się zaktualizować pupila: ' + error.message)
    return petId
  }

  const { data, error } = await supabase
    .from('pets').insert({ ...fields, user_id: userId }).select('id').single()
  if (error || !data) throw new Error('Nie udało się zapisać pupila: ' + (error?.message ?? ''))
  return data.id
}

export default function Checkout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const [order] = useState<PendingOrder | null>(() => loadPendingOrder())

  const [address, setAddress] = useState({ street: '', city: '', postal: '' })
  const [existingBox, setExistingBox] = useState<{ frequency: number; status: string } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    const userId = session.user.id
    supabase.from('user_profiles').select('street, city, postal_code').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (data?.street) setAddress({ street: data.street, city: data.city || '', postal: data.postal_code || '' })
      })
    supabase.from('subscriptions').select('delivery_frequency_days, status')
      .eq('user_id', userId).neq('status', 'cancelled').limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) setExistingBox({ frequency: data.delivery_frequency_days || 30, status: data.status })
      })
  }, [session.user.id])

  if (!order) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div className="card" style={{ textAlign:'center', maxWidth:420 }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🐾</div>
        <p style={{ color:'#6b7280', marginBottom:'1.5rem' }}>Brak zamówienia do potwierdzenia — zacznij od quizu.</p>
        <Link to="/quiz" className="btn-primary">Zacznij quiz →</Link>
      </div>
    </div>
  )

  const items = order.items.filter(i => !i.product_id.startsWith('seed-'))
  const frequency = existingBox?.frequency ?? order.period_days

  const submit = async () => {
    if (!address.street.trim() || !address.city.trim() || !address.postal.trim()) {
      setError('Uzupełnij wszystkie pola adresu')
      return
    }
    if (items.length === 0) {
      setError('Zestaw nie zawiera żadnej karmy z katalogu — wróć do rekomendacji')
      return
    }
    setSaving(true)
    setError('')
    const userId = session.user.id

    try {
      // 1. Adres
      const { error: addrErr } = await supabase.from('user_profiles').upsert({
        id: userId, street: address.street.trim(), city: address.city.trim(), postal_code: address.postal.trim(),
      })
      if (addrErr) throw new Error('Nie udało się zapisać adresu: ' + addrErr.message)

      // 2. Pupil (bez duplikatów)
      const petId = await resolvePet(userId, order.profile)

      // 3. Box: istniejący albo nowy
      const { data: open } = await supabase
        .from('subscriptions').select('id, plan_type, status, delivery_frequency_days')
        .eq('user_id', userId).neq('status', 'cancelled').limit(1).maybeSingle()

      let subId: string
      let freq: number
      let kind: Result['kind']
      let resumed = false

      if (open) {
        subId = open.id
        freq  = open.delivery_frequency_days || 30
        kind  = 'added'
        const plan = PLAN_RANK[order.plan] > PLAN_RANK[open.plan_type as PendingOrder['plan']] ? order.plan : open.plan_type
        resumed = open.status === 'paused'
        const { error: upErr } = await supabase.from('subscriptions')
          .update({ plan_type: plan, status: 'active' }).eq('id', subId)
        if (upErr) throw new Error('Nie udało się zaktualizować boxa: ' + upErr.message)
      } else {
        freq = order.period_days
        kind = 'new'
        const { data: created, error: subErr } = await supabase.from('subscriptions').insert({
          user_id:                 userId,
          pet_id:                  petId,
          plan_type:               order.plan,
          status:                  'active',
          delivery_frequency_days: freq,
          next_delivery_date:      addDays(FIRST_DELIVERY_IN_DAYS),
        }).select('id').single()
        if (subErr || !created) throw new Error('Nie udało się utworzyć subskrypcji: ' + (subErr?.message ?? ''))
        subId = created.id
      }

      // 4. Podmień karmy TYLKO tego pupila
      const { error: delErr } = await supabase.from('subscription_items')
        .delete().eq('subscription_id', subId).eq('pet_id', petId)
      if (delErr) throw new Error('Nie udało się zaktualizować karm: ' + delErr.message)

      const { error: insErr } = await supabase.from('subscription_items').insert(
        items.map(i => ({
          subscription_id: subId,
          pet_id:          petId,
          product_id:      i.product_id,
          quantity_g:      gramsPerDelivery(i.grams_per_day, freq),
          is_active:       true,
        }))
      )
      if (insErr) throw new Error('Nie udało się zapisać karm: ' + insErr.message)

      // 5. Mail tylko dla nowego boxa
      if (kind === 'new') {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ type: 'order_confirmation', subscriptionId: subId }),
        }).catch(e => console.error('Mail error:', e))
      }

      clearOrderState()
      setResult({ kind, petName: order.profile.name, frequency: freq, resumed })
      setTimeout(() => navigate('/dashboard'), 3500)
    } catch (e) {
      console.error('Checkout error:', e)
      setError(e instanceof Error ? e.message : 'Coś poszło nie tak')
    } finally {
      setSaving(false)
    }
  }

  if (result) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', padding:'2rem', maxWidth:480 }}>
        <div style={{ fontSize:'5rem', marginBottom:'1rem' }}>🎉</div>
        <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', color:'#1b5c3a' }}>
          {result.kind === 'new' ? 'Zamówienie przyjęte!' : 'Box zaktualizowany!'}
        </h1>
        <p style={{ color:'#6b7280', marginTop:'0.5rem' }}>
          {result.kind === 'new'
            ? <>Twój PawBox dla <strong>{result.petName}</strong> jest w drodze 🐾</>
            : <>Karmy dla <strong>{result.petName}</strong> dołączyły do Twojego boxa (dostawa co {result.frequency} dni).</>}
        </p>
        {result.resumed && (
          <p style={{ color:'#92400e', fontSize:'0.875rem', marginTop:'0.5rem' }}>Wstrzymany box został wznowiony.</p>
        )}
        <p style={{ color:'#9ca3af', fontSize:'0.875rem', marginTop:'0.5rem' }}>Za chwilę przejdziesz do panelu...</p>
      </div>
    </div>
  )

  const label: React.CSSProperties = { display:'block', fontSize:'0.875rem', marginBottom:'0.3rem', color:'#374151' }
  const box: React.CSSProperties = { background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.25rem', marginBottom:'1.5rem' }

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem' }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem' }}>Potwierdzenie zamówienia</h1>

        {/* Pupil */}
        <div style={{ ...box, display:'flex', alignItems:'center', gap:'1rem' }}>
          <span style={{ fontSize:'2.5rem' }}>{order.profile.species === 'cat' ? '🐱' : '🐶'}</span>
          <div>
            <div style={{ fontWeight:600 }}>{order.profile.name}</div>
            <div style={{ fontSize:'0.875rem', color:'#6b7280' }}>
              {order.profile.weight_kg} kg · plan <strong style={{ color:'#1b5c3a' }}>{PLAN_NAME[order.plan]}</strong>
            </div>
          </div>
        </div>

        {/* Zestaw */}
        <div style={box}>
          <h3 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 0.75rem' }}>🐾 Karmy w zestawie</h3>
          {items.map(i => (
            <div key={i.product_id} style={{ display:'flex', justifyContent:'space-between', gap:'0.75rem', fontSize:'0.85rem', padding:'0.35rem 0', borderBottom:'1px solid #f3f4f6' }}>
              <span style={{ color:'#374151' }}>{i.nazwa}</span>
              <span style={{ color:'#1b5c3a', fontWeight:600, whiteSpace:'nowrap' }}>
                {i.grams_per_day} g/dzień · {(gramsPerDelivery(i.grams_per_day, frequency) / 1000).toFixed(1)} kg/dostawę
              </span>
            </div>
          ))}
          <p style={{ fontSize:'0.8rem', color:'#6b7280', margin:'0.75rem 0 0' }}>
            {existingBox
              ? <>Karmy dołączą do Twojego obecnego boxa, dostarczanego co <strong>{existingBox.frequency} dni</strong>. Karmy pozostałych pupili zostaną bez zmian.</>
              : <>Dostawa co <strong>{order.period_days} dni</strong>, pierwsza za {FIRST_DELIVERY_IN_DAYS} dni.</>}
          </p>
        </div>

        {/* Adres */}
        <div style={box}>
          <h3 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 1rem' }}>📦 Adres dostawy</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div>
              <label style={label}>Ulica i numer</label>
              <input className="input" placeholder="np. Marszałkowska 1/2"
                value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(110px,140px) 1fr', gap:'0.75rem' }}>
              <div>
                <label style={label}>Kod pocztowy</label>
                <input className="input" placeholder="00-000"
                  value={address.postal} onChange={e => setAddress(a => ({ ...a, postal: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Miasto</label>
                <input className="input" placeholder="Warszawa"
                  value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding:'0.75rem', background:'#fff5f5', border:'1px solid #fecaca', borderRadius:'0.75rem', fontSize:'0.875rem', color:'#dc2626', marginBottom:'1rem' }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={saving} className="btn-primary" style={{ width:'100%', padding:'1rem', fontSize:'1rem' }}>
          {saving ? '⏳ Zapisuję...' : existingBox ? '✓ Dodaj do mojego boxa' : '✓ Złóż zamówienie'}
        </button>
      </div>
    </div>
  )
}
