import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_API_URL         = 'https://api.groq.com/openai/v1/chat/completions'
const SUPABASE_URL         = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const MAX_PRODUCTS         = 15

const HEALTH    = ['overweight', 'sensitive_digestion', 'kidney', 'skin_coat', 'dental']
const ALLERGIES = ['grain', 'chicken', 'fish', 'beef', 'soy', 'dairy']

async function isLoggedIn(req: VercelRequest): Promise<boolean> {
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Bearer ')) return false
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: header },
  })
  return res.ok
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback
const listOf = (v: unknown, allowed: string[]) =>
  Array.isArray(v) ? v.filter((x): x is string => allowed.includes(x)) : []

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  if (!(await isLoggedIn(req))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body || {}
  if (!body.profile || !Array.isArray(body.products) || body.products.length === 0) {
    return res.status(400).json({ error: 'Missing profile or products' })
  }

  // Profil tylko z dozwolonych wartości — nic z body nie trafia do promptu bez filtra
  const weight = Number(body.profile.weight_kg)
  const profile = {
    name:              str(body.profile.name, 40).replace(/[\r\n]/g, ' '),
    species:           oneOf(body.profile.species, ['cat', 'dog'] as const, 'cat'),
    age_group:         oneOf(body.profile.age_group, ['kitten', 'adult', 'senior'] as const, 'adult'),
    activity_level:    oneOf(body.profile.activity_level, ['low', 'medium', 'high'] as const, 'medium'),
    food_type:         oneOf(body.profile.food_type, ['dry', 'wet', 'mixed'] as const, 'mixed'),
    weight_kg:         Number.isFinite(weight) ? Math.min(Math.max(weight, 0.5), 80) : 4,
    health_conditions: listOf(body.profile.health_conditions, HEALTH),
    allergies:         listOf(body.profile.allergies, ALLERGIES),
  }
  const products = body.products.slice(0, MAX_PRODUCTS)

  // Każde pole produktu przycięte i bez znaków nowej linii
  const clean = (v: unknown, max: number) => str(v, max).replace(/[\r\n|]/g, ' ')
  interface PromptProduct { idx: number; nazwa: string; bialko: string; tluszcz: string; energia: string; is_grain_free: boolean; food_type: 'dry' | 'wet'; cena: number }
  const productList: PromptProduct[] = products.map((p: Record<string, unknown>, i: number) => ({
    idx:           i,
    nazwa:         clean(p.nazwa, 80),
    bialko:        clean(p.bialko, 12),
    tluszcz:       clean(p.tluszcz, 12),
    energia:       clean(p.energia, 30),
    is_grain_free: p.is_grain_free === true,
    food_type:     p.food_type === 'dry' ? 'dry' : 'wet',
    cena:          Number(p.cena) || 0,
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
        model: 'llama-3.1-8b-instant',
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
