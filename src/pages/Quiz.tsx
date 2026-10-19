import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Pet, PetProfile } from '../types'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AuthForm from '../components/AuthForm'

const HEALTH = [
  { value:'overweight', label:'⚖️ Nadwaga' },
  { value:'sensitive_digestion', label:'🫃 Wrażliwy układ pokarmowy' },
  { value:'kidney', label:'🔴 Problemy z nerkami' },
  { value:'skin_coat', label:'✨ Problemy ze skórą i sierścią' },
  { value:'dental', label:'🦷 Problemy dentystyczne' },
]
const ALLERGIES = [
  { value:'grain',   label:'Zboża' },
  { value:'chicken', label:'Kurczak' },
  { value:'fish',    label:'Ryby' },
  { value:'beef',    label:'Wołowina' },
  { value:'soy',     label:'Soja' },
  { value:'dairy',   label:'Nabiał' },
]

export default function Quiz() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [step, setStep] = useState(1)
  const [searchParams] = useSearchParams()
  const petParam = searchParams.get('pet')
  const [showAuth, setShowAuth] = useState(false)
  const [mode, setMode] = useState<'choose' | 'quiz' | 'manual'>(petParam ? 'quiz' : 'choose')
  const [p, setP] = useState<Partial<PetProfile>>({
    name:'', species:'cat', age_group:'adult', weight_kg:4,
    activity_level:'medium', health_conditions:[], allergies:[], food_type:'mixed'
  })

  // Quiz dla istniejącego pupila (link „+ zestaw” z panelu) — wypełnij danymi z bazy
  const userId = session?.user?.id
  useEffect(() => {
    if (!petParam || !userId) return
    supabase.from('pets').select('*').eq('id', petParam).eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        const pet = data as Pet | null
        if (!pet) return
        setP({
          pet_id: pet.id, name: pet.name, species: pet.species, age_group: pet.age_group,
          weight_kg: Number(pet.weight_kg) || 4, activity_level: pet.activity_level,
          health_conditions: pet.health_conditions ?? [], allergies: pet.allergies ?? [],
          food_type: pet.food_type ?? 'mixed',
        })
      })
  }, [petParam, userId])

  const upd = (k: keyof PetProfile, v: unknown) => setP(prev => ({...prev, [k]:v}))
  const toggle = (k: 'health_conditions'|'allergies', v: string) => {
    const arr = (p[k]||[]) as string[]
    upd(k, arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v])
  }

  const TOTAL = 5
  const progress = (step/TOTAL)*100

  const cardStyle: React.CSSProperties = {
    background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'2rem'
  }
  const sel = (active: boolean): React.CSSProperties => ({
    border: `2px solid ${active ? '#1b5c3a' : '#E8DFD0'}`,
    background: active ? '#f0f7f3' : 'white',
    borderRadius:'0.75rem', padding:'1rem', cursor:'pointer', textAlign:'left', width:'100%',
  })

  const handleFinish = (chosen: 'quiz' | 'manual' = 'quiz') => {
    const profile: Partial<PetProfile> = chosen === 'manual'
      // „Wiem, czego chcę”: bez propozycji, profil tylko do wyliczenia porcji
      ? { ...p, mode: 'manual', activity_level: p.activity_level || 'medium', health_conditions: [], allergies: [], food_type: 'mixed' }
      : { ...p, mode: 'quiz' }
    sessionStorage.setItem('quizProfile', JSON.stringify(profile))
    if (session) {
      navigate('/recommendations')
    } else {
      setShowAuth(true)
    }
  }

  const authModal = showAuth ? (
        <div onClick={e => { if (e.target === e.currentTarget) setShowAuth(false) }}
          style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
          <div style={{background:'white', borderRadius:'1.25rem', padding:'2rem', width:'100%', maxWidth:420}}>

            <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem', margin:'0 0 0.5rem'}}>🐾 Prawie gotowe!</h2>
              <p style={{color:'#6b7280', fontSize:'0.875rem', margin:0}}>
                Załóż konto żeby zobaczyć rekomendacje i zarządzać subskrypcją
              </p>
            </div>

            <AuthForm initialTab="register"
              onSignedIn={() => { setShowAuth(false); navigate('/recommendations') }}
              submitLabel={{ register:'Utwórz konto i kontynuuj →', login:'Zaloguj się i kontynuuj →' }} />

            <button onClick={() => setShowAuth(false)}
              style={{display:'block', margin:'0.75rem auto 0', background:'none', border:'none', color:'#9ca3af', fontSize:'0.8rem', cursor:'pointer'}}>
              ← Wróć do quizu
            </button>
          </div>
        </div>
  ) : null

  const speciesPicker = (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.25rem'}}>
      {(['cat','dog'] as const).map(s => (
        <button key={s} type="button" onClick={()=>upd('species',s)} style={{...sel(p.species===s), textAlign:'center', padding:'1.25rem'}}>
          <span style={{fontSize:'2.25rem', display:'block', marginBottom:'0.4rem'}}>{s==='cat'?'🐱':'🐶'}</span>
          <span style={{fontWeight:600}}>{s==='cat'?'Kot':'Pies'}</span>
        </button>
      ))}
    </div>
  )

  const agePicker = (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', marginBottom:'1.25rem'}}>
      {[{v:'kitten',l:p.species==='dog'?'Szczenię':'Kocię',s:'< 1 rok'},{v:'adult',l:'Dorosły',s:'1–7 lat'},{v:'senior',l:'Senior',s:'7+ lat'}].map(o=>(
        <button key={o.v} type="button" onClick={()=>upd('age_group',o.v)} style={{...sel(p.age_group===o.v), textAlign:'center'}}>
          <div style={{fontWeight:600}}>{o.l}</div>
          <div style={{fontSize:'0.75rem', color:'#6b7280'}}>{o.s}</div>
        </button>
      ))}
    </div>
  )

  const weightPicker = (
    <>
      <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.5rem'}}>
        Waga: <strong style={{color:'#1b5c3a'}}>{p.weight_kg} kg</strong>
      </label>
      <input type="range" min="0.5" max="80" step="0.5" value={p.weight_kg}
        onChange={e=>upd('weight_kg',parseFloat(e.target.value))} style={{width:'100%', accentColor:'#1b5c3a'}} aria-label="Waga pupila" />
      <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af'}}>
        <span>0.5 kg</span><span>80 kg</span>
      </div>
    </>
  )

  // ── Start: dwie ścieżki ────────────────────────────────────────────────
  if (mode === 'choose') return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:640, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', textAlign:'center', margin:'0 0 0.5rem'}}>Jak chcesz zacząć?</h1>
        <p style={{textAlign:'center', color:'#6b7280', margin:'0 0 2rem'}}>W obu przypadkach na końcu sam decydujesz, co trafi do boxa.</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'1rem'}}>
          {[
            { m:'quiz' as const,   icon:'🔍', title:'Pomóż mi dobrać', text:'5 krótkich pytań o pupila — zaproponujemy karmy i porcje, a Ty je dopasujesz.', cta:'Zacznij quiz →' },
            { m:'manual' as const, icon:'🛒', title:'Wiem, czego chcę', text:'Od razu do katalogu. Podaj tylko gatunek i wagę, żebyśmy policzyli porcje.', cta:'Do katalogu →' },
          ].map(o => (
            <button key={o.m} type="button" onClick={() => setMode(o.m)}
              style={{...cardStyle, padding:'1.5rem', textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', gap:'0.5rem'}}>
              <span style={{fontSize:'2.25rem'}}>{o.icon}</span>
              <span style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', fontWeight:700, color:'#144830'}}>{o.title}</span>
              <span style={{fontSize:'0.875rem', color:'#6b7280', lineHeight:1.5, flex:1}}>{o.text}</span>
              <span style={{color:'#1b5c3a', fontWeight:600, fontSize:'0.9rem'}}>{o.cta}</span>
            </button>
          ))}
        </div>
      </div>
      {authModal}
    </div>
  )

  // ── „Wiem, czego chcę” ─────────────────────────────────────────────────
  if (mode === 'manual') return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:560, margin:'0 auto'}}>
        <div style={cardStyle}>
          <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.6rem', margin:'0 0 0.4rem'}}>Dla kogo box?</h2>
          <p style={{fontSize:'0.875rem', color:'#6b7280', margin:'0 0 1.25rem'}}>Tyle wystarczy, żeby policzyć porcje. Karmy wybierzesz sam.</p>
          {speciesPicker}
          <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.5rem'}}>Imię pupila</label>
          <input className="input" value={p.name} onChange={e=>upd('name',e.target.value)} placeholder="np. Mruczek, Burek..." style={{marginBottom:'1.25rem'}} />
          {agePicker}
          {weightPicker}
          <div style={{display:'flex', justifyContent:'space-between', marginTop:'2rem', gap:'0.75rem'}}>
            <button type="button" className="btn-secondary" onClick={() => setMode('choose')}>← Wróć</button>
            <button type="button" className="btn-primary" disabled={!p.name?.trim()} onClick={() => handleFinish('manual')}
              style={{opacity: p.name?.trim() ? 1 : 0.5}}>
              Do katalogu →
            </button>
          </div>
        </div>
      </div>
      {authModal}
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:560, margin:'0 auto'}}>

        {/* Pasek postępu */}
        <div style={{marginBottom:'2rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.875rem', color:'#6b7280', marginBottom:'0.5rem'}}>
            <span>Krok {step} z {TOTAL}</span><span>{Math.round(progress)}%</span>
          </div>
          <div style={{height:8, background:'#E8DFD0', borderRadius:4, overflow:'hidden'}}>
            <div style={{height:'100%', background:'#1b5c3a', borderRadius:4, width:`${progress}%`, transition:'width 0.4s'}} />
          </div>
        </div>

        <div style={cardStyle}>
          {/* Krok 1 */}
          {step===1 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Powiedz nam o swoim pupilu</h2>
              {speciesPicker}
              <label style={{display:'block', fontSize:'0.875rem', marginBottom:'0.5rem'}}>Imię pupila</label>
              <input className="input" value={p.name} onChange={e=>upd('name',e.target.value)} placeholder="np. Mruczek, Burek..." />
            </div>
          )}

          {/* Krok 2 */}
          {step===2 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Wiek i waga {p.name||'pupila'}</h2>
              {agePicker}
              {weightPicker}
            </div>
          )}

          {/* Krok 3 */}
          {step===3 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Jak aktywny jest {p.name||'pupil'}?</h2>
              <div style={{display:'grid', gap:'0.75rem'}}>
                {[
                  {v:'low',  i:'🛋️', l:'Mała aktywność', s:'Kanapowiec, śpi większość dnia'},
                  {v:'medium',i:'🚶', l:'Umiarkowana',    s:'Standardowa aktywność'},
                  {v:'high', i:'🏃', l:'Bardzo aktywny', s:'Dużo zabawy i spacerów'},
                ].map(o=>(
                  <button key={o.v} onClick={()=>upd('activity_level',o.v)}
                    style={{...sel(p.activity_level===o.v), display:'flex', alignItems:'center', gap:'1rem'}}>
                    <span style={{fontSize:'1.75rem'}}>{o.i}</span>
                    <div>
                      <div style={{fontWeight:600}}>{o.l}</div>
                      <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{o.s}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Krok 4 */}
          {step===4 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Stan zdrowia</h2>
              <div style={{display:'grid', gap:'0.5rem'}}>
                {HEALTH.map(h => {
                  const active = ((p.health_conditions||[]) as string[]).includes(h.value)
                  return (
                    <button key={h.value} onClick={()=>toggle('health_conditions',h.value)}
                      style={{...sel(active), display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem'}}>
                      <div style={{width:20, height:20, borderRadius:4, border:`2px solid ${active?'#1b5c3a':'#d1d5db'}`, background:active?'#1b5c3a':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        {active && <span style={{color:'white', fontSize:'0.75rem'}}>✓</span>}
                      </div>
                      <span style={{fontSize:'0.875rem'}}>{h.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Krok 5 */}
          {step===5 && (
            <div>
              <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.75rem', marginBottom:'1.5rem'}}>Alergie i preferencje</h2>
              <p style={{fontSize:'0.875rem', fontWeight:600, marginBottom:'0.75rem'}}>Alergie lub nietolerancje:</p>
              <div style={{display:'flex', flexWrap:'wrap', gap:'0.5rem', marginBottom:'1.5rem'}}>
                {ALLERGIES.map(a => {
                  const active = ((p.allergies||[]) as string[]).includes(a.value)
                  return (
                    <button key={a.value} onClick={()=>toggle('allergies',a.value)}
                      style={{padding:'0.5rem 1rem', borderRadius:20, border:`2px solid ${active?'#C4622D':'#E8DFD0'}`, background:active?'#C4622D':'white', color:active?'white':'#374151', fontSize:'0.875rem', cursor:'pointer'}}>
                      {a.label}
                    </button>
                  )
                })}
              </div>
              <p style={{fontSize:'0.875rem', fontWeight:600, marginBottom:'0.75rem'}}>Preferencja karmy:</p>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem'}}>
                {[{v:'dry',l:'🥜 Tylko sucha'},{v:'wet',l:'💧 Tylko mokra'},{v:'mixed',l:'🔄 Mieszana'}].map(o=>(
                  <button key={o.v} onClick={()=>upd('food_type',o.v)}
                    style={{...sel(p.food_type===o.v), textAlign:'center', padding:'0.75rem 0.5rem', fontSize:'0.875rem'}}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nawigacja */}
          <div style={{display:'flex', justifyContent:'space-between', marginTop:'2rem'}}>
            <button onClick={() => step === 1 ? setMode('choose') : setStep(s => s-1)} disabled={step===1 && !!petParam}
              className="btn-secondary" style={{opacity:step===1 && petParam ? 0.3 : 1}}>
              ← Wróć
            </button>
            <button className="btn-primary" onClick={() => {
              if (step < TOTAL) setStep(s => s+1)
              else handleFinish()
            }}>
              {step===TOTAL ? '🔍 Znajdź karmy →' : 'Dalej →'}
            </button>
          </div>
        </div>
      </div>

      {authModal}
    </div>
  )
}
