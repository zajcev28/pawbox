import type { PetProfile } from '../types'
import type { TierId } from './pricing'

// Zamówienie przekazywane z /recommendations do /checkout (sessionStorage).
export interface PendingOrderItem {
  product_id:    string
  nazwa:         string
  cena:          number | null
  food_type:     'dry' | 'wet'
  grams_per_day: number
}

export interface PendingOrder {
  plan:        TierId          // status wyliczony z wartości boxa w kreatorze
  period_days: number
  profile:     PetProfile
  items:       PendingOrderItem[]
}

const KEY = 'pendingOrder'


export function savePendingOrder(order: PendingOrder) {
  sessionStorage.setItem(KEY, JSON.stringify(order))
}

export function loadPendingOrder(): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as PendingOrder
    return o && Array.isArray(o.items) && o.profile && o.items.every(i => i.food_type) ? o : null
  } catch {
    return null
  }
}

export function clearOrderState() {
  for (const k of [KEY, 'quizProfile', 'selectedPlan', 'selectedProducts', 'boxItems']) {
    sessionStorage.removeItem(k)
  }
}

// Ilość karmy na jedną dostawę (gramy) przy danej częstotliwości dostaw
export function gramsPerDelivery(gramsPerDay: number, frequencyDays: number): number {
  return Math.max(1, Math.round(gramsPerDay * frequencyDays))
}
