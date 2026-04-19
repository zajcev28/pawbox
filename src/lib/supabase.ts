import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Brak zmiennych VITE_SUPABASE_URL lub VITE_SUPABASE_ANON_KEY w .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
