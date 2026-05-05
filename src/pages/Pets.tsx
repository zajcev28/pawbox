import { useEffect, useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Pet, PetProfile } from '../types'

const EMPTY: PetProfile = {
  name: '', species: 'cat', age_group: 'adult', weight_kg: 4,
  activity_level: 'medium', health_conditions: [], allergies: [], food_type: 'mixed'
}

const HEALTH_OPTIONS = [
  { value: 'overweight',          label: '⚖️ Nadwaga' },
  { value: 'sensitive_digestion', label: '🫃 Wrażliwy układ pokarmowy' },
  { value: 'kidney',              label: '🔴 Problemy z nerkami' },
  { value: 'skin_coat',           label: '✨ Problemy ze skórą i sierścią' },
  { value: 'dental',              label: '🦷 Problemy dentystyczne' },
]

const ALLERGY_OPTIONS = [
  { value: 'grain',   label: 'Zboża' },
  { value: 'chicken', label: 'Kurczak' },
  { value: 'fish',    label: 'Ryby' },
  { value: 'beef',    label: 'Wołowina' },
  { value: 'soy',     label: 'Soja' },
  { value: 'dairy',   label: 'Nabiał' },
]

function PetForm({
  initial, onSave, onCancel, saving
}: {
  initial: PetProfile
  onSave: (p: PetProfile) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<PetProfile>(initial)

  const upd = (k: keyof PetProfile, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }))

  const toggle = (k: 'health_conditions' | 'allergies', v: string) => {
    const arr = (form[k] || []) as string[]
    upd(k, arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  }

  const s: React.CSSProperties = { display: 'block', fontSize: '0.875rem', marginBottom: '0.3rem', color: '#374151' }
  const sel = (active: boolean): React.CSSProperties => ({
    border: `2px solid ${active ? '#1b5c3a' : '#E8DFD0'}`,
    background: active ? '#f0f7f3' : 'white',
    borderRadius: '0.75rem', padding: '0.65rem 1rem',
    cursor: 'pointer', textAlign: 'left', width: '100%',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Gatunek */}
      <div>
        <label style={s}>Gatunek</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['cat', 'dog'] as const).map(sp => (
            <button key={sp} onClick={() => upd('species', sp)}
              style={{ ...sel(form.species === sp), flex: 1, textAlign: 'center' }}>
              {sp === 'cat' ? '🐱 Kot' : '🐶 Pies'}
            </button>
          ))}
        </div>
      </div>

      {/* Imię */}
      <div>
        <label style={s}>Imię</label>
        <input className="input" value={form.name}
          onChange={e => upd('name', e.target.value)}
          placeholder="np. Mruczek, Burek..." />
      </div>

      {/* Wiek */}
      <div>
        <label style={s}>Wiek</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          {[
            { v: 'kitten', l: 'Kocię/Szczenię', s: '< 1 rok' },
            { v: 'adult',  l: 'Dorosły',         s: '1–7 lat' },
            { v: 'senior', l: 'Senior',           s: '7+ lat' },
          ].map(o => (
            <button key={o.v} onClick={() => upd('age_group', o.v)}
              style={{ ...sel(form.age_group === o.v), textAlign: 'center', padding: '0.6rem 0.4rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{o.l}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{o.s}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Waga */}
      <div>
        <label style={s}>
          Waga: <strong style={{ color: '#1b5c3a' }}>{form.weight_kg} kg</strong>
        </label>
        <input type="range" min="0.5" max="80" step="0.5"
          value={form.weight_kg}
          onChange={e => upd('weight_kg', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#1b5c3a' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af' }}>
          <span>0.5 kg</span><span>80 kg</span>
        </div>
      </div>

      {/* Aktywność */}
      <div>
        <label style={s}>Aktywność</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {[
            { v: 'low',    i: '🛋️', l: 'Mała aktywność',  d: 'Kanapowiec' },
            { v: 'medium', i: '🚶', l: 'Umiarkowana',      d: 'Standardowa' },
            { v: 'high',   i: '🏃', l: 'Bardzo aktywny',   d: 'Dużo zabawy' },
          ].map(o => (
            <button key={o.v} onClick={() => upd('activity_level', o.v)}
              style={{ ...sel(form.activity_level === o.v), display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{o.i}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{o.l}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{o.d}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preferencja karmy */}
      <div>
        <label style={s}>Preferencja karmy</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          {[
            { v: 'dry',   l: '🥜 Tylko sucha' },
            { v: 'wet',   l: '💧 Tylko mokra' },
            { v: 'mixed', l: '🔄 Mieszana' },
          ].map(o => (
            <button key={o.v} onClick={() => upd('food_type', o.v)}
              style={{ ...sel(form.food_type === o.v), textAlign: 'center', fontSize: '0.85rem' }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Stan zdrowia */}
      <div>
        <label style={s}>Stan zdrowia</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {HEALTH_OPTIONS.map(h => {
            const active = ((form.health_conditions || []) as string[]).includes(h.value)
            return (
              <button key={h.value} onClick={() => toggle('health_conditions', h.value)}
                style={{ ...sel(active), display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem' }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${active ? '#1b5c3a' : '#d1d5db'}`, background: active ? '#1b5c3a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {active && <span style={{ color: 'white', fontSize: '0.65rem' }}>✓</span>}
                </div>
                <span style={{ fontSize: '0.875rem' }}>{h.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Alergie */}
      <div>
        <label style={s}>Alergie / nietolerancje</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {ALLERGY_OPTIONS.map(a => {
            const active = ((form.allergies || []) as string[]).includes(a.value)
            return (
              <button key={a.value} onClick={() => toggle('allergies', a.value)}
                style={{ padding: '0.4rem 0.9rem', borderRadius: 20, border: `2px solid ${active ? '#C4622D' : '#E8DFD0'}`, background: active ? '#C4622D' : 'white', color: active ? 'white' : '#374151', fontSize: '0.85rem', cursor: 'pointer' }}>
                {a.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Przyciski */}
      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <button onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>
          Anuluj
        </button>
        <button onClick={() => onSave(form)} disabled={!form.name || saving}
          className="btn-primary" style={{ flex: 1 }}>
          {saving ? '⏳ Zapisuję...' : '✓ Zapisz'}
        </button>
      </div>
    </div>
  )
}

// ─── Główny komponent ─────────────────────────────────────────────────────────
export default function Pets({ session }: { session: Session }) {
  const [pets,    setPets]    = useState<Pet[]>([])
  const [adding,  setAdding]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null) // id do usunięcia

  const load = async () => {
    const { data } = await supabase
      .from('pets').select('*')
      .eq('user_id', session.user.id)
      .order('created_at')
    if (data) setPets(data)
  }

  useEffect(() => { load() }, [session])

  const handleAdd = async (form: PetProfile) => {
    setSaving(true)
    await supabase.from('pets').insert({ ...form, user_id: session.user.id })
    setAdding(false)
    await load()
    setSaving(false)
  }

  const handleEdit = async (form: PetProfile) => {
    if (!editId) return
    setSaving(true)
    await supabase.from('pets').update({
      name:              form.name,
      species:           form.species,
      age_group:         form.age_group,
      weight_kg:         form.weight_kg,
      activity_level:    form.activity_level,
      health_conditions: form.health_conditions,
      allergies:         form.allergies,
      food_type:         form.food_type,
    }).eq('id', editId)
    setEditId(null)
    await load()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('pets').delete().eq('id', id)
    setConfirm(null)
    await load()
  }

  const petToProfile = (pet: Pet): PetProfile => ({
    name:              pet.name,
    species:           pet.species,
    age_group:         pet.age_group,
    weight_kg:         pet.weight_kg,
    activity_level:    pet.activity_level,
    health_conditions: pet.health_conditions || [],
    allergies:         pet.allergies || [],
    food_type:         pet.food_type,
  })

  const card: React.CSSProperties = {
    background: 'white', borderRadius: '1rem',
    border: '1px solid #E8DFD0', padding: '1.25rem', marginBottom: '1rem'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EF', padding: '3rem 1rem' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '2rem', margin: 0 }}>
            Moje pupile
          </h1>
          {!adding && (
            <button onClick={() => { setAdding(true); setEditId(null) }}
              className="btn-primary" style={{ fontSize: '0.875rem' }}>
              + Dodaj pupila
            </button>
          )}
        </div>

        {/* Lista pupili */}
        {pets.length === 0 && !adding && (
          <div style={{ ...card, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐾</div>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Nie masz jeszcze żadnych pupili
            </p>
            <button onClick={() => setAdding(true)} className="btn-primary">
              Dodaj pierwszego pupila
            </button>
          </div>
        )}

        {pets.map(pet => (
          <div key={pet.id} style={card}>
            {editId === pet.id ? (
              <>
                <h3 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.1rem', marginBottom: '1.25rem' }}>
                  Edytuj: {pet.name}
                </h3>
                <PetForm
                  initial={petToProfile(pet)}
                  onSave={handleEdit}
                  onCancel={() => setEditId(null)}
                  saving={saving}
                />
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <span style={{ fontSize: '2.5rem', flexShrink: 0 }}>
                  {pet.species === 'cat' ? '🐱' : '🐶'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                    {pet.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {pet.weight_kg} kg ·{' '}
                    {pet.age_group === 'kitten' ? 'Kocię/Szczenię' : pet.age_group === 'adult' ? 'Dorosły' : 'Senior'} ·{' '}
                    {pet.activity_level === 'low' ? 'Mała aktywność' : pet.activity_level === 'medium' ? 'Umiarkowana' : 'Bardzo aktywny'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 20, background: '#f0f7f3', color: '#1b5c3a' }}>
                      {pet.food_type === 'dry' ? '🥜 Sucha' : pet.food_type === 'wet' ? '💧 Mokra' : '🔄 Mieszana'}
                    </span>
                    {(pet.health_conditions || []).map((h: string) => (
                      <span key={h} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e' }}>
                        {HEALTH_OPTIONS.find(o => o.value === h)?.label || h}
                      </span>
                    ))}
                    {(pet.allergies || []).map((a: string) => (
                      <span key={a} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 20, background: '#fff5f5', color: '#dc2626' }}>
                        ⚠ {ALLERGY_OPTIONS.find(o => o.value === a)?.label || a}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setEditId(pet.id); setAdding(false) }}
                      style={{ padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #E8DFD0', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
                      ✏️ Edytuj
                    </button>
                    <button onClick={() => setConfirm(pet.id)}
                      style={{ padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', fontSize: '0.8rem', color: '#dc2626' }}>
                      🗑 Usuń
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Formularz nowego pupila */}
        {adding && (
          <div style={card}>
            <h3 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '1.25rem', margin: '0 0 1.25rem' }}>
              Nowy pupil
            </h3>
            <PetForm
              initial={EMPTY}
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
              saving={saving}
            />
          </div>
        )}

        {/* Dialog potwierdzenia usunięcia */}
        {confirm && (
          <div onClick={() => setConfirm(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: 360, width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ fontFamily: 'Lora,Georgia,serif', marginBottom: '0.5rem' }}>
                Usuń pupila?
              </h3>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Ta operacja jest nieodwracalna. Subskrypcja powiązana z pupilem zostanie zachowana.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setConfirm(null)}
                  className="btn-secondary" style={{ flex: 1 }}>
                  Anuluj
                </button>
                <button onClick={() => handleDelete(confirm)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Usuń
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
