import { useState } from 'react'
import type { Product, PetProfile, ScoredProduct } from '../types'
import { supabase } from '../lib/supabase'

interface AIRecommendation {
  idx: number
  daily_grams: number
  reason: string
}

interface AIResult {
  daily_calories: number
  recommendations: AIRecommendation[]
}

export function useAIRecommendations() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const getRecommendations = async (
    profile: PetProfile,
    products: Product[]
  ): Promise<{ products: ScoredProduct[]; dailyCalories: number } | null> => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Brak sesji — zaloguj się')

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ profile, products }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Błąd serwera (${res.status})`)
      }

      const data: AIResult = await res.json()

      // Mapuj indeksy z AI na produkty
      const scored: ScoredProduct[] = data.recommendations
        .filter(r => r.idx >= 0 && r.idx < products.length)
        .map(r => ({
          ...products[r.idx],
          score:             100,
          reasons:           [r.reason],
          warnings:          [],
          daily_grams:       r.daily_grams,
          monthly_price_est: 0, // obliczane w buildBoxItem
        }))

      return { products: scored, dailyCalories: data.daily_calories }

    } catch (e) {
      console.error('AI recommendations error:', e)
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać rekomendacji AI')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { getRecommendations, loading, error }
}
