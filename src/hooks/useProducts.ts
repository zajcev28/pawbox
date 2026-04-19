import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product } from '../types'
import { SEED_PRODUCTS } from '../data/seed'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('products').select('*').order('cena', { ascending: true })
      if (error || !data || data.length === 0) {
        setProducts(SEED_PRODUCTS.map((p, i) => ({ ...p, id: `seed-${i}` })))
      } else {
        setProducts(data)
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return { products, loading }
}
