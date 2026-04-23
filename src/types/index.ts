export interface Product {
  id: string
  nazwa: string
  cena: number | null
  bialko: string | null
  tluszcz: string | null
  wlokno: string | null
  wilgotnosc: string | null
  energia: string | null
  sklad: string | null
  species: 'cat' | 'dog' | 'both'
  food_type: 'dry' | 'wet'
  is_grain_free: boolean
  proteins: string[]
  meat_percent: number | null
}

export interface Pet {
  id: string
  user_id: string
  name: string
  species: 'cat' | 'dog'
  breed?: string
  age_group: 'kitten' | 'adult' | 'senior'
  weight_kg: number
  activity_level: 'low' | 'medium' | 'high'
  health_conditions: string[]
  allergies: string[]
  food_type: 'dry' | 'wet' | 'mixed'
  avatar_url?: string
}

export interface PetProfile {
  name: string
  species: 'cat' | 'dog'
  age_group: 'kitten' | 'adult' | 'senior'
  weight_kg: number
  activity_level: 'low' | 'medium' | 'high'
  health_conditions: string[]
  allergies: string[]
  food_type: 'dry' | 'wet' | 'mixed'
}

export interface ScoredProduct extends Product {
  score: number
  reasons: string[]
  warnings: string[]
  daily_grams: number
  monthly_price_est: number
}

export interface Subscription {
  id: string
  user_id: string
  pet_id: string | null
  plan_type: 'starter' | 'comfort' | 'premium'
  status: 'active' | 'paused' | 'cancelled'
  delivery_frequency_days: number
  next_delivery_date: string | null
}

export interface SubscriptionItem {
  id: string
  subscription_id: string
  product_id: string
  quantity_g: number
  is_active: boolean
  product?: Product
}

