import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL        = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const SITE_URL            = process.env.SITE_URL || 'https://pawbox-eta.vercel.app'

async function sb(path: string, options: RequestInit = {}) {
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

async function getUserEmail(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await res.json()
  return data?.email || null
}

async function sendEmail(to: string, type: string, data: object) {
  try {
    await fetch(`${SITE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data }),
    })
  } catch (e) {
    console.error('Email error:', e)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today     = new Date().toISOString().split('T')[0]
  const in2days   = new Date(); in2days.setDate(in2days.getDate() + 2)
  const in2daysStr = in2days.toISOString().split('T')[0]

  let renewed = 0, reminded = 0

  // ── Odnów subskrypcje ────────────────────────────────────────────────────
  const renewData = await (await sb(
    `/subscriptions?status=eq.active&next_delivery_date=lte.${today}&select=*`
  )).json()

  for (const sub of (Array.isArray(renewData) ? renewData : [])) {
    try {
      const next = new Date(sub.next_delivery_date || today)
      next.setDate(next.getDate() + (sub.delivery_frequency_days || 30))
      const nextStr = next.toISOString().split('T')[0]

      await sb('/deliveries', {
        method: 'POST',
        body: JSON.stringify({ subscription_id: sub.id, scheduled_date: nextStr, status: 'pending' }),
        headers: { 'Prefer': 'return=minimal' },
      })
      await sb(`/subscriptions?id=eq.${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ next_delivery_date: nextStr }),
        headers: { 'Prefer': 'return=minimal' },
      })
      renewed++
    } catch (e) { console.error(e) }
  }

  // ── Przypomnij o dostawach za 2 dni ─────────────────────────────────────
  const remindData = await (await sb(
    `/subscriptions?status=eq.active&next_delivery_date=eq.${in2daysStr}&select=*,pets(name),user_profiles(notify_delivery)`
  )).json()

  for (const sub of (Array.isArray(remindData) ? remindData : [])) {
    try {
      if (!sub.user_profiles?.notify_delivery) continue

      const email = await getUserEmail(sub.user_id)
      if (!email) continue

      // Policz karmy w subskrypcji
      const itemsData = await (await sb(
        `/subscription_items?subscription_id=eq.${sub.id}&is_active=eq.true&select=id`
      )).json()
      const itemCount = Array.isArray(itemsData) ? itemsData.length : 0

      await sendEmail(email, 'delivery_reminder', {
        petName:      sub.pets?.name || 'pupila',
        deliveryDate: in2daysStr,
        itemCount,
      })
      reminded++
    } catch (e) { console.error(e) }
  }

  console.log(`Cron: renewed=${renewed}, reminded=${reminded}`)
  return res.status(200).json({ renewed, reminded })
}
