export default function Footer() {
  return (
    <footer style={{background:'#144830', color:'white', padding:'3rem 1rem', marginTop:'4rem'}}>
      <div style={{maxWidth:1024, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'2rem'}}>
        <div>
          <h3 style={{fontFamily:'Lora,Georgia,serif', fontSize:'1.25rem', marginBottom:'0.75rem'}}>🐾 PawBox</h3>
          <p style={{color:'#9FE1CB', fontSize:'0.875rem', lineHeight:1.6}}>Subskrypcyjna karma dla kotów i psów, dobierana indywidualnie.</p>
        </div>
        <div>
          <h4 style={{marginBottom:'0.75rem'}}>Szybkie linki</h4>
          <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
            <a href="/quiz" style={{color:'#9FE1CB', fontSize:'0.875rem'}}>Zacznij quiz</a>
            <a href="/auth" style={{color:'#9FE1CB', fontSize:'0.875rem'}}>Zaloguj się</a>
          </div>
        </div>
        <div>
          <h4 style={{marginBottom:'0.75rem'}}>Kontakt</h4>
          <p style={{color:'#9FE1CB', fontSize:'0.875rem'}}>kontakt@pawbox.pl</p>
          <p style={{color:'#9FE1CB', fontSize:'0.875rem', marginTop:'0.5rem'}}>Ponad 12 000 zadowolonych pupili 🐾</p>
        </div>
      </div>
      <div style={{maxWidth:1024, margin:'2rem auto 0', paddingTop:'2rem', borderTop:'1px solid #1B5C3A', textAlign:'center', color:'#5DCAA5', fontSize:'0.875rem'}}>
        © 2025 PawBox. Wszelkie prawa zastrzeżone.
      </div>
    </footer>
  )
}
