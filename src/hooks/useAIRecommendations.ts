import { useState } from 'react'
import type { Product, PetProfile, ScoredProduct } from '../types'

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
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, products }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Błąd serwera')
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

    } catch (e: any) {
      console.error('AI recommendations error:', e)
      setError(e.message || 'Nie udało się pobrać rekomendacji AI')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { getRecommendations, loading, error }
}
