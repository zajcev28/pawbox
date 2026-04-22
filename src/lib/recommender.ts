import type { Product, PetProfile, ScoredProduct } from '../types'

export function calculateDailyCalories(
  weight: number,
  ageGroup: 'kitten' | 'adult' | 'senior',
  activityLevel: 'low' | 'medium' | 'high',
  species: 'cat' | 'dog'
): number {
  const rer = 70 * Math.pow(weight, 0.75)
  const mult: Record<string, any> = {
    cat: { kitten: 2.5, adult: { low: 1.0, medium: 1.2, high: 1.4 }, senior: 1.1 },
    dog: { kitten: 3.0, adult: { low: 1.4, medium: 1.6, high: 1.8 }, senior: 1.2 },
  }
  const m = mult[species]
  const multiplier = ageGroup === 'adult'
    ? m.adult[activityLevel]
    : m[ageGroup] as number
  return Math.round(rer * multiplier)
}

function parsePercent(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace('%','').replace(',','.').trim())
  return isNaN(n) ? null : n
}

function scoreProduct(product: Product, profile: PetProfile) {
  let score = 100
  const reasons: string[] = []
  const warnings: string[] = []
  const nazwa = product.nazwa.toLowerCase()
  const sklad = (product.sklad || '').toLowerCase()
  const opis = ((product as any).opis || '').toLowerCase()
  const fullText = nazwa + ' ' + sklad + ' ' + opis

  // Wiek
  if (profile.age_group === 'kitten') {
    if (/kitten|kocięt|junior|szczenięt|puppy/.test(nazwa)) { score += 35; reasons.push('Dedykowana karma dla młodych zwierząt') }
    if (/senior|light|sterilised/.test(nazwa)) { score -= 60; warnings.push('Nieodpowiednia dla kociąt/szczeniąt') }
  } else if (profile.age_group === 'senior') {
    if (/senior|mature|11[+]|7[+]/.test(nazwa)) { score += 30; reasons.push('Formuła dla starszych zwierząt') }
    const p = parsePercent(product.bialko); if (p !== null && p < 32) { score += 10; reasons.push('Umiarkowane białko — dobre dla seniora') }
  }

  // Aktywność / waga
  const fat = parsePercent(product.tluszcz)
  const overweight = profile.health_conditions.includes('overweight')
  if (profile.activity_level === 'low' || overweight) {
    if (/light|sterilised|weight/.test(nazwa)) { score += 30; reasons.push('Formuła light — wspiera kontrolę wagi') }
    if (fat !== null && fat < 7)  { score += 20; reasons.push('Niska zawartość tłuszczu — idealne przy nadwadze') }
    if (fat !== null && fat > 14) { score -= 25; warnings.push('Wysoka zawartość tłuszczu — nie zalecana przy nadwadze') }
  }
  if (profile.activity_level === 'high' && fat !== null && fat > 10) {
    score += 15; reasons.push('Wyższa kaloryczność dla aktywnych zwierząt')
  }

  // Alergie — dyskwalifikacja
  const allergyMap: Record<string, string[]> = {
    grain:   [],  // obsłużone przez is_grain_free
    chicken: ['kurczak','drób'],
    fish:    ['łosoś','tuńczyk','ryb'],
    beef:    ['wołowin'],
    soy:     ['soja'],
    dairy:   ['mleko','nabiał','laktoza'],
  }
  for (const allergy of profile.allergies) {
    if (allergy === 'grain' && !product.is_grain_free) {
      score -= 999; warnings.push('Zawiera zboża — wykluczone')
    } else {
      const words = allergyMap[allergy] || []
      if (words.some(w => sklad.includes(w))) { score -= 999; warnings.push(`Zawiera alergen: ${allergy}`) }
    }
  }

  // Grain-free
  if (profile.health_conditions.includes('sensitive_digestion') || profile.allergies.includes('grain')) {
    if (product.is_grain_free) { score += 25; reasons.push('Bezzbożowa — idealna przy wrażliwym układzie') }
  } else if (product.is_grain_free) {
    score += 8; reasons.push('Bezzbożowa — wyższa jakość składu')
  }

  // Choroby
  if (profile.health_conditions.includes('kidney')) {
    if (/renal|kidney|nerkow|niewydolność nerek|przewlekła niewydolność/.test(fullText)) { score += 60; reasons.push('Formuła weterynaryjna dla nerek') }
    else {
      const p = parsePercent(product.bialko)
      if (p !== null && p < 22) { score += 40; reasons.push('Niskie białko — wspiera funkcję nerek') }
      if (p !== null && p > 38) { score -= 35; warnings.push('Wysokie białko może obciążać nerki') }
    }
  }
  if (profile.health_conditions.includes('sensitive_digestion')) {
    if (/gastro|sensitive|digestive|wrażliwy układ|żołądek|jelita|trawien/.test(fullText)) { score += 50; reasons.push('Formuła dla wrażliwego układu') }
    if (product.proteins.length === 1) { score += 20; reasons.push('Monoproteinowa — mniej ryzyko nietolerancji') }
  }
  if (profile.health_conditions.includes('skin_coat')) {
    if (/omega|olej z łososia|olej lniany|biotin/.test(sklad)) { score += 30; reasons.push('Omega-3 wspomagają sierść i skórę') }
    if (product.proteins.includes('salmon') || /łosoś|salmon|omega/.test(opis)) { score += 20; reasons.push('Łosoś bogaty w kwasy Omega-3') }
  }
  if (profile.health_conditions.includes('dental') && product.food_type === 'dry') {
    score += 15; reasons.push('Sucha karma mechanicznie czyści zęby')
  }

  // Typ karmy
  if (profile.food_type === 'dry' && product.food_type === 'wet') score -= 200
  if (profile.food_type === 'wet' && product.food_type === 'dry') score -= 200

  // Procent mięsa
  if (product.meat_percent !== null) {
    if (product.meat_percent >= 70)      { score += 40; reasons.push(`Bardzo wysokie mięso (${product.meat_percent}%)`) }
    else if (product.meat_percent >= 50) { score += 25; reasons.push(`Wysoka zawartość mięsa (${product.meat_percent}%)`) }
    else if (product.meat_percent >= 30) { score += 12; reasons.push(`Dobra zawartość mięsa (${product.meat_percent}%)`) }
  }

  return { score, reasons: reasons.slice(0,3), warnings: warnings.slice(0,2) }
}

