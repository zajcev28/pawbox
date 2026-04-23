import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PetProfile, ScoredProduct } from '../types'
import { getRecommendations, calculateDailyCalories } from '../lib/recommender'
import { useProducts } from '../hooks/useProducts'
import { supabase } from '../lib/supabase'

// ─── Typy ────────────────────────────────────────────────────────────────────
interface BoxItem {
  product: ScoredProduct
  grams_per_day: number
  grams_total: number
  bags: number
  monthly_cost: number
}

interface Plan {
  id: 'starter' | 'comfort' | 'premium'
  name: string
  emoji: string
  features: string[]
  discount: number
  maxFoods: number
  featured: boolean
}

// ─── Stałe ───────────────────────────────────────────────────────────────────
const PLANS: Plan[] = [
  { id: 'starter', name: 'Podstawowy', emoji: '🌱',
    features: ['1 rodzaj karmy', 'Dostawa co 30 dni', '1 pupil'],
    discount: 0, maxFoods: 1, featured: false },
  { id: 'comfort', name: 'Komfortowy', emoji: '⭐',
    features: ['Do 2 rodzajów karm', 'Dostawa co 14–30 dni', 'Do 2 pupili', 'Rabat 5%', 'Darmowa dostawa od 120 PLN'],
    discount: 5, maxFoods: 2, featured: true },
  { id: 'premium', name: 'Premium', emoji: '💎',
    features: ['Do 4 rodzajów karm', 'Dowolna częstotliwość', 'Nieograniczone pupile', 'Rabat 10%', 'Zawsze darmowa dostawa'],
    discount: 10, maxFoods: 4, featured: false },
]

const PERIODS = [
  { id: 14, label: '2 tygodnie' },
  { id: 30, label: 'Miesiąc' },
]

