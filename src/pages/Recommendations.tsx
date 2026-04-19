import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PetProfile, ScoredProduct } from '../types'
import { getRecommendations, calculateDailyCalories } from '../lib/recommender'
import { useProducts } from '../hooks/useProducts'

const PLANS = [
  { id:'starter' as const, name:'Podstawowy', emoji:'🌱', features:['1 rodzaj karmy','Dostawa co 30 dni','1 pupil'], discount:0, maxFoods:1, featured:false },
  { id:'comfort' as const, name:'Komfortowy', emoji:'⭐', features:['Do 2 rodzajów karm','Dostawa co 14–30 dni','Do 2 pupili','Rabat 5%','Darmowa dostawa od 120 PLN'], discount:5, maxFoods:2, featured:true },
  { id:'premium' as const, name:'Premium', emoji:'💎', features:['Do 4 rodzajów karm','Dowolna częstotliwość','Nieograniczone pupile','Rabat 10%','Zawsze darmowa dostawa'], discount:10, maxFoods:4, featured:false },
]

export default function Recommendations() {
  const navigate = useNavigate()
  const { products, loading } = useProducts()
  const [profile, setProfile] = useState<PetProfile|null>(null)
  const [recs, setRecs] = useState<ScoredProduct[]>([])
  const [plan, setPlan] = useState<'starter'|'comfort'|'premium'>('comfort')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    const s = sessionStorage.getItem('quizProfile')
    if (s) setProfile(JSON.parse(s))
  }, [])

  useEffect(() => {
    if (profile && products.length > 0) setRecs(getRecommendations(products, profile))
  }, [profile, products])

  const planObj = PLANS.find(p=>p.id===plan)!
  const dailyCal = profile ? calculateDailyCalories(profile.weight_kg, profile.age_group, profile.activity_level, profile.species) : 0

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x=>x!==id)
      if (prev.length >= planObj.maxFoods) { alert(`Plan ${planObj.name} pozwala na max ${planObj.maxFoods} rodzaj(e) karmy`); return prev }
      return [...prev, id]
    })
  }

  if (loading||!profile) return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <p style={{fontFamily:'Lora,Georgia,serif', color:'#1b5c3a', fontSize:'1.25rem'}}>🔍 Szukamy najlepszych karm...</p>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>

        {/* Profil */}
        <div style={{background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.5rem', marginBottom:'2rem', display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'center'}}>
          <span style={{fontSize:'2.5rem'}}>{profile.species==='cat'?'🐱':'🐶'}</span>
          <div style={{flex:1}}>
            <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem'}}>{profile.name||'Twój pupil'}</h1>
            <p style={{color:'#6b7280', fontSize:'0.875rem'}}>
              {profile.age_group==='kitten'?'Kocię/Szczenię':profile.age_group==='adult'?'Dorosły':'Senior'} · {profile.weight_kg} kg · {profile.activity_level==='low'?'Mała aktywność':profile.activity_level==='medium'?'Umiarkowana':'Bardzo aktywny'}
            </p>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'1.75rem', fontWeight:700, color:'#1b5c3a'}}>{dailyCal} kcal</div>
            <div style={{fontSize:'0.75rem', color:'#6b7280'}}>dziennego zapotrzebowania</div>
          </div>
        </div>

        <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem', marginBottom:'0.5rem'}}>Rekomendowane karmy</h2>
        <p style={{color:'#6b7280', fontSize:'0.875rem', marginBottom:'1.5rem'}}>
          Wybierz do {planObj.maxFoods} karm (plan {planObj.name}). Wybrano: {selected.length}/{planObj.maxFoods}
        </p>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem', marginBottom:'3rem'}}>
          {recs.map(prod => {
            const isSel = selected.includes(prod.id)
            return (
              <div key={prod.id} onClick={()=>toggle(prod.id)}
                style={{background:'white', borderRadius:'1rem', border:`2px solid ${isSel?'#1b5c3a':'#E8DFD0'}`, padding:'1.25rem', cursor:'pointer', background:isSel?'#f0f7f3':'white', transition:'all 0.2s'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.75rem'}}>
                  <div style={{flex:1, marginRight:'0.75rem'}}>
                    <p style={{fontSize:'0.8rem', fontWeight:600, lineHeight:1.4, marginBottom:'0.5rem'}}>{prod.nazwa.substring(0,70)}{prod.nazwa.length>70?'...':''}</p>
                    <div style={{display:'flex', gap:'0.25rem', flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.7rem', padding:'2px 8px', borderRadius:20, background:prod.food_type==='wet'?'#dbeafe':'#fef3c7', color:prod.food_type==='wet'?'#1d4ed8':'#92400e'}}>
                        {prod.food_type==='wet'?'💧 Mokra':'🥜 Sucha'}
                      </span>
                      {prod.is_grain_free && <span style={{fontSize:'0.7rem', padding:'2px 8px', borderRadius:20, background:'#d9ede2', color:'#1b5c3a'}}>🌿 Bezzbożowa</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right', flexShrink:0}}>
                    <div style={{fontWeight:700, color:'#1b5c3a', fontSize:'1rem'}}>{prod.cena?.toFixed(2)} zł</div>
                    {isSel && <div style={{fontSize:'0.7rem', color:'#1b5c3a'}}>✓ Wybrana</div>}
                  </div>
                </div>
                <div style={{display:'flex', gap:'0.5rem', marginBottom:'0.75rem'}}>
                  {[{l:'Białko',v:prod.bialko},{l:'Tłuszcz',v:prod.tluszcz}].filter(n=>n.v).map(n=>(
                    <div key={n.l} style={{flex:1, background:'#F9F7F4', borderRadius:'0.5rem', padding:'0.4rem', textAlign:'center'}}>
                      <div style={{fontSize:'0.65rem', color:'#6b7280'}}>{n.l}</div>
                      <div style={{fontSize:'0.75rem', fontWeight:600}}>{n.v}</div>
                    </div>
                  ))}
                </div>
                {prod.reasons.map((r,i) => <div key={i} style={{fontSize:'0.75rem', color:'#1b5c3a', display:'flex', gap:'0.25rem', marginBottom:'0.2rem'}}><span>✓</span>{r}</div>)}
                {prod.warnings.map((w,i) => <div key={i} style={{fontSize:'0.75rem', color:'#d97706', display:'flex', gap:'0.25rem', marginBottom:'0.2rem'}}><span>⚠</span>{w}</div>)}
              </div>
            )
          })}
        </div>

        {/* Plany */}
        <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.5rem', marginBottom:'1.5rem'}}>Wybierz plan subskrypcji</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem', marginBottom:'2rem'}}>
          {PLANS.map(pl => (
            <div key={pl.id} onClick={()=>setPlan(pl.id)}
              style={{background:'white', borderRadius:'1rem', border:`2px solid ${plan===pl.id?'#1b5c3a':'#E8DFD0'}`, padding:'1.5rem', cursor:'pointer', position:'relative', transform:pl.featured?'translateY(-4px)':'none', transition:'all 0.2s'}}>
              {pl.featured && <div style={{position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#C4622D', color:'white', fontSize:'0.7rem', padding:'3px 12px', borderRadius:20}}>Polecany</div>}
              <div style={{fontSize:'2rem', marginBottom:'0.5rem'}}>{pl.emoji}</div>
              <h3 style={{fontFamily:'Lora,Georgia,serif', marginBottom:'0.5rem'}}>{pl.name}</h3>
              {pl.discount>0 && <div style={{color:'#C4622D', fontSize:'0.875rem', fontWeight:600, marginBottom:'0.5rem'}}>Rabat {pl.discount}%</div>}
              <ul style={{listStyle:'none', padding:0, fontSize:'0.8rem', color:'#6b7280'}}>
                {pl.features.map((f,i)=><li key={i} style={{marginBottom:'0.25rem'}}>✓ {f}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div style={{textAlign:'center'}}>
          <button onClick={()=>{ sessionStorage.setItem('selectedPlan',plan); sessionStorage.setItem('selectedProducts',JSON.stringify(selected)); navigate('/checkout') }}
            disabled={selected.length===0} className="btn-primary"
            style={{fontSize:'1.125rem', padding:'1rem 3rem', opacity:selected.length===0?0.4:1}}>
            {selected.length===0 ? 'Wybierz min. 1 karmę' : `Zamów plan ${planObj.name} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