function calcMonthly(product: Product, dailyCal: number) {
  let kcalPer100g = product.food_type === 'dry' ? 350 : 80
  if (product.energia) {
    const m = product.energia.match(/(\d+)/)
    if (m) kcalPer100g = parseInt(m[1])
  }
  const dailyGrams = Math.round((dailyCal / kcalPer100g) * 100)
  const estMonthlyCost = Math.round((dailyGrams * 30 / 1000) * ((product.cena || 10) * 3.5))
  return { daily_grams: dailyGrams, monthly_price_est: estMonthlyCost }
}

export function getRecommendations(products: Product[], profile: PetProfile): ScoredProduct[] {
  const dailyCal = calculateDailyCalories(profile.weight_kg, profile.age_group, profile.activity_level, profile.species)
  const filtered = products.filter(p => p.species === profile.species || p.species === 'both')
  const scored = filtered
    .map(p => { const s = scoreProduct(p, profile); const m = calcMonthly(p, dailyCal); return {...p, ...s, ...m} })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)

  if (profile.food_type !== 'mixed') return scored.slice(0, 8)
  const result: ScoredProduct[] = []
  const counts = { dry: 0, wet: 0 }
  for (const p of scored) {
    const t = p.food_type as 'dry' | 'wet'
    if (counts[t] < 4) { result.push(p); counts[t]++ }
    if (result.length >= 8) break
  }
  return result
}
