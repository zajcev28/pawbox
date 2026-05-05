import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function supabaseFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Zabezpieczenie — tylko Vercel Cron może wywołać
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today = new Date().toISOString().split('T')[0]

  // Pobierz aktywne subskrypcje których data dostawy minęła lub jest dzisiaj
  const r = await supabaseFetch(
    `/subscriptions?status=eq.active&next_delivery_date=lte.${today}&select=*`
  )
  const subscriptions = await r.json()

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return res.status(200).json({ message: 'Brak subskrypcji do odnowienia', count: 0 })
  }

  let renewed = 0
  const errors: string[] = []

  for (const sub of subscriptions) {
    try {
      // Oblicz następną datę dostawy
      const nextDate = new Date(sub.next_delivery_date || today)
      nextDate.setDate(nextDate.getDate() + (sub.delivery_frequency_days || 30))
      const nextDeliveryDate = nextDate.toISOString().split('T')[0]

      // Utwórz wpis dostawy
      await supabaseFetch('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          subscription_id: sub.id,
          scheduled_date:  nextDeliveryDate,
          status:          'pending',
        }),
        headers: { 'Prefer': 'return=minimal' },
      })

      // Zaktualizuj datę następnej dostawy
      await supabaseFetch(`/subscriptions?id=eq.${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ next_delivery_date: nextDeliveryDate }),
        headers: { 'Prefer': 'return=minimal' },
      })

      renewed++
    } catch (e) {
      errors.push(`Sub ${sub.id}: ${e}`)
    }
  }

  console.log(`Cron: odnowiono ${renewed} subskrypcji, błędy: ${errors.length}`)

  return res.status(200).json({
    message: `Odnowiono ${renewed} subskrypcji`,
    renewed,
    errors,
  })
}
