import type { PetProfile } from '../types'

// Zamówienie przekazywane z /recommendations do /checkout (sessionStorage).
export interface PendingOrderItem {
  product_id:    string
  nazwa:         string
  grams_per_day: number
}

export interface PendingOrder {
  plan:        'starter' | 'comfort' | 'premium'
  period_days: number
  profile:     PetProfile
  items:       PendingOrderItem[]
}

const KEY = 'pendingOrder'

export const PLAN_RANK = { starter: 0, comfort: 1, premium: 2 } as const

export function savePendingOrder(order: PendingOrder) {
  sessionStorage.setItem(KEY, JSON.stringify(order))
}

export function loadPendingOrder(): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as PendingOrder
    return o && Array.isArray(o.items) && o.profile ? o : null
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
