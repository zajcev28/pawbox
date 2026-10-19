import { useMemo, useState } from 'react'
import type { PetProfile, ScoredProduct } from '../types'
import { useProducts } from '../hooks/useProducts'
import { catalogFor } from '../lib/recommender'
import { packFromName, fmtPack, fmtPLN } from '../lib/pricing'
import ProductDetails from './ProductDetails'

interface Props {
  profile:    PetProfile
  title:      string
  excludeIds: string[]
  onPick:     (product: ScoredProduct) => void
  onClose:    () => void
}

type Sort = 'fit' | 'price_asc' | 'price_desc'
const PAGE = 30
const TOP_RECOMMENDED = 10

// Pełny katalog dla gatunku pupila. Nic nie jest blokowane: karmy, które nie pasują
// do quizu, mają ostrzeżenie i wymagają jednego kliknięcia „Dodaj mimo to”.
export default function ProductCatalog({ profile, title, excludeIds, onPick, onClose }: Props) {
  const { products, loading } = useProducts()
  const [query, setQuery]       = useState('')
  const [type, setType]         = useState<'all' | 'dry' | 'wet'>('all')
  const [grainFree, setGrainFree] = useState(false)
  const [sort, setSort]         = useState<Sort>('fit')
  const [limit, setLimit]       = useState(PAGE)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  const catalog = useMemo(
    () => catalogFor(products.filter(p => !p.id.startsWith('seed-')), profile),
    [products, profile],
  )
  const recommended = useMemo(
    () => new Set(catalog.filter(p => p.warnings.length === 0 && p.score > 0).slice(0, TOP_RECOMMENDED).map(p => p.id)),
    [catalog],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const excluded = new Set(excludeIds)
    const out = catalog
      .filter(p => !excluded.has(p.id))
      .filter(p => type === 'all' || p.food_type === type)
      .filter(p => !grainFree || p.is_grain_free)
      .filter(p => !q || q.split(/\s+/).every(w => p.nazwa.toLowerCase().includes(w)))
    if (sort === 'price_asc')  return [...out].sort((a, b) => (Number(a.cena) || 1e9) - (Number(b.cena) || 1e9))
    if (sort === 'price_desc') return [...out].sort((a, b) => (Number(b.cena) || 0) - (Number(a.cena) || 0))
    return out
  }, [catalog, excludeIds, type, grainFree, query, sort])

  const pick = (p: ScoredProduct) => {
    if (p.warnings.length > 0 && confirmId !== p.id) { setConfirmId(p.id); return }
    onPick(p)
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.8rem', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${active ? '#1b5c3a' : '#E8DFD0'}`,
    background: active ? '#1b5c3a' : 'white', color: active ? 'white' : '#374151',
  })

  return (
    <div role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'0.75rem' }}>
      <div style={{ background:'white', borderRadius:'1.25rem', width:'100%', maxWidth:620, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'1.1rem 1.1rem 0.75rem', borderBottom:'1px solid #E8DFD0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
            <h3 style={{ fontFamily:'Lora,Georgia,serif', margin:0, flex:1, fontSize:'1.15rem' }}>{title}</h3>
            <button type="button" onClick={onClose} aria-label="Zamknij"
              style={{ background:'none', border:'none', fontSize:'1.25rem', cursor:'pointer', color:'#6b7280' }}>✕</button>
          </div>
          <input className="input" autoFocus placeholder="Szukaj: marka, smak, np. „royal canin łosoś”"
            value={query} onChange={e => { setQuery(e.target.value); setLimit(PAGE) }} />
          <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.6rem', flexWrap:'wrap', alignItems:'center' }}>
            {([['all','Wszystkie'], ['dry','🥜 Sucha'], ['wet','💧 Mokra']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setType(v); setLimit(PAGE) }} style={chip(type === v)}>{l}</button>
            ))}
            <button type="button" onClick={() => { setGrainFree(g => !g); setLimit(PAGE) }} style={chip(grainFree)}>🌿 Bezzbożowe</button>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sortowanie"
              style={{ marginLeft:'auto', padding:'0.3rem 0.5rem', borderRadius:8, border:'1px solid #E8DFD0', fontSize:'0.8rem', background:'white' }}>
              <option value="fit">Najlepiej dopasowane</option>
              <option value="price_asc">Cena: od najniższej</option>
              <option value="price_desc">Cena: od najwyższej</option>
            </select>
          </div>
        </div>

        <div style={{ overflowY:'auto', padding:'0.25rem 0.75rem 1rem' }}>
          {loading && <p style={{ textAlign:'center', color:'#6b7280', fontSize:'0.875rem' }}>⏳ Ładuję katalog…</p>}
          {!loading && (
            <p style={{ fontSize:'0.75rem', color:'#9ca3af', margin:'0.5rem 0.25rem' }}>
              {list.length} karm · „polecana” = najlepsze dopasowanie do profilu pupila
            </p>
          )}
          {!loading && list.length === 0 && (
            <p style={{ textAlign:'center', color:'#6b7280', fontSize:'0.875rem' }}>Brak karm dla tych filtrów.</p>
          )}

          {list.slice(0, limit).map(p => {
            const pack = packFromName(p.nazwa, p.food_type)
            const warn = p.warnings.length > 0
            const confirming = confirmId === p.id
            return (
              <div key={p.id} style={{ borderBottom:'1px solid #f3f4f6', padding:'0.65rem 0.25rem' }}>
                <div style={{ display:'flex', gap:'0.6rem', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.1rem' }}>{p.food_type === 'wet' ? '💧' : '🥜'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.875rem', color:'#111827', lineHeight:1.35 }}>
                      {p.nazwa}
                      {recommended.has(p.id) && <Badge bg="#d9ede2" fg="#1b5c3a">polecana</Badge>}
                      {warn && <Badge bg="#fef3c7" fg="#92400e">⚠ uwaga</Badge>}
                    </div>
                    <div style={{ fontSize:'0.75rem', color: warn ? '#92400e' : '#6b7280', marginTop:'0.15rem' }}>
                      {warn ? p.warnings[0] : (p.reasons[0] ?? '')}
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'#6b7280', marginTop:'0.15rem' }}>
                      op. {fmtPack(pack.grams)}{pack.estimated ? " (szac.)" : ""} · pełna porcja ~{p.daily_grams} g/dzień ·{" "}
                      <button type="button" onClick={() => setDetailsId(detailsId === p.id ? null : p.id)}
                        style={{ background:'none', border:'none', padding:0, color:'#1b5c3a', textDecoration:'underline', cursor:'pointer', fontSize:'0.75rem' }}>
                        {detailsId === p.id ? 'ukryj skład' : 'skład'}
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontWeight:700, color:'#1b5c3a', fontSize:'0.875rem' }}>{Number(p.cena) > 0 ? fmtPLN(Number(p.cena)) : '—'}</div>
                    <button type="button" onClick={() => pick(p)}
                      style={{ marginTop:'0.3rem', padding:'0.3rem 0.8rem', borderRadius:'0.5rem', border:'1px solid #1b5c3a', background: confirming ? 'white' : '#1b5c3a', color: confirming ? '#1b5c3a' : 'white', cursor:'pointer', fontSize:'0.8rem' }}>
                      Wybierz
                    </button>
                  </div>
                </div>
                {confirming && (
                  <div style={{ margin:'0.5rem 0 0 1.7rem', padding:'0.6rem 0.75rem', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'0.6rem', fontSize:'0.8rem', color:'#92400e' }}>
                    {p.warnings.map(w => <div key={w}>⚠ {w}</div>)}
                    <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
                      <button type="button" onClick={() => onPick(p)}
                        style={{ padding:'0.3rem 0.8rem', borderRadius:'0.5rem', border:'none', background:'#92400e', color:'white', cursor:'pointer', fontSize:'0.8rem' }}>
                        Rozumiem, dodaj mimo to
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)}
                        style={{ padding:'0.3rem 0.8rem', borderRadius:'0.5rem', border:'1px solid #fde68a', background:'white', color:'#92400e', cursor:'pointer', fontSize:'0.8rem' }}>
                        Wróć
                      </button>
                    </div>
                  </div>
                )}
                {detailsId === p.id && <div style={{ marginTop:'0.5rem' }}><ProductDetails product={p} /></div>}
              </div>
            )
          })}

          {list.length > limit && (
            <button type="button" onClick={() => setLimit(l => l + PAGE)} className="btn-secondary"
              style={{ width:'100%', marginTop:'0.75rem' }}>
              Pokaż więcej ({list.length - limit})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span style={{ marginLeft:'0.4rem', fontSize:'0.7rem', padding:'1px 6px', borderRadius:10, background:bg, color:fg, whiteSpace:'nowrap' }}>
      {children}
    </span>
  )
}
