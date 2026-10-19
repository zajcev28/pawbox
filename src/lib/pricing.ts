// ─────────────────────────────────────────────────────────────────────────────
// Ceny, opakowania i statusy boxa.
// Wszystkie liczby biznesowe (progi, rabaty, dostawa) są TUTAJ — zmiana warunków
// z hurtownią = zmiana tego pliku, bez szukania po kodzie.
// ─────────────────────────────────────────────────────────────────────────────

export type TierId = 'starter' | 'comfort' | 'premium'

export interface Tier {
  id:           TierId
  name:         string
  emoji:        string
  minMonthly:   number   // próg: wartość karm w przeliczeniu na 30 dni (PLN, przed rabatem)
  discount:     number   // % rabatu na karmy
  freeShipping: boolean
}

export const TIERS: Tier[] = [
  { id: 'starter', name: 'Podstawowy', emoji: '🌱', minMonthly: 0,   discount: 0,  freeShipping: false },
  { id: 'comfort', name: 'Komfortowy', emoji: '⭐', minMonthly: 150, discount: 5,  freeShipping: false },
  { id: 'premium', name: 'Premium',    emoji: '💎', minMonthly: 300, discount: 10, freeShipping: true  },
]

export function tierPerks(t: Tier): string {
  if (t.discount === 0) return 'ceny regularne'
  return `rabat ${t.discount}%` + (t.freeShipping ? ' i darmowa dostawa' : '')
}

export const TIER_BY_ID: Record<TierId, Tier> = Object.fromEntries(TIERS.map(t => [t.id, t])) as Record<TierId, Tier>

export const SHIPPING_PLN = 14.99          // koszt wysyłki jednej dostawy
const FALLBACK_PRICE      = 10             // gdy karma nie ma ceny w katalogu
const FALLBACK_PACK_G     = { dry: 2000, wet: 400 } as const

// ── Opakowania ───────────────────────────────────────────────────────────────

export interface Pack { grams: number; estimated: boolean }

const num = (s: string) => parseFloat(s.replace(',', '.'))
const toGrams = (v: number, unit: string) => unit.toLowerCase() === 'kg' ? v * 1000 : v   // ml ≈ g

// Gramatura jednego opakowania odczytana z nazwy, np.
// „op. 2kg”, „op. 6x85g”, „op. 15kg+3kg (18kg)”, „poj. 135ml Pakiet 6szt.”
export function packFromName(nazwa: string, foodType: 'dry' | 'wet'): Pack {
  const name = nazwa.replace(/\s+/g, ' ')

  // Suma w nawiasie wygrywa: „15kg+3kg (18kg)”
  const total = name.match(/\((\d+(?:[.,]\d+)?)\s*(kg|g|ml)\)/i)
  if (total) return { grams: Math.round(toGrams(num(total[1]), total[2])), estimated: false }

  // Część po „op.”/„poj.” (bez gratisów)
  const at = name.search(/\b(op|poj)\./i)
  const part = (at >= 0 ? name.slice(at) : name).split(/\bGRATIS\b|\s\+\s/i)[0]

  const multi  = part.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml)\b/i)
  const single = part.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml)\b/i)

  let grams: number | null = null
  if (multi && (!single || (multi.index ?? 0) <= (single.index ?? 0))) {
    grams = parseInt(multi[1]) * toGrams(num(multi[2]), multi[3])
  } else if (single) {
    grams = toGrams(num(single[1]), single[2])
    const pak = name.match(/pakiet\s*(\d+)\s*szt/i)
    if (pak) grams *= parseInt(pak[1])
  }

  if (!grams || !Number.isFinite(grams) || grams < 20) return { grams: FALLBACK_PACK_G[foodType], estimated: true }
  return { grams: Math.round(grams), estimated: false }
}

export function fmtPack(grams: number): string {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} kg`
    : `${grams} g`
}

export const fmtPLN = (v: number) =>
  v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'

// ── Pozycje i box ────────────────────────────────────────────────────────────

export interface PriceInput {
  nazwa:      string
  cena:       number | string | null
  food_type:  'dry' | 'wet'
  quantity_g: number              // gramy potrzebne na jedną dostawę
}

export interface PricedLine extends PriceInput {
  pack:      Pack
  packs:     number               // ile opakowań w dostawie (pełne opakowania)
  unitPrice: number
  price:     number               // packs × unitPrice
}

export function priceLine(i: PriceInput): PricedLine {
  const pack = packFromName(i.nazwa, i.food_type)
  const packs = Math.max(1, Math.ceil((i.quantity_g || 0) / pack.grams - 0.05))  // 5% tolerancji, żeby 2,02 worka nie robiło się 3
  const unitPrice = Number(i.cena) > 0 ? Number(i.cena) : FALLBACK_PRICE
  return { ...i, pack, packs, unitPrice, price: round2(packs * unitPrice) }
}

export interface BoxPricing {
  lines:          PricedLine[]
  foodTotal:      number         // karmy w jednej dostawie, przed rabatem
  monthlyValue:   number         // foodTotal przeliczone na 30 dni — od tego zależy status
  tier:           Tier
  nextTier:       Tier | null
  missingMonthly: number         // ile brakuje miesięcznie do kolejnego statusu
  discountPLN:    number
  shipping:       number
  total:          number         // do zapłaty za jedną dostawę
  totalMonthly:   number
}

export function tierFor(monthlyValue: number): Tier {
  return [...TIERS].reverse().find(t => monthlyValue >= t.minMonthly) ?? TIERS[0]
}

export function priceBox(items: PriceInput[], frequencyDays: number): BoxPricing {
  const freq = Math.max(1, frequencyDays || 30)
  const lines = items.map(priceLine)
  const foodTotal = round2(lines.reduce((s, l) => s + l.price, 0))
  const monthlyValue = round2(foodTotal * 30 / freq)
  const tier = tierFor(monthlyValue)
  const nextTier = TIERS.find(t => t.minMonthly > tier.minMonthly) ?? null
  const discountPLN = round2(foodTotal * tier.discount / 100)
  const shipping = lines.length === 0 || tier.freeShipping ? 0 : SHIPPING_PLN
  const total = round2(foodTotal - discountPLN + shipping)
  return {
    lines, foodTotal, monthlyValue, tier, nextTier,
    missingMonthly: nextTier ? round2(nextTier.minMonthly - monthlyValue) : 0,
    discountPLN, shipping, total,
    totalMonthly: round2(total * 30 / freq),
  }
}

function round2(v: number) { return Math.round(v * 100) / 100 }
