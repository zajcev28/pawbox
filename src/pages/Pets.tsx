import { useEffect, useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Pet, PetProfile } from '../types'

const EMPTY: PetProfile = { name:'', species:'cat', age_group:'adult', weight_kg:4, activity_level:'medium', health_conditions:[], allergies:[], food_type:'mixed' }

export default function Pets({ session }: { session: Session }) {
  const [pets, setPets] = useState<Pet[]>([])
  const [form, setForm] = useState<PetProfile>(EMPTY)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => supabase.from('pets').select('*').eq('user_id', session.user.id).then(r => r.data && setPets(r.data))
  useEffect(() => { load() }, [session])

  const save = async () => {
    setSaving(true)
    await supabase.from('pets').insert({ ...form, user_id: session.user.id })
    setAdding(false); setForm(EMPTY); load()
    setSaving(false)
  }

  const remove = async (id: string) => {
    await supabase.from('pets').delete().eq('id', id)
    load()
  }

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:700, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
          <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem'}}>Moje pupile</h1>
          <button onClick={() => setAdding(true)} className="btn-primary" style={{fontSize:'0.875rem'}}>+ Dodaj pupila</button>
        </div>

        {pets.length === 0 && !adding && (
          <div className="card" style={{textAlign:'center', padding:'3rem'}}>
            <div style={{fontSize:'3rem', marginBottom:'1rem'}}>🐾</div>
            <p style={{color:'#6b7280'}}>Nie masz jeszcze żadnych pupili. Dodaj pierwszego!</p>
          </div>
        )}

        {pets.map(p => (
          <div key={p.id} className="card" style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem'}}>
            <span style={{fontSize:'2rem'}}>{p.species==='cat'?'🐱':'🐶'}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600, fontSize:'1.125rem'}}>{p.name}</div>
              <div style={{color:'#6b7280', fontSize:'0.875rem'}}>
                {p.weight_kg} kg · {p.age_group==='kitten'?'Kocię/Szczenię':p.age_group==='adult'?'Dorosły':'Senior'} · {p.activity_level==='low'?'Mała aktywność':p.activity_level==='medium'?'Umiarkowana':'Bardzo aktywny'}
              </div>
            </div>
            <button onClick={() => remove(p.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'1.25rem'}}>🗑</button>
          </div>
        ))}

        {adding && (
          <div className="card" style={{marginTop:'1.5rem'}}>
            <h3 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'1.5rem'}}>Nowy pupil</h3>
            <div style={{display:'grid', gap:'1rem'}}>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Gatunek</label>
                <div style={{display:'flex', gap:'0.5rem'}}>
                  {(['cat','dog'] as const).map(s => (
                    <button key={s} onClick={() => setForm(f=>({...f,species:s}))}
                      style={{flex:1, padding:'0.75rem', borderRadius:'0.75rem', border:`2px solid ${form.species===s?'#1b5c3a':'#E8DFD0'}`, background:form.species===s?'#f0f7f3':'white', cursor:'pointer'}}>
                      {s==='cat'?'🐱 Kot':'🐶 Pies'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Imię</label>
                <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="np. Mruczek" />
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Wiek</label>
                <select className="input" value={form.age_group} onChange={e=>setForm(f=>({...f,age_group:e.target.value as any}))}>
                  <option value="kitten">Kocię/Szczenię (do 1 roku)</option>
                  <option value="adult">Dorosły (1–7 lat)</option>
                  <option value="senior">Senior (7+ lat)</option>
                </select>
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Waga: {form.weight_kg} kg</label>
                <input type="range" min="0.5" max="80" step="0.5" value={form.weight_kg}
                  onChange={e=>setForm(f=>({...f,weight_kg:parseFloat(e.target.value)}))} style={{width:'100%', accentColor:'#1b5c3a'}} />
              </div>
              <div style={{display:'flex', gap:'0.75rem', marginTop:'0.5rem'}}>
                <button onClick={() => { setAdding(false); setForm(EMPTY) }} className="btn-secondary" style={{flex:1}}>Anuluj</button>
                <button onClick={save} disabled={!form.name || saving} className="btn-primary" style={{flex:1}}>
                  {saving ? 'Zapisuję...' : 'Zapisz pupila'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
