import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'
import { SEED_PRODUCTS } from '../data/seed'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      // Pobierz wszystkie produkty partiami (Supabase limit = 1000 na zapytanie)
      let all: Product[] = []
      let from = 0
      const step = 1000

      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('cena', { ascending: true })
          .range(from, from + step - 1)

        if (error || !data) break
        all = [...all, ...data]
        if (data.length < step) break
        from += step
      }

      if (all.length === 0) {
        // Fallback: seed lokalny
        setProducts(SEED_PRODUCTS.map((p, i) => ({ ...p, id: `seed-${i}` })))
      } else {
        setProducts(all)
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return { products, loading }
}
