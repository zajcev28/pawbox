import type { VercelRequest, VercelResponse } from '@vercel/node'

// Codzienny cron (vercel.json, 08:00 UTC):
//  1. Subskrypcje z next_delivery_date <= dziś: tworzy dostawę NA TEN termin (pending)
//     i przesuwa next_delivery_date o delivery_frequency_days.
//  2. Subskrypcje z dostawą za 2 dni: wysyła przypomnienie (tylko gdy user ma notify_delivery).

const SUPABASE_URL         = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const BREVO_API_KEY        = process.env.BREVO_API_KEY
const FROM_EMAIL           = process.env.BREVO_FROM_EMAIL || 'kontakt@pawbox.pl'
const SITE_URL             = process.env.SITE_URL || 'https://pawbox-eta.vercel.app'
const CRON_SECRET          = process.env.CRON_SECRET

async function sb(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status} ${path}: ${await res.text()}`)
  return res.status === 204 || options.method === 'PATCH' || options.method === 'POST' ? null : res.json()
}

async function getUserEmail(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.email || null
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function reminderHtml(d: { petName: string; deliveryDate: string; itemCount: number }) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#FAF6EF;padding:40px 20px">
  <h1 style="text-align:center;color:#1B5C3A">🐾 PawBox</h1>
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E8DFD0">
    <h2 style="color:#144830;margin-top:0">📦 Twoja dostawa zbliża się!</h2>
    <p style="color:#374151;line-height:1.6">Za 2 dni dostarczymy PawBox dla <strong>${esc(d.petName)}</strong>.</p>
    <div style="background:#f0f7f3;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
      <div style="font-size:13px;color:#6b7280">Data dostawy</div>
      <div style="font-size:24px;font-weight:700;color:#1B5C3A">${esc(d.deliveryDate)}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px">${esc(d.itemCount)} karm w zestawie</div>
    </div>
    <div style="text-align:center">
      <a href="${SITE_URL}/subscription" style="background:#1B5C3A;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Zarządzaj dostawą →</a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">
    © ${new Date().getFullYear()} PawBox · <a href="${SITE_URL}/settings" style="color:#9ca3af">Wyłącz powiadomienia w ustawieniach</a>
  </p>
</div>`
}

async function sendReminder(to: string, data: { petName: string; deliveryDate: string; itemCount: number }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: 'PawBox', email: FROM_EMAIL },
      to:          [{ email: to }],
      subject:     '📦 PawBox — Twoja dostawa za 2 dni!',
      htmlContent: reminderHtml(data),
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!CRON_SECRET || req.headers['authorization'] !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today      = new Date().toISOString().split('T')[0]
  const in2daysStr = addDays(today, 2)
  let renewed = 0, reminded = 0
  const errors: string[] = []

  // ── 1. Dostawy, których termin przypada dziś (lub minął) ─────────────────
  const due = await sb(`/subscriptions?status=eq.active&next_delivery_date=lte.${today}&select=id,next_delivery_date,delivery_frequency_days`)

  for (const sub of due ?? []) {
    try {
      const dueDate = sub.next_delivery_date || today
      const freq    = sub.delivery_frequency_days || 30

      // Dostawa na termin, który właśnie przypada
      await sb('/deliveries', {
        method:  'POST',
        body:    JSON.stringify({ subscription_id: sub.id, scheduled_date: dueDate, status: 'pending' }),
        headers: { Prefer: 'return=minimal' },
      })

      // Następny termin — przesuwamy aż będzie w przyszłości (gdyby cron nie działał kilka dni)
      let next = addDays(dueDate, freq)
      while (next <= today) next = addDays(next, freq)

      await sb(`/subscriptions?id=eq.${sub.id}`, {
        method:  'PATCH',
        body:    JSON.stringify({ next_delivery_date: next }),
        headers: { Prefer: 'return=minimal' },
      })
      renewed++
    } catch (e) {
      errors.push(`renew ${sub.id}: ${e}`)
    }
  }

  // ── 2. Przypomnienia o dostawie za 2 dni ─────────────────────────────────
  // subscriptions i user_profiles nie mają wspólnego klucza obcego (oba wskazują
  // na auth.users), więc profile pobieramy osobnym zapytaniem.
  const upcoming = await sb(`/subscriptions?status=eq.active&next_delivery_date=eq.${in2daysStr}&select=id,user_id,pets(name),subscription_items(id)`)

  if (upcoming?.length) {
    const userIds = [...new Set(upcoming.map((s: { user_id: string }) => s.user_id))]
    const profiles = await sb(`/user_profiles?id=in.(${userIds.join(',')})&notify_delivery=eq.true&select=id`)
    const wantsReminder = new Set((profiles ?? []).map((p: { id: string }) => p.id))

    for (const sub of upcoming) {
      if (!wantsReminder.has(sub.user_id)) continue
      try {
        const email = await getUserEmail(sub.user_id)
        if (!email) continue
        await sendReminder(email, {
          petName:      sub.pets?.name || 'Twojego pupila',
          deliveryDate: in2daysStr,
          itemCount:    sub.subscription_items?.length || 0,
        })
        reminded++
      } catch (e) {
        errors.push(`remind ${sub.id}: ${e}`)
      }
    }
  }

  if (errors.length) console.error('Cron errors:', errors)
  console.log(`Cron: renewed=${renewed}, reminded=${reminded}, errors=${errors.length}`)
  return res.status(errors.length ? 207 : 200).json({ renewed, reminded, errors: errors.length })
}
