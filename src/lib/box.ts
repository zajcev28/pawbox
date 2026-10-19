import { supabase } from './supabase'
import { priceBox, type BoxPricing, type PriceInput } from './pricing'

interface Row {
  plan_type: string
  delivery_frequency_days: number | null
  subscription_items: { quantity_g: number; products: { nazwa: string; cena: number | null; food_type: 'dry' | 'wet' } | null }[] | null
}

// Przelicza status boxa z jego zawartości i zapisuje go, jeśli się zmienił.
// (Status to tylko oznaczenie — przy wprowadzaniu płatności cenę trzeba liczyć po stronie serwera.)
export async function syncBoxTier(subscriptionId: string): Promise<BoxPricing | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_type, delivery_frequency_days, subscription_items ( quantity_g, products ( nazwa, cena, food_type ) )')
    .eq('id', subscriptionId)
    .maybeSingle()
  const row = data as unknown as Row | null
  if (!row) return null

  const items: PriceInput[] = (row.subscription_items ?? [])
    .filter(i => i.products)
    .map(i => ({ nazwa: i.products!.nazwa, cena: i.products!.cena, food_type: i.products!.food_type, quantity_g: i.quantity_g }))
  const pricing = priceBox(items, row.delivery_frequency_days || 30)

  if (pricing.tier.id !== row.plan_type) {
    await supabase.from('subscriptions').update({ plan_type: pricing.tier.id }).eq('id', subscriptionId)
  }
  return pricing
}
