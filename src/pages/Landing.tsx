import { Link } from 'react-router-dom'

const STEPS = [
  { icon:'📋', title:'Powiedz nam o pupilu', desc:'Wypełnij krótki quiz — wiek, waga, zdrowie, preferencje.' },
  { icon:'🔍', title:'Otrzymujesz rekomendacje', desc:'Nasz algorytm dobiera najlepsze karmy z bazy 1000+ produktów.' },
  { icon:'📦', title:'Regularne dostawy', desc:'Karma przyjeżdża pod drzwi w wybranym rytmie.' },
]

const TESTIMONIALS = [
  { name:'Karolina S.', pet:'Kot Mruczek', text:'W końcu mój Mruczek je z apetytem! Karma idealnie dobrana do jego wrażliwego brzuszka.' },
  { name:'Piotr K.', pet:'Pies Bruno', text:'Super serwis, szybka dostawa i realne oszczędności. Polecam każdemu właścicielowi psa.' },
  { name:'Ania W.', pet:'Dwa koty', text:'Mam dwa koty o różnych potrzebach — PawBox dopasował oddzielny zestaw dla każdego.' },
]

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section style={{background:'linear-gradient(135deg,#1b5c3a 0%,#2d7a50 100%)', color:'white', padding:'5rem 1rem', textAlign:'center'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'clamp(2rem,5vw,3.5rem)', marginBottom:'1rem', lineHeight:1.2}}>
          Karma dla Twojego pupila.<br/>Dobrana specjalnie dla niego.
        </h1>
        <p style={{fontSize:'1.125rem', opacity:0.85, maxWidth:600, margin:'0 auto 2rem'}}>
          Subskrypcyjna dostawa karm dla kotów i psów — dobierana na podstawie wieku, wagi i stanu zdrowia Twojego zwierzaka.
        </p>
        <Link to="/quiz" className="btn-primary" style={{fontSize:'1.125rem', padding:'1rem 2.5rem', display:'inline-block'}}>
          Zacznij quiz → 
        </Link>
        <p style={{marginTop:'1rem', opacity:0.7, fontSize:'0.875rem'}}>Zajmuje 2 minuty • Bezpłatne</p>
      </section>

      {/* Stats */}
      <section style={{background:'white', padding:'2rem 1rem'}}>
        <div style={{maxWidth:800, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', textAlign:'center'}}>
          {[['12 000+','zadowolonych pupili'],['1 159','produktów w bazie'],['4.8★','średnia ocena']].map(([v,l]) => (
            <div key={l}>
              <div style={{fontSize:'1.75rem', fontWeight:700, color:'#1b5c3a'}}>{v}</div>
              <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Jak to działa */}
      <section style={{padding:'4rem 1rem', background:'#FAF6EF'}}>
        <div style={{maxWidth:900, margin:'0 auto'}}>
          <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', textAlign:'center', marginBottom:'3rem'}}>Jak to działa?</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'2rem'}}>
            {STEPS.map((s,i) => (
              <div key={i} className="card" style={{textAlign:'center'}}>
                <div style={{fontSize:'2.5rem', marginBottom:'1rem'}}>{s.icon}</div>
                <div style={{fontSize:'0.75rem', color:'#1b5c3a', fontWeight:600, marginBottom:'0.5rem'}}>KROK {i+1}</div>
                <h3 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.125rem', marginBottom:'0.5rem'}}>{s.title}</h3>
                <p style={{color:'#6b7280', fontSize:'0.875rem'}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Opinie */}
      <section style={{padding:'4rem 1rem', background:'white'}}>
        <div style={{maxWidth:900, margin:'0 auto'}}>
          <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', textAlign:'center', marginBottom:'3rem'}}>Co mówią właściciele?</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:'1.5rem'}}>
            {TESTIMONIALS.map((t,i) => (
              <div key={i} className="card">
                <p style={{color:'#374151', fontStyle:'italic', marginBottom:'1rem'}}>"{t.text}"</p>
                <div style={{fontWeight:600}}>{t.name}</div>
                <div style={{fontSize:'0.875rem', color:'#6b7280'}}>{t.pet}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{background:'#C4622D', color:'white', padding:'4rem 1rem', textAlign:'center'}}>
        <h2 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'1rem'}}>Gotowy na pierwszy PawBox?</h2>
        <p style={{opacity:0.9, marginBottom:'2rem'}}>Dołącz do tysięcy szczęśliwych pupili już dziś.</p>
        <Link to="/quiz" style={{background:'white', color:'#C4622D', padding:'1rem 2.5rem', borderRadius:'0.75rem', fontWeight:600, textDecoration:'none', fontSize:'1.125rem'}}>
          Zacznij quiz →
        </Link>
      </section>
    </div>
  )
}
