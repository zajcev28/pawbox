import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PetProfile, ScoredProduct } from '../types'
import { calculateDailyCalories, getRecommendations, MAX_GRAMS_PER_DAY, gramsForKcal } from '../lib/recommender'
import { useAIRecommendations } from '../hooks/useAIRecommendations'
import { useProducts } from '../hooks/useProducts'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { savePendingOrder, gramsPerDelivery } from '../lib/order'
import { priceBox, fmtPack, fmtPLN, type PriceInput } from '../lib/pricing'
import { rebalance, suggestedGpd, kcalOf } from '../lib/portions'
import ProductCatalog from '../components/ProductCatalog'
import ProductDetails from '../components/ProductDetails'
import TierStatus from '../components/TierStatus'

// Kreator boxa: algorytm proponuje, klient decyduje.
// Bez limitu karm i bez blokad — karmy niepasujące do quizu dodaje się po potwierdzeniu.

interface DraftItem {
  product:   ScoredProduct
  energia:   string | null
  food_type: 'dry' | 'wet'
  gpd:       number
  custom:    boolean
}

interface ExistingBox {
  freq:   number
  others: PriceInput[]       // karmy pozostałych pupili w boxie
}

type CatalogState = { mode: 'add' } | { mode: 'swap'; index: number } | null

const INTERVALS = [14, 21, 30, 45, 60]

const toDraft = (p: ScoredProduct): DraftItem => ({ product: p, energia: p.energia, food_type: p.food_type, gpd: 0, custom: false })

function readProfile(): PetProfile | null {
  try {
    const s = sessionStorage.getItem('quizProfile')
    return s ? JSON.parse(s) as PetProfile : null
  } catch { return null }
}

