import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Pet } from '../types'

interface SubWithPet {
  id: string
  plan_type: 'starter' | 'comfort' | 'premium'
  status: 'active' | 'paused' | 'cancelled'
  next_delivery_date: string | null
  delivery_frequency_days: number
  pet_id: string | null
  pets: { name: string; species: string } | null
  items_count: number
}

const PLAN_EMOJI = { starter: '🌱', comfort: '⭐', premium: '💎' }
const PLAN_NAME  = { starter: 'Podstawowy', comfort: 'Komfortowy', premium: 'Premium' }

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function Dashboard({ session }: { session: Session }) {
  const [subs, setSubs] = useState<SubWithPet[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [subsRes, petsRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select(`
            id, plan_type, status, next_delivery_date, delivery_frequency_days, pet_id,
            pets ( name, species ),
            subscription_items ( id )
          `)
          .eq('user_id', session.user.id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        supabase
          .from('pets')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at'),
      ])

      if (subsRes.data) {
        setSubs(subsRes.data.map((s: any) => ({
          ...s,
          items_count: s.subscription_items?.length || 0,
        })))
      }
      if (petsRes.data) setPets(petsRes.data)
      setLoading(false)
    }
    load()
  }, [session])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'#1b5c3a', fontFamily:'Lora,Georgia,serif' }}>Ładowanie...</p>
    </div>
  )

  const activeSubs  = subs.filter(s => s.status === 'active')
  const pausedSubs  = subs.filter(s => s.status === 'paused')

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>

        {/* Nagłówek */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem' }}>
          <div>
            <h1 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'2rem', margin:0 }}>Cześć! 🐾</h1>
            <p style={{ color:'#6b7280', margin:'0.25rem 0 0', fontSize:'0.875rem' }}>Witaj w swoim panelu PawBox</p>
          </div>
          <Link to="/quiz" className="btn-primary" style={{ fontSize:'0.875rem', padding:'0.6rem 1.25rem' }}>
            + Nowy zestaw
          </Link>
        </div>

        {/* Aktywne subskrypcje */}
        <h2 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', margin:'0 0 1rem', color:'#144830' }}>
          Moje subskrypcje
          {activeSubs.length > 0 && (
            <span style={{ fontSize:'0.8rem', fontFamily:'DM Sans', background:'#d9ede2', color:'#1b5c3a', padding:'2px 10px', borderRadius:20, marginLeft:'0.75rem', fontWeight:400 }}>
              {activeSubs.length} aktywne
            </span>
          )}
        </h2>

        {subs.length === 0 ? (
          <div style={{ background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'3rem', textAlign:'center', marginBottom:'1.5rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🐾</div>
            <p style={{ color:'#6b7280', marginBottom:'1.5rem' }}>Nie masz jeszcze żadnej subskrypcji</p>
            <Link to="/quiz" className="btn-primary">Zacznij quiz →</Link>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginBottom:'2rem' }}>
            {subs.map(sub => {
              const days = daysUntil(sub.next_delivery_date)
              const petName = sub.pets?.name
              const petSpecies = sub.pets?.species

              return (
                <div key={sub.id} style={{ background:'white', borderRadius:'1rem', border:`1px solid ${sub.status==='active' ? '#E8DFD0' : '#f3f4f6'}`, padding:'1.25rem', opacity: sub.status === 'paused' ? 0.7 : 1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>

                    {/* Plan */}
                    <span style={{ fontSize:'1.75rem' }}>
                      {PLAN_EMOJI[sub.plan_type]}
                    </span>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:180 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                        <span style={{ fontWeight:600, fontSize:'1rem' }}>
                          {PLAN_NAME[sub.plan_type]}
                        </span>
                        {/* Pupil badge */}
                        {petName && (
                          <span style={{ fontSize:'0.8rem', padding:'2px 10px', borderRadius:20, background:'#f0f7f3', color:'#1b5c3a', border:'1px solid #d9ede2' }}>
                            {petSpecies === 'cat' ? '🐱' : '🐶'} {petName}
                          </span>
                        )}
                        {!petName && (
                          <span style={{ fontSize:'0.8rem', padding:'2px 10px', borderRadius:20, background:'#f3f4f6', color:'#9ca3af' }}>
                            Pupil nieprzypisany
                          </span>
                        )}
                        {/* Status */}
                        <span style={{ fontSize:'0.75rem', padding:'2px 8px', borderRadius:20, background: sub.status==='active' ? '#d9ede2' : '#fef3c7', color: sub.status==='active' ? '#1b5c3a' : '#92400e' }}>
                          {sub.status === 'active' ? 'Aktywna' : 'Wstrzymana'}
                        </span>
                      </div>
                      <div style={{ fontSize:'0.8rem', color:'#6b7280', marginTop:'0.3rem' }}>
                        {sub.items_count} karm · co {sub.delivery_frequency_days} dni
                      </div>
                    </div>

                    {/* Następna dostawa */}
                    {sub.next_delivery_date && (
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>Następna dostawa</div>
                        <div style={{ fontWeight:700, color:'#1b5c3a', fontSize:'0.95rem' }}>
                          {new Date(sub.next_delivery_date).toLocaleDateString('pl-PL', { day:'numeric', month:'short' })}
                        </div>
                        {days !== null && (
                          <div style={{ fontSize:'0.75rem', color: days <= 3 ? '#C4622D' : '#6b7280' }}>
                            {days === 0 ? 'Dzisiaj!' : days < 0 ? 'Do przetworzenia' : `za ${days} dni`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Akcje */}
                    <Link to="/subscription"
                      style={{ padding:'0.45rem 1rem', borderRadius:'0.5rem', border:'1px solid #E8DFD0', background:'white', fontSize:'0.8rem', color:'#374151', textDecoration:'none', flexShrink:0 }}>
                      Zarządzaj →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pupile */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1rem' }}>
          <div style={{ background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.25rem' }}>
            <h2 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 1rem', color:'#144830' }}>
              Moje pupile
            </h2>
            {pets.length === 0 ? (
              <div style={{ textAlign:'center', padding:'1rem 0' }}>
                <p style={{ color:'#6b7280', fontSize:'0.875rem', marginBottom:'1rem' }}>
                  Brak pupili
                </p>
                <Link to="/pets" className="btn-secondary" style={{ fontSize:'0.8rem', padding:'0.4rem 1rem' }}>
                  Dodaj pupila
                </Link>
              </div>
            ) : (
              <>
                {pets.map(pet => {
                  const petSubs = subs.filter(s => s.pet_id === pet.id && s.status === 'active')
                  return (
                    <div key={pet.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.65rem 0', borderBottom:'1px solid #f3f4f6' }}>
                      <span style={{ fontSize:'1.5rem' }}>{pet.species === 'cat' ? '🐱' : '🐶'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{pet.name}</div>
                        <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>
                          {pet.weight_kg} kg · {pet.age_group === 'kitten' ? 'Kocię' : pet.age_group === 'adult' ? 'Dorosły' : 'Senior'}
                        </div>
                      </div>
                      {petSubs.length > 0 ? (
                        <span style={{ fontSize:'0.7rem', padding:'2px 7px', borderRadius:20, background:'#d9ede2', color:'#1b5c3a' }}>
                          aktywna
                        </span>
                      ) : (
                        <Link to="/quiz" style={{ fontSize:'0.7rem', padding:'2px 7px', borderRadius:20, background:'#fef3c7', color:'#92400e', textDecoration:'none' }}>
                          + zestaw
                        </Link>
                      )}
                    </div>
                  )
                })}
                <Link to="/pets" style={{ display:'block', fontSize:'0.8rem', color:'#1b5c3a', marginTop:'0.75rem', textDecoration:'none' }}>
                  Zarządzaj pupilami →
                </Link>
              </>
            )}
          </div>

          {/* Szybkie akcje */}
          <div style={{ background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.25rem' }}>
            <h2 style={{ fontFamily:'Lora,Georgia,serif', fontSize:'1.1rem', margin:'0 0 1rem', color:'#144830' }}>
              Szybkie akcje
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              <Link to="/quiz" style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', borderRadius:'0.75rem', background:'#f0f7f3', textDecoration:'none', color:'#1b5c3a' }}>
                <span style={{ fontSize:'1.25rem' }}>🔍</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.875rem' }}>Nowy quiz</div>
                  <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>Dobierz karmy dla pupila</div>
                </div>
              </Link>
              <Link to="/subscription" style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', borderRadius:'0.75rem', background:'#faf6ef', textDecoration:'none', color:'#374151' }}>
                <span style={{ fontSize:'1.25rem' }}>📦</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.875rem' }}>Zarządzaj dostawą</div>
                  <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>Zmień karmy lub częstotliwość</div>
                </div>
              </Link>
              <Link to="/pets" style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', borderRadius:'0.75rem', background:'#faf6ef', textDecoration:'none', color:'#374151' }}>
                <span style={{ fontSize:'1.25rem' }}>🐾</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.875rem' }}>Moje pupile</div>
                  <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>Edytuj profile zwierząt</div>
                </div>
              </Link>
              <Link to="/settings" style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', borderRadius:'0.75rem', background:'#faf6ef', textDecoration:'none', color:'#374151' }}>
                <span style={{ fontSize:'1.25rem' }}>⚙️</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.875rem' }}>Ustawienia</div>
                  <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>Adres, hasło, powiadomienia</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
