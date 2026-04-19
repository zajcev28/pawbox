import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'

interface Row { [key: string]: string }

function detectSpecies(n: string): 'cat'|'dog'|'both' {
  const s = n.toLowerCase()
  if (s.includes('dla psa i kota')) return 'both'
  if (s.includes('dla psa')||s.includes('szczeniąt')||s.includes('puppy')) return 'dog'
  return 'cat'
}
function detectType(n: string, w: string): 'dry'|'wet' {
  try { const v=parseFloat((w||'').replace('%','').replace(',','.')); if(!isNaN(v)) return v>20?'wet':'dry' } catch {}
  return /sucha|suche/.test(n.toLowerCase()) ? 'dry' : 'wet'
}
function analyzeIngredients(s: string) {
  if (!s) return { is_grain_free:true, proteins:[], meat_percent:null }
  const sl = s.toLowerCase()
  const grains = ['pszenica','kukurydza','ryż','gluten','owies','jęczmień','żyto','mąka zbożowa']
  const is_grain_free = !grains.some(g=>sl.includes(g))
  const pm: Record<string,string[]> = { chicken:['kurczak','drób'], salmon:['łosoś'], beef:['wołowina'], lamb:['jagnięcina'], pork:['wieprzowina'], rabbit:['królik'], tuna:['tuńczyk'], turkey:['indyk'] }
  const proteins = Object.entries(pm).filter(([,w])=>w.some(x=>sl.includes(x))).map(([k])=>k)
  const m = sl.match(/(\d+)[,.]?\d*%\s*(mięso|kurczak|łosoś|wołowina|indyk|jagnięcina|królik|wieprzowina)/)
  return { is_grain_free, proteins, meat_percent: m?parseInt(m[1]):null }
}

export default function AdminImport() {
  const [rows, setRows] = useState<Row[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState('')
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback((files: File[]) => {
    Papa.parse<Row>(files[0], { header:true, skipEmptyLines:true, complete: r => setRows(r.data) })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept:{'text/csv':['.csv']}, maxFiles:1 })

  const doImport = async () => {
    setImporting(true); setProgress(0)
    const products = rows.map(r => {
      const { is_grain_free, proteins, meat_percent } = analyzeIngredients(r['Skład']||'')
      return {
        nazwa: (r['Nazwa']||'').substring(0,200),
        cena: parseFloat(r['Cena'])||null,
        bialko: r['Białko']||null, tluszcz: r['Tłuszcz']||null, wlokno: r['Włókno']||null,
        wilgotnosc: r['Wilgotność']||null, energia: r['Energia']||null, sklad: r['Skład']||null,
        species: detectSpecies(r['Nazwa']||''),
        food_type: detectType(r['Nazwa']||'', r['Wilgotność']||''),
        is_grain_free, proteins, meat_percent,
      }
    })
    let ok = 0
    for (let i=0; i<products.length; i+=100) {
      const { error } = await supabase.from('products').insert(products.slice(i,i+100))
      if (!error) ok += Math.min(100, products.length-i)
      setProgress(Math.round(((i+100)/products.length)*100))
    }
    setImporting(false)
    setResult(`✅ Zaimportowano ${ok} z ${products.length} produktów`)
  }

  return (
    <div style={{minHeight:'100vh', background:'#FAF6EF', padding:'3rem 1rem'}}>
      <div style={{maxWidth:800, margin:'0 auto'}}>
        <h1 style={{fontFamily:'Lora,Georgia,serif', fontSize:'2rem', marginBottom:'0.5rem'}}>Import produktów CSV</h1>
        <p style={{color:'#6b7280', marginBottom:'2rem'}}>Prześlij plik pelne_dane_analityczne_v3.csv</p>

        <div {...getRootProps()} style={{border:`2px dashed ${isDragActive?'#1b5c3a':'#E8DFD0'}`, borderRadius:'1rem', padding:'3rem', textAlign:'center', cursor:'pointer', background:isDragActive?'#f0f7f3':'white', marginBottom:'1.5rem', transition:'all 0.2s'}}>
          <input {...getInputProps()} />
          <div style={{fontSize:'3rem', marginBottom:'0.75rem'}}>📁</div>
          <p style={{color:'#6b7280'}}>{isDragActive?'Upuść plik...':'Przeciągnij plik CSV lub kliknij, żeby wybrać'}</p>
        </div>

        {rows.length>0 && (
          <>
            <div style={{background:'white', borderRadius:'1rem', border:'1px solid #E8DFD0', padding:'1.5rem', marginBottom:'1.5rem', overflowX:'auto'}}>
              <p style={{fontWeight:600, marginBottom:'0.75rem'}}>Podgląd (pierwsze 5 z {rows.length} wierszy):</p>
              <table style={{fontSize:'0.75rem', width:'100%', borderCollapse:'collapse'}}>
                <thead><tr style={{borderBottom:'1px solid #E8DFD0'}}>
                  <th style={{textAlign:'left', padding:'0.5rem'}}>Nazwa</th>
                  <th style={{padding:'0.5rem'}}>Cena</th>
                  <th style={{padding:'0.5rem'}}>Gatunek</th>
                  <th style={{padding:'0.5rem'}}>Typ</th>
                </tr></thead>
                <tbody>
                  {rows.slice(0,5).map((r,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                      <td style={{padding:'0.5rem'}}>{(r['Nazwa']||'').substring(0,55)}...</td>
                      <td style={{padding:'0.5rem', textAlign:'center'}}>{r['Cena']} zł</td>
                      <td style={{padding:'0.5rem', textAlign:'center'}}>{detectSpecies(r['Nazwa']||'')}</td>
                      <td style={{padding:'0.5rem', textAlign:'center'}}>{detectType(r['Nazwa']||'',r['Wilgotność']||'')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importing && (
              <div style={{marginBottom:'1rem'}}>
                <div style={{height:8, background:'#E8DFD0', borderRadius:4, overflow:'hidden'}}>
                  <div style={{height:'100%', background:'#1b5c3a', width:`${progress}%`, transition:'width 0.3s'}} />
                </div>
                <p style={{fontSize:'0.875rem', color:'#6b7280', marginTop:'0.25rem', textAlign:'center'}}>{progress}%</p>
              </div>
            )}

            <button onClick={doImport} disabled={importing} className="btn-primary" style={{width:'100%', padding:'1rem', fontSize:'1rem'}}>
              {importing ? '⏳ Importuję...' : `📥 Importuj ${rows.length} produktów do bazy Supabase`}
            </button>
          </>
        )}

        {result && (
          <div style={{marginTop:'1.5rem', padding:'1rem', background:'#d9ede2', borderRadius:'0.75rem', color:'#1b5c3a', fontWeight:600}}>
            {result}
          </div>
        )}
      </div>
    </div>
  )
}