export default function Recommendations() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { products, loading: productsLoading } = useProducts()
  const { getRecommendations: getAIRecs } = useAIRecommendations()

  const [profile] = useState<PetProfile | null>(readProfile)
  const manual = profile?.mode === 'manual'

  const [items, setItems]       = useState<DraftItem[]>([])
  const [proposing, setProposing] = useState(!manual)
  const [period, setPeriod]     = useState(30)
  const [existing, setExisting] = useState<ExistingBox | null>(null)
  const [catalog, setCatalog]   = useState<CatalogState>(manual ? { mode: 'add' } : null)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  const dailyCal = useMemo(() => profile
    ? calculateDailyCalories(profile.weight_kg || 4, profile.age_group || 'adult', profile.activity_level || 'medium', profile.species)
    : 0, [profile])

  // ── Propozycja algorytmu (AI wybiera karmy, porcje liczymy w kodzie) ──────
  useEffect(() => {
    if (!profile || manual || productsLoading || products.length === 0) return
    let alive = true
    const recs = getRecommendations(products, profile)
    getAIRecs(profile, recs.slice(0, 15)).then(ai => {
      if (!alive) return
      const candidates = ai?.products.length ? [...ai.products, ...recs] : recs
      const picks: ScoredProduct[] = []
      if (profile.food_type === 'mixed') {
        const dry = candidates.find(p => p.food_type === 'dry')
        const wet = candidates.find(p => p.food_type === 'wet')
        if (dry) picks.push(dry)
        if (wet) picks.push(wet)
      } else if (candidates[0]) {
        picks.push(candidates[0])
      }
      setItems(rebalance(picks.map(toDraft), dailyCal))
      setProposing(false)
    })
    return () => { alive = false }
    // getAIRecs zmienia tożsamość przy każdym renderze — propozycję liczymy raz dla profilu i katalogu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, manual, products, productsLoading, dailyCal])

  // ── Istniejący box: wspólny interwał i karmy pozostałych pupili ──────────
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId || !profile) return
    let alive = true
    supabase.from('subscriptions')
      .select('delivery_frequency_days, subscription_items ( quantity_g, pet_id, products ( nazwa, cena, food_type ), pets ( name, species ) )')
      .eq('user_id', userId).neq('status', 'cancelled')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return
        type Row = { quantity_g: number; pet_id: string | null; products: { nazwa: string; cena: number | null; food_type: 'dry' | 'wet' } | null; pets: { name: string; species: string } | null }
        const rows = (data.subscription_items ?? []) as unknown as Row[]
        const samePet = (r: Row) => profile.pet_id
          ? r.pet_id === profile.pet_id
          : r.pets?.species === profile.species && r.pets?.name.trim().toLowerCase() === profile.name.trim().toLowerCase()
        setExisting({
          freq: data.delivery_frequency_days || 30,
          others: rows.filter(r => r.products && !samePet(r)).map(r => ({
            nazwa: r.products!.nazwa, cena: r.products!.cena, food_type: r.products!.food_type, quantity_g: r.quantity_g,
          })),
        })
      })
    return () => { alive = false }
  }, [userId, profile])

  const freq = existing?.freq ?? period

  // ── Ceny i status (całego boxa, łącznie z pozostałymi pupilami) ──────────
  const mine: PriceInput[] = items.map(i => ({
    nazwa: i.product.nazwa, cena: i.product.cena, food_type: i.food_type, quantity_g: gramsPerDelivery(i.gpd, freq),
  }))
  const pricing = priceBox([...mine, ...(existing?.others ?? [])], freq)
  const myLines = pricing.lines.slice(0, mine.length)
  const othersTotal = pricing.lines.slice(mine.length).reduce((s, l) => s + l.price, 0)
  const totalKcal = Math.round(items.reduce((s, i) => s + kcalOf(i), 0))
  const kcalOff = dailyCal > 0 && items.length > 0 && Math.abs(totalKcal - dailyCal) / dailyCal > 0.3

  // ── Akcje ────────────────────────────────────────────────────────────────
  const addProduct = (p: ScoredProduct) => setItems(prev => rebalance([...prev, toDraft(p)], dailyCal))
  const removeAt   = (idx: number) => setItems(prev => rebalance(prev.filter((_, i) => i !== idx), dailyCal))
  const swapAt     = (idx: number, p: ScoredProduct) => setItems(prev => prev.map((it, i) => i !== idx ? it : {
    ...toDraft(p), custom: it.custom, gpd: gramsForKcal(kcalOf(it), p.energia, p.food_type),
  }))
  const setGrams   = (idx: number, g: number) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, gpd: g, custom: true } : it))
  const resetGrams = (idx: number) => setItems(prev => rebalance(prev.map((it, i) => i === idx ? { ...it, custom: false } : it), dailyCal))

  const order = () => {
    if (!profile || items.length === 0) return
    savePendingOrder({
      plan: pricing.tier.id,
      period_days: freq,
      profile,
      items: items.map(i => ({
        product_id: i.product.id, nazwa: i.product.nazwa, cena: i.product.cena,
        food_type: i.food_type, grams_per_day: i.gpd,
      })),
    })
    navigate('/checkout')
  }

  // ── Widok ────────────────────────────────────────────────────────────────
  if (!profile) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div className="card" style={{ textAlign:'center', maxWidth:420 }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🐾</div>
        <p style={{ color:'#6b7280', marginBottom:'1.5rem' }}>Najpierw powiedz nam coś o pupilu.</p>
        <Link to="/quiz" className="btn-primary">Zacznij →</Link>
      </div>
    </div>
  )

  const card: React.CSSProperties = { background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.1rem' }
  const petName = profile.name || 'Twój pupil'
  const ageLabel = profile.age_group === 'kitten' ? (profile.species === 'dog' ? 'Szczenię' : 'Kocię') : profile.age_group === 'senior' ? 'Senior' : 'Dorosły'

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', padding:'2rem 1rem 3rem' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>

        {/* Pupil */}
        <div style={{ ...card, display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'center', marginBottom:'1.25rem' }}>
          <span style={{ fontSize:'2.5rem' }}>{profile.species === 'cat' ? '🐱' : '🐶'}</span>
          <div style={{ flex:'1 1 200px' }}>
            <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem', margin:0 }}>Box dla: {petName}</h1>
            <p style={{ color:'#6b7280', fontSize:'0.875rem', margin:'0.25rem 0 0' }}>
              {ageLabel} · {profile.weight_kg} kg · zapotrzebowanie ~{dailyCal} kcal/dzień
              {' · '}<Link to={profile.pet_id ? `/quiz?pet=${profile.pet_id}` : '/quiz'} style={{ color:'#1b5c3a' }}>zmień dane</Link>
            </p>
          </div>
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:'1.25rem', alignItems:'flex-start' }}>

          {/* LEWA: zawartość */}
          <div style={{ flex:'1 1 520px', minWidth:0 }}>

            {/* Interwał */}
            <div style={{ ...card, marginBottom:'1rem' }}>
              <div style={{ fontSize:'0.875rem', fontWeight:600, marginBottom:'0.5rem' }}>Jak często dostawa?</div>
              {existing ? (
                <p style={{ fontSize:'0.85rem', color:'#6b7280', margin:0 }}>
                  Twój box przyjeżdża co <strong style={{ color:'#1b5c3a' }}>{existing.freq} dni</strong> — karmy dla {petName} dołączą do tej samej dostawy.
                  Interwał zmienisz w panelu „Mój box”.
                </p>
              ) : (
                <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                  {INTERVALS.map(d => (
                    <button key={d} type="button" onClick={() => setPeriod(d)}
                      style={{ padding:'0.4rem 0.9rem', borderRadius:'2rem', cursor:'pointer', fontSize:'0.85rem',
                        border:`2px solid ${period === d ? '#1b5c3a' : '#E8DFD0'}`,
                        background: period === d ? '#1b5c3a' : 'white', color: period === d ? 'white' : '#374151', fontWeight: period === d ? 600 : 400 }}>
                      co {d} dni
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:'flex', alignItems:'baseline', gap:'0.5rem', margin:'0 0 0.75rem', flexWrap:'wrap' }}>
              <h2 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', margin:0, flex:1 }}>
                {manual ? 'Twoje karmy' : 'Proponowany zestaw'}
              </h2>
              {!manual && !proposing && <span style={{ fontSize:'0.8rem', color:'#6b7280' }}>Możesz wszystko zmienić</span>}
            </div>

            {proposing && (
              <div style={{ ...card, textAlign:'center', color:'#1b5c3a', fontFamily:'Lora,Georgia,serif' }}>🔍 Dobieramy karmy dla {petName}…</div>
            )}

            {!proposing && items.length === 0 && (
              <div style={{ ...card, textAlign:'center', padding:'2rem 1rem' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>🛒</div>
                <p style={{ color:'#6b7280', margin:'0 0 1rem' }}>Box jest pusty — wybierz karmy z katalogu.</p>
                <button type="button" className="btn-primary" onClick={() => setCatalog({ mode:'add' })}>Przeglądaj katalog →</button>
              </div>
            )}

            {items.map((it, idx) => {
              const line = myLines[idx]
              const suggested = suggestedGpd(it, dailyCal, items.length)
              const min = Math.max(5, Math.round(suggested * 0.3))
              const max = Math.min(MAX_GRAMS_PER_DAY, Math.max(Math.round(suggested * 2.5), suggested + 50, it.gpd))
              const lastsDays = it.gpd > 0 ? Math.floor(line.packs * line.pack.grams / it.gpd) : 0
              const p = it.product
              return (
                <div key={p.id} style={{ ...card, marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', flexWrap:'wrap' }}>
                    <div style={{ flex:'1 1 240px', minWidth:0 }}>
                      <div style={{ display:'flex', gap:'0.35rem', marginBottom:'0.35rem', flexWrap:'wrap' }}>
                        <Tag bg={it.food_type === 'wet' ? '#dbeafe' : '#fef3c7'} fg={it.food_type === 'wet' ? '#1d4ed8' : '#92400e'}>
                          {it.food_type === 'wet' ? '💧 Mokra' : '🥜 Sucha'}
                        </Tag>
                        {p.is_grain_free && <Tag bg="#d9ede2" fg="#1b5c3a">🌿 Bezzbożowa</Tag>}
                      </div>
                      <p style={{ fontSize:'0.9rem', fontWeight:600, margin:'0 0 0.35rem', lineHeight:1.4 }}>{p.nazwa}</p>
                      {p.warnings.length > 0
                        ? p.warnings.map(w => <div key={w} style={{ fontSize:'0.75rem', color:'#92400e' }}>⚠ {w}</div>)
                        : p.reasons.slice(0, 2).map(r => <div key={r} style={{ fontSize:'0.75rem', color:'#1b5c3a' }}>✓ {r}</div>)}
                    </div>
                    <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                      <SmallBtn onClick={() => setDetailsId(detailsId === p.id ? null : p.id)}>{detailsId === p.id ? '▲ Skład' : '▼ Skład'}</SmallBtn>
                      <SmallBtn onClick={() => setCatalog({ mode:'swap', index: idx })}>🔄 Zamień</SmallBtn>
                      <SmallBtn danger onClick={() => removeAt(idx)}>🗑</SmallBtn>
                    </div>
                  </div>

                  {/* Porcja */}
                  <div style={{ marginTop:'0.65rem', paddingTop:'0.6rem', borderTop:'1px dashed #E8DFD0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'#6b7280', marginBottom:'0.2rem', gap:'0.5rem', flexWrap:'wrap' }}>
                      <span>Porcja dzienna: <strong style={{ color:'#1b5c3a' }}>{it.gpd} g</strong></span>
                      <span>
                        zalecane ~{suggested} g
                        {it.custom && <> · <button type="button" onClick={() => resetGrams(idx)} style={linkBtn}>przywróć</button></>}
                      </span>
                    </div>
                    <input type="range" min={min} max={max} step={suggested > 200 ? 5 : 1} value={it.gpd}
                      onChange={e => setGrams(idx, parseInt(e.target.value))}
                      aria-label={`Porcja dzienna: ${p.nazwa}`} style={{ width:'100%', accentColor:'#1b5c3a' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.8rem', marginTop:'0.35rem', gap:'0.5rem', flexWrap:'wrap' }}>
                      <span style={{ color:'#374151' }}>
                        📦 {line.packs} × op. {fmtPack(line.pack.grams)}{line.pack.estimated ? ' (szac.)' : ''}
                        <span style={{ color:'#9ca3af' }}> · starcza na ~{lastsDays} dni</span>
                      </span>
                      <strong style={{ color:'#1b5c3a' }}>{fmtPLN(line.price)}</strong>
                    </div>
                  </div>

                  {detailsId === p.id && <div style={{ marginTop:'0.75rem' }}><ProductDetails product={p} /></div>}
                </div>
              )
            })}

            {!proposing && items.length > 0 && (
              <>
                {kcalOff && (
                  <div style={{ fontSize:'0.8rem', color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'0.75rem', padding:'0.6rem 0.8rem', marginBottom:'0.75rem' }}>
                    ⚠ Łącznie ~{totalKcal} kcal dziennie, a zalecane ~{dailyCal} kcal. To Twoja decyzja — dajemy tylko znać.
                  </div>
                )}
                <button type="button" onClick={() => setCatalog({ mode:'add' })}
                  style={{ width:'100%', padding:'0.875rem', borderRadius:'1rem', border:'2px dashed #1b5c3a', background:'#f0f7f3', cursor:'pointer', color:'#1b5c3a', fontWeight:600, fontSize:'0.9rem' }}>
                  + Dodaj karmę z katalogu
                </button>
              </>
            )}
          </div>

          {/* PRAWA: podsumowanie */}
          <aside style={{ flex:'1 1 300px', minWidth:0, display:'flex', flexDirection:'column', gap:'1rem', position:'sticky', top:'1rem' }}>
            <TierStatus pricing={pricing} />

            <div style={card}>
              <h3 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 0.6rem' }}>Jedna dostawa</h3>
              {myLines.map((l, i) => (
                <Row key={items[i].product.id} label={`${l.packs}× ${l.nazwa}`} value={fmtPLN(l.price)} muted />
              ))}
              {othersTotal > 0 && <Row label="Karmy pozostałych pupili" value={fmtPLN(othersTotal)} muted />}
              {pricing.discountPLN > 0 && <Row label={`Rabat ${pricing.tier.name} −${pricing.tier.discount}%`} value={`−${fmtPLN(pricing.discountPLN)}`} accent />}
              {pricing.lines.length > 0 && <Row label="Dostawa" value={pricing.shipping === 0 ? 'gratis' : fmtPLN(pricing.shipping)} muted />}
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:'1.1rem', padding:'0.6rem 0 0', borderTop:'2px solid #E8DFD0', marginTop:'0.4rem' }}>
                <span>Razem</span><span style={{ color:'#1b5c3a' }}>{fmtPLN(pricing.total)}</span>
              </div>
              <div style={{ fontSize:'0.75rem', color:'#6b7280', textAlign:'right' }}>
                co {freq} dni · ≈ {fmtPLN(pricing.totalMonthly)} / miesiąc
              </div>
              <button type="button" onClick={order} disabled={items.length === 0} className="btn-primary"
                style={{ width:'100%', marginTop:'1rem', padding:'0.875rem', fontSize:'0.95rem', opacity: items.length === 0 ? 0.4 : 1 }}>
                {existing ? 'Dodaj do mojego boxa →' : 'Przejdź do zamówienia →'}
              </button>
              <p style={{ fontSize:'0.7rem', color:'#9ca3af', margin:'0.5rem 0 0' }}>Ceny z katalogu, mogą się nieznacznie zmienić.</p>
            </div>
          </aside>
        </div>
      </div>

      {catalog && (
        <ProductCatalog
          profile={profile}
          title={catalog.mode === 'swap' ? `Zamień: ${items[catalog.index]?.product.nazwa ?? 'karmę'}` : `Dodaj karmę dla: ${petName}`}
          excludeIds={items.map(i => i.product.id)}
          onClose={() => setCatalog(null)}
          onPick={p => {
            if (catalog.mode === 'swap') swapAt(catalog.index, p)
            else addProduct(p)
            setCatalog(null)
          }}
        />
      )}
    </div>
  )
}

const linkBtn: React.CSSProperties = { background:'none', border:'none', padding:0, color:'#1b5c3a', textDecoration:'underline', cursor:'pointer', fontSize:'0.8rem' }

function Tag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span style={{ fontSize:'0.7rem', padding:'2px 8px', borderRadius:20, background:bg, color:fg }}>{children}</span>
}

function SmallBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding:'0.35rem 0.6rem', borderRadius:'0.5rem', cursor:'pointer', fontSize:'0.75rem',
        border:`1px solid ${danger ? '#fecaca' : '#E8DFD0'}`, background: danger ? '#fff5f5' : 'white', color: danger ? '#dc2626' : '#374151' }}>
      {children}
    </button>
  )
}

function Row({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:'0.75rem', fontSize:'0.8rem', padding:'0.3rem 0', borderBottom:'1px solid #f3f4f6', color: accent ? '#C4622D' : undefined }}>
      <span style={{ minWidth:0, color: accent ? undefined : muted ? '#6b7280' : '#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
      <span style={{ fontWeight:600, flexShrink:0 }}>{value}</span>
    </div>
  )
}
