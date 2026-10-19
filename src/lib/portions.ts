import { gramsForKcal, parseKcal } from './recommender'

// Porcje liczone w kaloriach. Karmy ustawione ręcznie (custom) zostają nietknięte,
// pozostałe dzielą resztę dziennego zapotrzebowania po równo.
export interface Portion {
  energia:   string | null
  food_type: 'dry' | 'wet'
  gpd:       number          // gramy dziennie
  custom:    boolean
}

export const kcalPer100 = (p: Pick<Portion, 'energia' | 'food_type'>) => parseKcal(p.energia, p.food_type)
export const kcalOf = (p: Portion) => p.gpd * kcalPer100(p) / 100

export function rebalance<T extends Portion>(items: T[], dailyCal: number): T[] {
  const free = items.filter(i => !i.custom)
  if (free.length === 0) return items
  const customKcal = items.filter(i => i.custom).reduce((s, i) => s + kcalOf(i), 0)
  const share = customKcal < dailyCal ? (dailyCal - customKcal) / free.length : dailyCal / items.length
  return items.map(i => i.custom ? i : { ...i, gpd: gramsForKcal(share, i.energia, i.food_type) })
}

// Zalecana porcja przy równym podziale kalorii między wszystkie karmy
export const suggestedGpd = (p: Pick<Portion, 'energia' | 'food_type'>, dailyCal: number, count: number) =>
  gramsForKcal(dailyCal / Math.max(1, count), p.energia, p.food_type)
