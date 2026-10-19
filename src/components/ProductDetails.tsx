import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

const PROTEIN_LABELS: Record<string, string> = {
  chicken: '🍗 Kurczak', salmon: '🐟 Łosoś', beef: '🥩 Wołowina',
  lamb: '🐑 Jagnięcina', pork: '🐷 Wieprzowina', rabbit: '🐰 Królik',
  tuna: '🐠 Tuńczyk', turkey: '🦃 Indyk',
}

const heading: React.CSSProperties = {
  fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 0.35rem',
}
const panel: React.CSSProperties = {
  fontSize: '0.8rem', color: '#374151', lineHeight: 1.6, margin: 0, background: 'white',
  padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #E8DFD0',
}

// Szczegóły karmy (skład, wartości odżywcze) — pełne dane dociągane z bazy przy rozwinięciu
export default function ProductDetails({ product }: { product: Product }) {
  const [details, setDetails] = useState<Product | null>(null)

  useEffect(() => {
    let alive = true
    supabase.from('products').select('*').eq('id', product.id).maybeSingle()
      .then(({ data }) => { if (alive) setDetails((data as Product | null) ?? product) })
    return () => { alive = false }
  }, [product])

  if (!details) return (
    <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>⏳ Ładuję szczegóły…</div>
  )
  const d = details

  const nutrients = [
    { l: 'Białko', v: d.bialko }, { l: 'Tłuszcz', v: d.tluszcz }, { l: 'Włókno', v: d.wlokno },
    { l: 'Wilgotność', v: d.wilgotnosc }, { l: 'Energia', v: d.energia },
    { l: 'Mięso', v: d.meat_percent ? `${d.meat_percent}%` : null },
  ].filter(n => n.v)

  return (
    <div style={{ padding: '0.75rem', background: '#fafafa', borderRadius: '0.75rem' }}>
      {nutrients.length > 0 && (
        <>
          <p style={heading}>Wartości odżywcze</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {nutrients.map(n => (
              <div key={n.l} style={{ background: 'white', borderRadius: '0.5rem', padding: '0.4rem', textAlign: 'center', border: '1px solid #E8DFD0' }}>
                <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>{n.l}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1b5c3a' }}>{n.v}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {(d.proteins?.length ?? 0) > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={heading}>Źródła białka</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {d.proteins.map(p => (
              <span key={p} style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8' }}>
                {PROTEIN_LABELS[p] || p}
              </span>
            ))}
            {d.is_grain_free && (
              <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: 20, background: '#d9ede2', color: '#1b5c3a' }}>🌿 Bezzbożowa</span>
            )}
          </div>
        </div>
      )}

      <p style={heading}>Pełny skład</p>
      {d.sklad
        ? <p style={{ ...panel, marginBottom: d.opis ? '0.75rem' : 0 }}>{d.sklad}</p>
        : <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>Brak danych o składzie</p>}

      {d.opis && (
        <>
          <p style={heading}>Opis producenta</p>
          <div style={panel}>
            {d.opis.split(/Wskazania|Zalety|Przeciwwskazania|Podawanie|Składniki/).map((section, i) =>
              section.trim() ? <p key={i} style={{ margin: '0 0 0.5rem' }}>{section.trim()}</p> : null)}
          </div>
        </>
      )}
    </div>
  )
}
