import { useCallback, useEffect, useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { gramsPerDelivery } from '../lib/order'

interface BoxItem {
  id: string
  pet_id: string | null
  quantity_g: number
  products: { nazwa: string; food_type: 'dry' | 'wet' } | null
  pets: { id: string; name: string; species: 'cat' | 'dog' } | null
}

interface Box {
  id: string
  plan_type: 'starter' | 'comfort' | 'premium'
  status: 'active' | 'paused' | 'cancelled'
  delivery_frequency_days: number
  next_delivery_date: string | null
  subscription_items: BoxItem[]
}

const PLAN_EMOJI = { starter: '🌱', comfort: '⭐', premium: '💎' }
const PLAN_NAME  = { starter: 'Podstawowy', comfort: 'Komfortowy', premium: 'Premium' }
const FIRST_DELIVERY_IN_DAYS = 3

const isoDate = (d: Date) => d.toISOString().split('T')[0]
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d) }
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' })
const fmtGrams = (g: number) => g >= 1000 ? `${(g / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg` : `${g} g`

function isPastOrToday(dateStr: string | null) {
  if (!dateStr) return true
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(dateStr) <= today
}

export default function SubscriptionPage({ session }: { session: Session }) {
  const [box, setBox]         = useState<Box | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [freq, setFreq]       = useState(30)

  const fetchBox = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        id, plan_type, status, delivery_frequency_days, next_delivery_date,
        subscription_items ( id, pet_id, quantity_g, products ( nazwa, food_type ), pets ( id, name, species ) )
      `)
      .eq('user_id', session.user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return { box: data as unknown as Box | null, failed: !!error }
  }, [session.user.id])

  const apply = ({ box: b, failed }: { box: Box | null; failed: boolean }) => {
    if (failed) setError('Nie udało się wczytać subskrypcji.')
    setBox(b)
    if (b) setFreq(b.delivery_frequency_days || 30)
    setLoading(false)
  }

  useEffect(() => {
    let alive = true
    fetchBox().then(r => { if (alive) apply(r) })
    return () => { alive = false }
  }, [fetchBox])

  // Wspólna obsługa akcji: blokada przycisków, komunikat błędu, odświeżenie
  const run = async (action: () => Promise<{ error: unknown } | void>) => {
    setBusy(true); setError('')
    try {
      const res = await action()
      if (res && res.error) throw res.error
    } catch {
      setError('Coś poszło nie tak — spróbuj ponownie.')
    }
    apply(await fetchBox())
    setBusy(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'#1b5c3a', fontFamily:'Lora,Georgia,serif' }}>Ładowanie...</p>
    </div>
  )

  if (!box) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem' }}>
      <div style={{ maxWidth:700, margin:'0 auto' }}>
        <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'2rem' }}>Mój box</h1>
        <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📦</div>
          <p style={{ color:'#6b7280', marginBottom:'1rem' }}>Nie masz aktywnej subskrypcji</p>
          <Link to="/quiz" className="btn-primary">Zacznij quiz →</Link>
        </div>
      </div>
    </div>
  )

  // Grupowanie karm po pupilu
  const groups = new Map<string, { pet: BoxItem['pets']; items: BoxItem[] }>()
  for (const it of box.subscription_items) {
    const key = it.pet_id ?? 'none'
    if (!groups.has(key)) groups.set(key, { pet: it.pets, items: [] })
    groups.get(key)!.items.push(it)
  }
  const totalGrams = box.subscription_items.reduce((s, i) => s + (i.quantity_g || 0), 0)

  const nextDates = (() => {
    if (!box.next_delivery_date || box.status !== 'active') return []
    const out: string[] = []
    let d = new Date(box.next_delivery_date)
    for (let i = 0; i < 3; i++) {
      out.push(fmtDate(isoDate(d)))
      d = new Date(d); d.setDate(d.getDate() + freq)
    }
    return out
  })()

  // Zmiana częstotliwości: przelicz gramy na dostawę, data następnej dostawy zostaje (chyba że minęła)
  const saveFrequency = () => run(async () => {
    const oldFreq = box.delivery_frequency_days || 30
    const { error } = await supabase.from('subscriptions').update({
      delivery_frequency_days: freq,
      ...(isPastOrToday(box.next_delivery_date) ? { next_delivery_date: addDays(freq) } : {}),
    }).eq('id', box.id)
    if (error) return { error }
    const results = await Promise.all(box.subscription_items.map(it =>
      supabase.from('subscription_items')
        .update({ quantity_g: gramsPerDelivery((it.quantity_g || 0) / oldFreq, freq) })
        .eq('id', it.id)
    ))
    return { error: results.find(r => r.error)?.error ?? null }
  })

  const pause  = () => run(async () => supabase.from('subscriptions').update({ status:'paused' }).eq('id', box.id))
  const resume = () => run(async () => supabase.from('subscriptions').update({
    status: 'active',
    ...(isPastOrToday(box.next_delivery_date) ? { next_delivery_date: addDays(FIRST_DELIVERY_IN_DAYS) } : {}),
  }).eq('id', box.id))

  const cancel = () => {
    if (!confirm('Na pewno anulować subskrypcję? Kolejne dostawy nie zostaną wysłane.')) return
    run(async () => supabase.from('subscriptions').update({ status:'cancelled' }).eq('id', box.id))
  }

  const removeItem = (it: BoxItem) => {
    if (!confirm(`Usunąć „${it.products?.nazwa ?? 'tę karmę'}” z boxa?`)) return
    run(async () => supabase.from('subscription_items').delete().eq('id', it.id))
  }

  const removePet = (petId: string, name: string) => {
    if (!confirm(`Usunąć wszystkie karmy dla: ${name}?`)) return
    run(async () => supabase.from('subscription_items').delete().eq('subscription_id', box.id).eq('pet_id', petId))
  }

  const statusBadge = box.status === 'active'
    ? { text:'Aktywna', bg:'#d9ede2', fg:'#1b5c3a' }
    : { text:'Wstrzymana', bg:'#fef3c7', fg:'#92400e' }

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem' }}>
      <div style={{ maxWidth:700, margin:'0 auto' }}>
        <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'1.5rem' }}>Mój box</h1>

        {error && (
          <div style={{ padding:'0.75rem', background:'#fff5f5', border:'1px solid #fecaca', borderRadius:'0.75rem', color:'#dc2626', fontSize:'0.875rem', marginBottom:'1rem' }}>
            {error}
          </div>
        )}

        {/* Plan i status */}
        <div className="card" style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
            <span style={{ fontSize:'2.5rem' }}>{PLAN_EMOJI[box.plan_type]}</span>
            <div style={{ flex:1, minWidth:160 }}>
              <h2 style={{ fontFamily:'Lora,Georgia,serif', margin:0 }}>Plan {PLAN_NAME[box.plan_type]}</h2>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginTop:'0.35rem', flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.75rem', padding:'2px 10px', borderRadius:20, background:statusBadge.bg, color:statusBadge.fg }}>
                  {statusBadge.text}
                </span>
                <span style={{ fontSize:'0.8rem', color:'#6b7280' }}>
                  {box.subscription_items.length} karm · {fmtGrams(totalGrams)} na dostawę
                </span>
              </div>
            </div>
            {box.next_delivery_date && box.status === 'active' && (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>Następna dostawa</div>
                <div style={{ fontWeight:700, color:'#1b5c3a' }}>{fmtDate(box.next_delivery_date)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Karmy per pupil */}
        <div className="card" style={{ marginBottom:'1rem' }}>
          <h3 style={{ fontFamily:'Lora,Georgia,serif', margin:'0 0 1rem', color:'#144830' }}>Zawartość boxa</h3>
          {groups.size === 0 && (
            <p style={{ color:'#6b7280', fontSize:'0.875rem', margin:0 }}>
              Box jest pusty. <Link to="/quiz" style={{ color:'#1b5c3a' }}>Dobierz karmy w quizie →</Link>
            </p>
          )}
          {[...groups.entries()].map(([key, { pet, items }]) => (
            <div key={key} style={{ padding:'0.75rem 0', borderTop:'1px solid #f3f4f6' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                <span style={{ fontSize:'1.4rem' }}>{pet ? (pet.species === 'cat' ? '🐱' : '🐶') : '🐾'}</span>
                <strong style={{ flex:1 }}>{pet?.name ?? 'Pupil nieprzypisany'}</strong>
                {pet && (
                  <>
                    <Link to={`/quiz?pet=${pet.id}`} style={{ fontSize:'0.8rem', color:'#1b5c3a' }}>Zmień zestaw</Link>
                    <button type="button" disabled={busy} onClick={() => removePet(pet.id, pet.name)}
                      style={{ fontSize:'0.8rem', color:'#9ca3af', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      Usuń z boxa
                    </button>
                  </>
                )}
              </div>
              {items.map(it => (
                <div key={it.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.45rem 0 0.45rem 2rem', fontSize:'0.875rem' }}>
                  <span title={it.products?.food_type === 'wet' ? 'Mokra' : 'Sucha'}>{it.products?.food_type === 'wet' ? '💧' : '🥜'}</span>
                  <span style={{ flex:1, color:'#374151' }}>{it.products?.nazwa ?? 'Karma niedostępna'}</span>
                  <span style={{ color:'#6b7280', whiteSpace:'nowrap' }}>{fmtGrams(it.quantity_g || 0)}</span>
                  <button type="button" disabled={busy} onClick={() => removeItem(it)} aria-label="Usuń karmę"
                    style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'1rem', padding:'0 0.25rem' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}
          <Link to="/quiz" style={{ display:'inline-block', marginTop:'0.75rem', fontSize:'0.85rem', color:'#1b5c3a' }}>
            + Dodaj karmy dla kolejnego pupila
          </Link>
        </div>

        {/* Częstotliwość */}
        <div className="card" style={{ marginBottom:'1rem' }}>
          <label htmlFor="freq" style={{ fontSize:'0.875rem', display:'block', marginBottom:'0.5rem' }}>
            Częstotliwość dostaw: co <strong>{freq}</strong> dni
          </label>
          <input id="freq" type="range" min={7} max={60} value={freq}
            onChange={e => setFreq(parseInt(e.target.value))}
            style={{ width:'100%', accentColor:'#1b5c3a' }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af' }}>
            <span>7 dni</span><span>60 dni</span>
          </div>
          {freq !== box.delivery_frequency_days && (
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginTop:'0.75rem', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.8rem', color:'#6b7280', flex:1 }}>Ilość karmy w każdej dostawie zostanie przeliczona.</span>
              <button type="button" className="btn-secondary" onClick={() => setFreq(box.delivery_frequency_days)} disabled={busy}
                style={{ padding:'0.4rem 0.9rem', fontSize:'0.8rem' }}>Anuluj</button>
              <button type="button" className="btn-primary" onClick={saveFrequency} disabled={busy}
                style={{ padding:'0.4rem 0.9rem', fontSize:'0.8rem' }}>Zapisz</button>
            </div>
          )}
          {nextDates.length > 0 && (
            <div style={{ marginTop:'0.75rem', padding:'0.75rem', background:'#f0f7f3', borderRadius:'0.75rem' }}>
              <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#1b5c3a', margin:'0 0 0.4rem' }}>Planowane dostawy:</p>
              {nextDates.map((d, i) => (
                <div key={d} style={{ fontSize:'0.8rem', color:'#374151', padding:'0.2rem 0', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <span>📦</span>
                  <span>{i === 0 ? <strong>{d}</strong> : d}</span>
                  {i === 0 && <span style={{ fontSize:'0.7rem', background:'#1b5c3a', color:'white', padding:'1px 6px', borderRadius:10 }}>następna</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Akcje */}
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          {box.status === 'active' ? (
            <button type="button" onClick={pause} disabled={busy} className="btn-secondary" style={{ flex:1 }}>
              ⏸ Wstrzymaj dostawy
            </button>
          ) : (
            <button type="button" onClick={resume} disabled={busy} className="btn-primary" style={{ flex:1 }}>
              ▶ Wznów dostawy
            </button>
          )}
          <button type="button" onClick={cancel} disabled={busy}
            style={{ flex:1, padding:'0.75rem', borderRadius:'0.75rem', border:'1px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer' }}>
            Anuluj subskrypcję
          </button>
        </div>
      </div>
    </div>
  )
}