const PROTEIN_LABELS: Record<string, string> = {
  chicken: '🍗 Kurczak', salmon: '🐟 Łosoś', beef: '🥩 Wołowina',
  lamb: '🐑 Jagnięcina', pork: '🐷 Wieprzowina', rabbit: '🐰 Królik',
  tuna: '🐠 Tuńczyk', turkey: '🦃 Indyk',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseKcal(energia: string | null, foodType: 'dry' | 'wet'): number {
  if (energia) {
    const m = energia.match(/(\d+)/)
    if (m) {
      const v = parseInt(m[1])
      return v > 1000 ? Math.round(v / 10) : v
    }
  }
  return foodType === 'dry' ? 350 : 85
}

function buildBoxItem(product: ScoredProduct, dailyCal: number, days: number): BoxItem {
  const kcalPer100g = parseKcal(product.energia, product.food_type)
  const grams_per_day = Math.round((dailyCal / kcalPer100g) * 100)
  const grams_total = grams_per_day * days
  const packGrams = product.food_type === 'wet' ? 400 : 2000
  const bags = Math.ceil(grams_total / packGrams)
  const monthly_cost = Math.round(bags * (product.cena || 10))
  return { product, grams_per_day, grams_total, bags, monthly_cost }
}

// ─── Komponent szczegółów (lazy load z Supabase) ──────────────────────────────
function ProductDetails({ prod, dailyCal }: { prod: any; dailyCal: number }) {
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!prod.id || prod.id.startsWith('seed-')) {
      setDetails(prod)
      setLoading(false)
      return
    }
    supabase
      .from('products')
      .select('*')
      .eq('id', prod.id)
      .single()
      .then(({ data }) => {
        setDetails(data || prod)
        setLoading(false)
      })
  }, [prod.id])

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', borderTop: '1px solid #E8DFD0', background: '#fafafa' }}>
        ⏳ Ładuję szczegóły...
      </div>
    )
  }

  const d = details

  return (
    <div style={{ padding: '0.75rem', borderTop: '1px solid #E8DFD0', background: '#fafafa' }}>

      {/* Wartości odżywcze */}
      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
        Wartości odżywcze (na 100g)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {[
          { l: 'Białko', v: d.bialko },
          { l: 'Tłuszcz', v: d.tluszcz },
          { l: 'Włókno', v: d.wlokno },
          { l: 'Wilgotność', v: d.wilgotnosc },
          { l: 'Energia', v: d.energia },
          { l: 'Mięso', v: d.meat_percent ? `${d.meat_percent}%` : null },
        ].filter(n => n.v).map(n => (
          <div key={n.l} style={{ background: 'white', borderRadius: '0.5rem', padding: '0.4rem', textAlign: 'center', border: '1px solid #E8DFD0' }}>
            <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>{n.l}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1b5c3a' }}>{n.v}</div>
          </div>
        ))}
      </div>

      {/* Szacowana porcja */}
      <div style={{ background: '#f0f7f3', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#1b5c3a' }}>
        📏 Szacowana porcja dzienna: <strong>{Math.round((dailyCal / parseKcal(d.energia, d.food_type)) * 100)}g</strong>
      </div>

      {/* Źródła białka */}
      {d.proteins && d.proteins.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.35rem' }}>
            Źródła białka
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {d.proteins.map((p: string) => (
              <span key={p} style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8' }}>
                {PROTEIN_LABELS[p] || p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bezzbożowa */}
      {d.is_grain_free && (
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: '#d9ede2', color: '#1b5c3a' }}>
            🌿 Karma bezzbożowa
          </span>
        </div>
      )}

      {/* Pełny skład */}
      <div style={{ marginBottom: d.opis ? '0.75rem' : 0 }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.35rem' }}>
          Pełny skład
        </p>
        {d.sklad ? (
          <p style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.6, margin: 0, background: 'white', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #E8DFD0' }}>
            {d.sklad}
          </p>
        ) : (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>Brak danych o składzie</p>
        )}
      </div>

      {/* Opis producenta */}
      {d.opis && (
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.35rem' }}>
            Opis producenta
          </p>
          <div style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.7, background: 'white', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #E8DFD0' }}>
            {d.opis.split(/Wskazania|Zalety|Przeciwwskazania|Podawanie|Składniki/).map((section: string, i: number) => (
              section.trim() ? <p key={i} style={{ margin: '0 0 0.5rem' }}>{section.trim()}</p> : null
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Główny komponent ─────────────────────────────────────────────────────────
export default function Recommendations() {
  const navigate = useNavigate()
  const { products, loading } = useProducts()

  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [box, setBox] = useState<BoxItem[]>([])
  const [plan, setPlan] = useState<Plan>(PLANS[1])
  const [period, setPeriod] = useState(30)
  const [dailyCal, setDailyCal] = useState(0)

  // modal
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [swapSearch, setSwapSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Profil ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = sessionStorage.getItem('quizProfile')
    if (s) setProfile(JSON.parse(s))
  }, [])

  // ── Rekomendacje ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile || products.length === 0) return
    const kcal = calculateDailyCalories(
      profile.weight_kg, profile.age_group, profile.activity_level, profile.species
    )
    setDailyCal(kcal)
    const recs = getRecommendations(products, profile)
    setBox(recs.slice(0, plan.maxFoods).map(p => buildBoxItem(p, kcal, period)))
  }, [profile, products])

  // ── Przelicz przy zmianie okresu ──────────────────────────────────────────
  useEffect(() => {
    if (!dailyCal) return
    setBox(prev => prev.map(item => buildBoxItem(item.product, dailyCal, period)))
  }, [period, dailyCal])

  // ── Zmiana planu ──────────────────────────────────────────────────────────
  const changePlan = (newPlan: Plan) => {
    setPlan(newPlan)
    setBox(prev => prev.slice(0, newPlan.maxFoods))
  }

  // ── Akcje ────────────────────────────────────────────────────────────────
  const removeItem = (idx: number) => setBox(prev => prev.filter((_, i) => i !== idx))

  const swapItem = (idx: number, newProduct: ScoredProduct) => {
    setBox(prev => prev.map((item, i) =>
      i === idx ? buildBoxItem(newProduct, dailyCal, period) : item
    ))
    setSwapIndex(null)
    setSwapSearch('')
    setExpandedId(null)
  }

  const addItem = (newProduct: ScoredProduct) => {
    if (box.length >= plan.maxFoods) return
    if (box.some(b => b.product.id === newProduct.id)) return
    setBox(prev => [...prev, buildBoxItem(newProduct, dailyCal, period)])
    setSwapIndex(null)
    setSwapSearch('')
    setExpandedId(null)
  }

  // ── Dostępne karmy w modalu ───────────────────────────────────────────────
  const boxIds = new Set(box.map(b => b.product.id))
  const available = (products as any[])
    .filter((p: any) => !boxIds.has(p.id))
    .filter((p: any) =>
      swapSearch.length < 2
        ? true
        : p.nazwa.toLowerCase().includes(swapSearch.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const diff = ((b as any).score || 0) - ((a as any).score || 0)
      if (diff !== 0) return diff
      return (a.nazwa || '').localeCompare(b.nazwa || '', 'pl')
    })

  // ── Sumy ──────────────────────────────────────────────────────────────────
  const totalCost = box.reduce((s, i) => s + i.monthly_cost, 0)
  const finalCost = Math.round(totalCost * (1 - plan.discount / 100))

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF6EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Lora,Georgia,serif', color: '#1b5c3a', fontSize: '1.25rem' }}>
          🔍 Dobieramy karmy...
        </p>
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '1rem',
    border: '1px solid #E8DFD0', padding: '1.25rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EF', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Profil */}
        <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '2.5rem' }}>{profile.species === 'cat' ? '🐱' : '🐶'}</span>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.5rem', margin: 0 }}>
              {profile.name || 'Twój pupil'}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
              {profile.age_group === 'kitten' ? 'Kocię/Szczenię' : profile.age_group === 'adult' ? 'Dorosły' : 'Senior'}
              &nbsp;·&nbsp;{profile.weight_kg} kg
              &nbsp;·&nbsp;{profile.activity_level === 'low' ? 'Mała aktywność' : profile.activity_level === 'medium' ? 'Umiarkowana' : 'Bardzo aktywny'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1b5c3a' }}>{dailyCal} kcal</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>dziennie</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

          {/* LEWA: zestaw karm */}
          <div>
            {/* Okres dostawy */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Dostawa na:</span>
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  style={{ padding: '0.4rem 1rem', borderRadius: '2rem', border: `2px solid ${period === p.id ? '#1b5c3a' : '#E8DFD0'}`, background: period === p.id ? '#1b5c3a' : 'white', color: period === p.id ? 'white' : '#374151', cursor: 'pointer', fontWeight: period === p.id ? 600 : 400, fontSize: '0.875rem' }}>
                  {p.label}
                </button>
              ))}
            </div>

            <h2 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.25rem', margin: '0 0 1rem' }}>
              Twój zestaw ({box.length}/{plan.maxFoods})
            </h2>

            {box.map((item, idx) => (
              <div key={item.product.id} style={{ ...cardStyle, marginBottom: '0.75rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, background: item.product.food_type === 'wet' ? '#dbeafe' : '#fef3c7', color: item.product.food_type === 'wet' ? '#1d4ed8' : '#92400e' }}>
                        {item.product.food_type === 'wet' ? '💧 Mokra' : '🥜 Sucha'}
                      </span>
                      {item.product.is_grain_free && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, background: '#d9ede2', color: '#1b5c3a' }}>🌿 Bezzbożowa</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                      {item.product.nazwa}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {[
                        { l: 'dziennie', v: `${item.grams_per_day}g`, bg: '#f0f7f3', c: '#1b5c3a' },
                        { l: period === 14 ? '2 tyg.' : 'miesiąc', v: `${(item.grams_total / 1000).toFixed(1)} kg`, bg: '#f0f7f3', c: '#1b5c3a' },
                        { l: '~opakowań', v: `${item.bags} szt.`, bg: '#fef3c7', c: '#92400e' },
                        { l: 'koszt', v: `${item.monthly_cost} zł`, bg: '#E8DFD0', c: '#374151' },
                      ].map(n => (
                        <div key={n.l} style={{ background: n.bg, borderRadius: '0.5rem', padding: '0.35rem 0.65rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>{n.l}</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: n.c }}>{n.v}</div>
                        </div>
                      ))}
                    </div>
                    {(item.product.reasons || []).slice(0, 2).map((r, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', color: '#1b5c3a' }}>✓ {r}</div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
                    <button onClick={() => { setSwapIndex(idx); setSwapSearch(''); setExpandedId(null) }}
                      style={{ padding: '0.4rem 0.65rem', borderRadius: '0.5rem', border: '1px solid #E8DFD0', background: 'white', cursor: 'pointer', fontSize: '0.75rem' }}>
                      🔄 Zamień
                    </button>
                    <button onClick={() => removeItem(idx)}
                      style={{ padding: '0.4rem 0.65rem', borderRadius: '0.5rem', border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626' }}>
                      🗑 Usuń
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {box.length < plan.maxFoods && (
              <button onClick={() => { setSwapIndex(-1); setSwapSearch(''); setExpandedId(null) }}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '1rem', border: '2px dashed #1b5c3a', background: '#f0f7f3', cursor: 'pointer', color: '#1b5c3a', fontWeight: 600, fontSize: '0.9rem' }}>
                + Dodaj karmę ({box.length}/{plan.maxFoods} slotów)
              </button>
            )}
          </div>

          {/* PRAWA: plan + suma */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={cardStyle}>
              <h3 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Plan subskrypcji</h3>
              {PLANS.map(pl => (
                <div key={pl.id} onClick={() => changePlan(pl)}
                  style={{ padding: '0.65rem 0.75rem', borderRadius: '0.75rem', border: `2px solid ${plan.id === pl.id ? '#1b5c3a' : '#E8DFD0'}`, background: plan.id === pl.id ? '#f0f7f3' : 'white', cursor: 'pointer', marginBottom: '0.5rem', position: 'relative' }}>
                  {pl.featured && (
                    <span style={{ position: 'absolute', top: -8, right: 8, background: '#C4622D', color: 'white', fontSize: '0.6rem', padding: '1px 7px', borderRadius: 20 }}>
                      Polecany
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{pl.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{pl.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                        do {pl.maxFoods} karm{pl.discount > 0 ? ` · rabat ${pl.discount}%` : ''}
                      </div>
                    </div>
                    {plan.id === pl.id && <span style={{ color: '#1b5c3a', fontWeight: 700 }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Podsumowanie</h3>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                Okres: <strong style={{ color: '#374151' }}>{period === 14 ? '2 tygodnie' : 'Miesiąc'}</strong>
              </div>
              {box.map(item => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280', flex: 1, marginRight: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.product.nazwa.substring(0, 30)}...
                  </span>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>{item.monthly_cost} zł</span>
                </div>
              ))}
              {plan.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0', color: '#C4622D' }}>
                  <span>Rabat {plan.discount}%</span>
                  <span>-{totalCost - finalCost} zł</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', padding: '0.65rem 0 0', borderTop: '2px solid #E8DFD0', marginTop: '0.4rem' }}>
                <span>Razem</span>
                <span style={{ color: '#1b5c3a' }}>{finalCost} zł</span>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>* szacunkowy koszt</p>
              <button
                onClick={() => {
                  sessionStorage.setItem('selectedPlan', plan.id)
                  sessionStorage.setItem('selectedProducts', JSON.stringify(box.map(b => b.product.id)))
                  sessionStorage.setItem('boxItems', JSON.stringify(box.map(b => ({
                    product_id: b.product.id,
                    grams_total: b.grams_total,
                    period_days: period,
                  }))))
                  navigate('/checkout')
                }}
                disabled={box.length === 0}
                className="btn-primary"
                style={{ width: '100%', marginTop: '1rem', padding: '0.875rem', fontSize: '0.95rem', opacity: box.length === 0 ? 0.4 : 1 }}>
                Zamów plan {plan.name} →
              </button>
            </div>
          </div>
        </div>

        {/* MODAL */}
        {swapIndex !== null && (
          <div
            onClick={e => { if (e.target === e.currentTarget) { setSwapIndex(null); setExpandedId(null) } }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.5rem', width: '100%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.25rem', margin: 0 }}>
                  {swapIndex === -1 ? 'Dodaj karmę' : 'Zamień karmę'}
                </h3>
                <button onClick={() => { setSwapIndex(null); setExpandedId(null) }}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
              </div>

              <input
                className="input"
                placeholder="Szukaj karmy... (np. łosoś, Schesir, mokra...)"
                value={swapSearch}
                onChange={e => { setSwapSearch(e.target.value); setExpandedId(null) }}
                style={{ marginBottom: '0.5rem' }}
                autoFocus
              />
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
                {available.length} karm dostępnych · kliknij „Szczegóły" aby zobaczyć skład i wartości odżywcze
              </p>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {available.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>Brak wyników</p>
                )}

                {available.slice(0, 100).map((prod: any) => (
                  <div key={prod.id}
                    style={{ borderRadius: '0.75rem', border: `1px solid ${expandedId === prod.id ? '#1b5c3a' : '#E8DFD0'}`, marginBottom: '0.5rem', overflow: 'hidden', transition: 'border-color 0.15s' }}>

                    {/* Wiersz karmy */}
                    <div style={{ padding: '0.65rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: '0 0 0.3rem', lineHeight: 1.4 }}>
                            {prod.nazwa}
                          </p>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 20, background: prod.food_type === 'wet' ? '#dbeafe' : '#fef3c7', color: prod.food_type === 'wet' ? '#1d4ed8' : '#92400e' }}>
                              {prod.food_type === 'wet' ? '💧 Mokra' : '🥜 Sucha'}
                            </span>
                            {prod.is_grain_free && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 20, background: '#d9ede2', color: '#1b5c3a' }}>🌿 Bezzbożowa</span>
                            )}
                            {prod.bialko && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 20, background: '#f3f4f6', color: '#374151' }}>
                                Białko: {prod.bialko}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, color: '#1b5c3a', fontSize: '0.9rem' }}>
                            {prod.cena?.toFixed(2)} zł
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                            ~{Math.round((dailyCal / parseKcal(prod.energia, prod.food_type)) * 100)}g/dzień
                          </div>
                        </div>
                      </div>

                      {/* Przyciski akcji */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setExpandedId(expandedId === prod.id ? null : prod.id)}
                          style={{ flex: 1, padding: '0.35rem', borderRadius: '0.5rem', border: '1px solid #E8DFD0', background: expandedId === prod.id ? '#f0f7f3' : 'white', cursor: 'pointer', fontSize: '0.75rem', color: '#374151' }}>
                          {expandedId === prod.id ? '▲ Ukryj' : '▼ Szczegóły'}
                        </button>
                        <button
                          onClick={() => swapIndex === -1 ? addItem(prod) : swapItem(swapIndex, prod)}
                          style={{ flex: 2, padding: '0.35rem', borderRadius: '0.5rem', border: 'none', background: '#1b5c3a', cursor: 'pointer', fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>
                          {swapIndex === -1 ? '+ Dodaj do zestawu' : '🔄 Wybierz'}
                        </button>
                      </div>
                    </div>

                    {/* Lazy-loaded szczegóły — ładowane dopiero po kliknięciu */}
                    {expandedId === prod.id && (
                      <ProductDetails prod={prod} dailyCal={dailyCal} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
