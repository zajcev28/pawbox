import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
  }

  const { profile, products } = req.body

  if (!profile || !products) {
    return res.status(400).json({ error: 'Missing profile or products' })
  }

  // Przygotuj uproszczoną listę produktów dla AI (max 30 pozycji)
  const productList = products.slice(0, 15).map((p: any, i: number) => ({
    idx: i,
    nazwa: p.nazwa?.substring(0, 80),
    bialko: p.bialko,
    tluszcz: p.tluszcz,
    wlokno: p.wlokno,
    wilgotnosc: p.wilgotnosc,
    energia: p.energia,
    is_grain_free: p.is_grain_free,
    proteins: p.proteins,
    food_type: p.food_type,
    cena: p.cena,
  }))

  const prompt = `Jesteś ekspertem od żywienia kotów i psów. Na podstawie profilu pupila i listy dostępnych karm, wybierz najlepsze dopasowanie.

PROFIL PUPILA:
- Gatunek: ${profile.species === 'cat' ? 'KOT' : 'PIES'}
- Imię: ${profile.name}
- Wiek: ${profile.age_group === 'kitten' ? 'Kocię/Szczenię (< 1 rok)' : profile.age_group === 'adult' ? 'Dorosły (1-7 lat)' : 'Senior (7+ lat)'}
- Waga: ${profile.weight_kg} kg
- Aktywność: ${profile.activity_level === 'low' ? 'Mała' : profile.activity_level === 'medium' ? 'Umiarkowana' : 'Wysoka'}
- Problemy zdrowotne: ${profile.health_conditions?.length ? profile.health_conditions.join(', ') : 'Brak'}
- Alergie: ${profile.allergies?.length ? profile.allergies.join(', ') : 'Brak'}
- Preferencja karmy: ${profile.food_type === 'dry' ? 'Tylko sucha' : profile.food_type === 'wet' ? 'Tylko mokra' : 'Mieszana'}

OBLICZENIA ŻYWIENIOWE:
Wzór RER = 70 × waga^0.75
Dla tego pupila RER = ${Math.round(70 * Math.pow(profile.weight_kg, 0.75))} kcal
Dzienny cel kalorii = ${Math.round(70 * Math.pow(profile.weight_kg, 0.75) * (profile.age_group === 'kitten' ? 2.5 : profile.age_group === 'senior' ? 1.1 : profile.activity_level === 'low' ? 1.0 : profile.activity_level === 'medium' ? 1.2 : 1.4))} kcal

DOSTĘPNE KARMY (indeks | nazwa | białko | tłuszcz | energia | bezzbożowa | typ):
${productList.map(p => `[${p.idx}] ${p.nazwa} | B:${p.bialko} | T:${p.tluszcz} | E:${p.energia} | ${p.is_grain_free ? 'bezzbożowa' : 'ze zbożami'} | ${p.food_type === 'wet' ? 'mokra' : 'sucha'} | ${p.cena} zł`).join('\n')}

ZADANIE:
Wybierz 4-6 najlepiej dopasowanych karm. Dla każdej oblicz:
1. Dzienną porcję w gramach (na podstawie wartości energetycznej karmy i dziennego celu kalorii)
2. Uzasadnienie wyboru po polsku (max 2 zdania)

Odpowiedz TYLKO w formacie JSON (bez markdown, bez \`\`\`):
{
  "daily_calories": liczba,
  "recommendations": [
    {
      "idx": numer_indeksu,
      "daily_grams": liczba_gramów_dziennie,
      "reason": "Uzasadnienie po polsku"
    }
  ]
}`

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('Groq error status:', groqRes.status)
      console.error('Groq error body:', err)
      return res.status(502).json({ error: 'Groq API error', status: groqRes.status, details: err })
    }

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''

    // Parsuj JSON z odpowiedzi
    let parsed
    try {
      // Usuń ewentualne markdown backticks
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      console.error('JSON parse error, raw:', text)
      return res.status(502).json({ error: 'Invalid JSON from Groq', raw: text })
    }

    return res.status(200).json(parsed)

  } catch (err) {
    console.error('Fetch error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
