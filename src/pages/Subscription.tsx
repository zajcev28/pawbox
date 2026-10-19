import { useCallback, useEffect, useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { gramsPerDelivery } from '../lib/order'
import { calculateDailyCalories, gramsForKcal, parseKcal, MAX_GRAMS_PER_DAY } from '../lib/recommender'
import { priceBox, fmtPLN, fmtPack } from '../lib/pricing'
import { syncBoxTier } from '../lib/box'
import ProductCatalog from '../components/ProductCatalog'
import TierStatus from '../components/TierStatus'
import type { Pet, PetProfile, ScoredProduct } from '../types'

interface BoxItem {
  id: string
  pet_id: string | null
  quantity_g: number
  products: { id: string; nazwa: string; cena: number | null; food_type: 'dry' | 'wet'; energia: string | null } | null
  pets: Pet | null
}

// Okno wyboru: zamiana konkretnej karmy albo dodanie nowej dla pupila
type PickerState = { mode: 'swap'; item: BoxItem; pet: Pet } | { mode: 'add'; pet: Pet; items: BoxItem[] }

interface Box {
  id: string
  plan_type: 'starter' | 'comfort' | 'premium'
  status: 'active' | 'paused' | 'cancelled'
  delivery_frequency_days: number
  next_delivery_date: string | null
  subscription_items: BoxItem[]
}

const petProfile = (pet: Pet): PetProfile => ({
  pet_id: pet.id, name: pet.name, species: pet.species, age_group: pet.age_group,
  weight_kg: Number(pet.weight_kg) || 4, activity_level: pet.activity_level,
  health_conditions: pet.health_conditions ?? [], allergies: pet.allergies ?? [], food_type: pet.food_type ?? 'mixed',
})
const FIRST_DELIVERY_IN_DAYS = 3

const isoDate = (d: Date) => d.toISOString().split('T')[0]
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d) }
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' })
const fmtGrams = (g: number) => g >= 1000 ? `${(g / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg` : `${g} g`

