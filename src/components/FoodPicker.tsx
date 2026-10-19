import { useMemo, useState } from 'react'
import type { Pet, ScoredProduct } from '../types'
import { useProducts } from '../hooks/useProducts'
import { rankProducts } from '../lib/recommender'

interface Props {
  pet: Pet
  title: string
  excludeIds: string[]
  onPick: (product: ScoredProduct) => void
  onClose: () => void
}

const LIMIT = 40

// Okno wyboru karmy dla konkretnego pupila — lista od najlepiej dopasowanej,
// bez karm z alergenami i bez typu, którego pupil nie je.
export default function FoodPicker({ pet, title, excludeIds, onPick, onClose }: Props) {
  const { products, loading } = useProducts()
  const [query, setQuery] = useState('')
  const [type, setType]   = useState<'all' | 'dry' | 'wet'>('all')

  const ranked = useMemo(() => rankProducts(
    products.filter(p => !p.id.startsWith('seed-')),
    {
      name: pet.name, species: pet.species, age_group: pet.age_group,
      weight_kg: Number(pet.weight_kg) || 4, activity_level: pet.activity_level,
      health_conditions: pet.health_conditions ?? [], allergies: pet.allergies ?? [],
      food_type: pet.food_type ?? 'mixed',
    },
  ), [products, pet])

  const topIds = useMemo(() => new Set(ranked.slice(0, 5).map(p => p.id)), [ranked])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const excluded = new Set(excludeIds)
    return ranked
      .filter(p => !excluded.has(p.id))
      .filter(p => type === 'all' || p.food_type === type)
      .filter(p => !q || p.nazwa.toLowerCase().includes(q))
      .slice(0, LIMIT)
  }, [ranked, excludeIds, type, query])

  const showTypeTabs = (pet.food_type ?? 'mixed') === 'mixed'

  return (
    <div role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:560, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'1.25rem 1.25rem 0.75rem', borderBottom:'1px solid #E8DFD0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
            <h3 style={{ fontFamily:'Lora,Georgia,serif', margin:0, flex:1, fontSize:'1.15rem' }}>{title}</h3>
            <button type="button" onClick={onClose} aria-label="Zamknij"
              style={{ background:'none', border:'none', fontSize:'1.25rem', cursor:'pointer', color:'#6b7280' }}>✕</button>
          </div>
          <input className="input" autoFocus placeholder="Szukaj po nazwie lub marce…"
            value={query} onChange={e => setQuery(e.target.value)} />
          {showTypeTabs && (
            <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.6rem' }}>
              {([['all','Wszystkie'], ['dry','🥜 Sucha'], ['wet','💧 Mokra']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setType(v)}
                  style={{ padding:'0.3rem 0.8rem', borderRadius:20, fontSize:'0.8rem', cursor:'pointer',
                    border:`1px solid ${type === v ? '#1b5c3a' : '#E8DFD0'}`,
                    background: type === v ? '#1b5c3a' : 'white', color: type === v ? 'white' : '#374151' }}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ overflowY:'auto', padding:'0.5rem 0.75rem 1rem' }}>
          {loading && <p style={{ textAlign:'center', color:'#6b7280', fontSize:'0.875rem' }}>⏳ Ładuję karmy…</p>}
          {!loading && list.length === 0 && (
            <p style={{ textAlign:'center', color:'#6b7280', fontSize:'0.875rem' }}>Brak pasujących karm.</p>
          )}
          {list.map(p => (
            <button key={p.id} type="button" onClick={() => onPick(p)}
              style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', width:'100%', textAlign:'left', padding:'0.7rem 0.5rem',
                background:'none', border:'none', borderBottom:'1px solid #f3f4f6', cursor:'pointer' }}>
              <span style={{ fontSize:'1.1rem' }}>{p.food_type === 'wet' ? '💧' : '🥜'}</span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontSize:'0.875rem', color:'#111827' }}>
                  {p.nazwa}
                  {topIds.has(p.id) && (
                    <span style={{ marginLeft:'0.4rem', fontSize:'0.7rem', padding:'1px 6px', borderRadius:10, background:'#d9ede2', color:'#1b5c3a', whiteSpace:'nowrap' }}>
                      polecana
                    </span>
                  )}
                </span>
                {p.reasons[0] && <span style={{ display:'block', fontSize:'0.75rem', color:'#6b7280', marginTop:'0.15rem' }}>{p.reasons[0]}</span>}
              </span>
              {p.cena != null && <span style={{ fontSize:'0.8rem', color:'#374151', whiteSpace:'nowrap' }}>{Number(p.cena).toFixed(2)} zł</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