const kcalPer100 = (it: BoxItem) => parseKcal(it.products?.energia ?? null, it.products?.food_type ?? 'dry')

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
  const [picker, setPicker]   = useState<PickerState | null>(null)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)

  const fetchBox = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        id, plan_type, status, delivery_frequency_days, next_delivery_date,
        subscription_items ( id, pet_id, quantity_g, products ( id, nazwa, cena, food_type, energia ), pets ( * ) )
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
    if (box) await syncBoxTier(box.id)   // status wynika z zawartości boxa
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
  const pricing = priceBox(box.subscription_items.filter(i => i.products).map(i => ({
    nazwa: i.products!.nazwa, cena: i.products!.cena, food_type: i.products!.food_type, quantity_g: i.quantity_g,
  })), box.delivery_frequency_days || 30)
  const lineFor = new Map(box.subscription_items.filter(i => i.products).map((i, k) => [i.id, pricing.lines[k]]))

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

  // ── Karmy ────────────────────────────────────────────────────────────────
  // Porcje liczymy w kaloriach: przy zamianie nowa karma przejmuje kalorie starej,
  // przy dodaniu/usunięciu pozostałe porcje są skalowane, żeby dzienna suma się nie zmieniła.
  const days = box.delivery_frequency_days || 30
  const gpd  = (it: BoxItem) => (it.quantity_g || 0) / days
  const kcalOf = (it: BoxItem) => gpd(it) * kcalPer100(it) / 100
  const qty = (gramsPerDay: number) => gramsPerDelivery(Math.min(MAX_GRAMS_PER_DAY, gramsPerDay), days)

  const updateQty = (id: string, quantity_g: number) =>
    supabase.from('subscription_items').update({ quantity_g }).eq('id', id)

  const firstError = (rs: { error: unknown }[]) => ({ error: rs.find(r => r.error)?.error ?? null })

  const swapItem = (it: BoxItem, p: ScoredProduct) => run(async () => {
    const kcal = kcalOf(it)
    const newGpd = kcal > 0 ? gramsForKcal(kcal, p.energia, p.food_type) : p.daily_grams
    return supabase.from('subscription_items')
      .update({ product_id: p.id, quantity_g: qty(newGpd) })
      .eq('id', it.id)
  })

  const addItem = (pet: Pet, items: BoxItem[], p: ScoredProduct) => run(async () => {
    const n = items.length
    const total = items.reduce((s, i) => s + kcalOf(i), 0)
      || calculateDailyCalories(Number(pet.weight_kg) || 4, pet.age_group, pet.activity_level, pet.species)
    const share = total / (n + 1)
    const scaled = await Promise.all(items.map(i => updateQty(i.id, qty(gpd(i) * n / (n + 1)))))
    const ins = await supabase.from('subscription_items').insert({
      subscription_id: box.id, product_id: p.id, pet_id: pet.id, is_active: true,
      quantity_g: qty(gramsForKcal(share, p.energia, p.food_type)),
    })
    return firstError([...scaled, ins])
  })

  const removeItem = (it: BoxItem, siblings: BoxItem[]) => {
    const rest = siblings.filter(s => s.id !== it.id)
    const msg = rest.length
      ? `Usunąć „${it.products?.nazwa ?? 'tę karmę'}”? Porcje pozostałych karm zostaną zwiększone.`
      : `Usunąć „${it.products?.nazwa ?? 'tę karmę'}” z boxa?`
    if (!confirm(msg)) return
    run(async () => {
      const del = await supabase.from('subscription_items').delete().eq('id', it.id)
      if (del.error || rest.length === 0) return del
      const restKcal = rest.reduce((s, i) => s + kcalOf(i), 0)
      const factor = restKcal > 0 ? (restKcal + kcalOf(it)) / restKcal : 1
      return firstError(await Promise.all(rest.map(i => updateQty(i.id, qty(gpd(i) * factor)))))
    })
  }

  const saveGrams = () => {
    if (!editing) return
    const g = Math.round(Number(editing.value.replace(',', '.')))
    if (!Number.isFinite(g) || g < 1 || g > MAX_GRAMS_PER_DAY) {
      setError(`Porcja musi mieć od 1 do ${MAX_GRAMS_PER_DAY} g dziennie.`)
      return
    }
    const id = editing.id
    setEditing(null)
    run(async () => updateQty(id, qty(g)))
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

        {/* Status i koszt */}
        <div className="card" style={{ marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'0.9rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.75rem', padding:'2px 10px', borderRadius:20, background:statusBadge.bg, color:statusBadge.fg }}>
              {statusBadge.text}
            </span>
            <span style={{ fontSize:'0.85rem', color:'#6b7280', flex:1 }}>
              {box.subscription_items.length} karm · co {box.delivery_frequency_days} dni
            </span>
            {box.next_delivery_date && box.status === 'active' && (
              <span style={{ fontSize:'0.85rem', color:'#374151' }}>
                Następna dostawa: <strong style={{ color:'#1b5c3a' }}>{fmtDate(box.next_delivery_date)}</strong>
              </span>
            )}
          </div>
          <TierStatus pricing={pricing} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:'0.5rem' }}>
            <span style={{ fontSize:'0.85rem', color:'#6b7280' }}>
              Karmy {fmtPLN(pricing.foodTotal)}
              {pricing.discountPLN > 0 && <> · rabat −{fmtPLN(pricing.discountPLN)}</>}
              {' · '}dostawa {pricing.shipping === 0 ? 'gratis' : fmtPLN(pricing.shipping)}
            </span>
            <span style={{ fontSize:'1.1rem', fontWeight:700, color:'#1b5c3a' }}>
              {fmtPLN(pricing.total)} <span style={{ fontSize:'0.75rem', color:'#6b7280', fontWeight:400 }}>/ dostawa · ≈ {fmtPLN(pricing.totalMonthly)} / mies.</span>
            </span>
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
                    <Link to={`/quiz?pet=${pet.id}`} style={{ fontSize:'0.8rem', color:'#1b5c3a' }}>Nowy quiz</Link>
                    <button type="button" disabled={busy} onClick={() => removePet(pet.id, pet.name)}
                      style={{ fontSize:'0.8rem', color:'#9ca3af', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      Usuń z boxa
                    </button>
                  </>
                )}
              </div>
              {items.map(it => {
                const daily = Math.round(gpd(it))
                const isEditing = editing?.id === it.id
                return (
                  <div key={it.id} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.55rem 0 0.55rem 2rem', fontSize:'0.875rem', flexWrap:'wrap' }}>
                    <span title={it.products?.food_type === 'wet' ? 'Mokra' : 'Sucha'}>{it.products?.food_type === 'wet' ? '💧' : '🥜'}</span>
                    <span style={{ flex:'1 1 200px', color:'#374151', minWidth:0 }}>
                      {it.products?.nazwa ?? 'Karma niedostępna'}
                      <span style={{ display:'block', fontSize:'0.75rem', color:'#6b7280' }}>
                        {isEditing ? (
                          <span style={{ display:'inline-flex', gap:'0.35rem', alignItems:'center' }}>
                            <input type="number" min={1} max={MAX_GRAMS_PER_DAY} value={editing.value} autoFocus
                              onChange={e => setEditing({ id: it.id, value: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveGrams(); if (e.key === 'Escape') setEditing(null) }}
                              style={{ width:70, padding:'0.15rem 0.35rem', border:'1px solid #E8DFD0', borderRadius:6 }} />
                            g/dzień
                            <button type="button" onClick={saveGrams} disabled={busy} style={linkBtn('#1b5c3a')}>Zapisz</button>
                            <button type="button" onClick={() => setEditing(null)} style={linkBtn('#9ca3af')}>Anuluj</button>
                          </span>
                        ) : (
                          <>
                            {daily} g/dzień · {lineFor.get(it.id) ? `${lineFor.get(it.id)!.packs} × op. ${fmtPack(lineFor.get(it.id)!.pack.grams)} · ${fmtPLN(lineFor.get(it.id)!.price)}` : fmtGrams(it.quantity_g || 0)}{' '}
                            <button type="button" disabled={busy} onClick={() => setEditing({ id: it.id, value: String(daily) })} style={linkBtn('#1b5c3a')}>
                              zmień porcję
                            </button>
                          </>
                        )}
                      </span>
                    </span>
                    {pet && (
                      <button type="button" disabled={busy} onClick={() => setPicker({ mode:'swap', item: it, pet })}
                        style={{ padding:'0.3rem 0.75rem', borderRadius:'0.5rem', border:'1px solid #E8DFD0', background:'white', fontSize:'0.8rem', cursor:'pointer', color:'#374151' }}>
                        Zamień
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => removeItem(it, items)} aria-label="Usuń karmę" title="Usuń karmę"
                      style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'1rem', padding:'0 0.25rem' }}>
                      ✕
                    </button>
                  </div>
                )
              })}
              {pet && (
                <button type="button" disabled={busy} onClick={() => setPicker({ mode:'add', pet, items })}
                  style={{ ...linkBtn('#1b5c3a'), marginLeft:'2rem', marginTop:'0.25rem', fontSize:'0.85rem' }}>
                  + Dodaj karmę dla {pet.name}
                </button>
              )}
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

      {picker && (
        <ProductCatalog
          profile={petProfile(picker.pet)}
          title={picker.mode === 'swap'
            ? `Zamień: ${picker.item.products?.nazwa ?? 'karmę'}`
            : `Dodaj karmę dla ${picker.pet.name}`}
          excludeIds={box.subscription_items
            .filter(i => i.pet_id === picker.pet.id && i.products)
            .map(i => i.products!.id)}
          onClose={() => setPicker(null)}
          onPick={p => {
            const current = picker
            setPicker(null)
            if (current.mode === 'swap') swapItem(current.item, p)
            else addItem(current.pet, current.items, p)
          }}
        />
      )}
    </div>
  )
}

function linkBtn(color: string): React.CSSProperties {
  return { background:'none', border:'none', padding:0, color, textDecoration:'underline', cursor:'pointer', fontSize:'0.75rem' }
}
