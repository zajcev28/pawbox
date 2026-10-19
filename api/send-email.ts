import type { VercelRequest, VercelResponse } from '@vercel/node'

// Endpoint wywoływany z przeglądarki po złożeniu zamówienia.
// Bezpieczeństwo:
//  - wymaga tokenu zalogowanego użytkownika (Authorization: Bearer <access_token>)
//  - mail idzie WYŁĄCZNIE na adres z tokenu, nigdy na adres podany w body
//  - treść maila jest budowana z bazy (po subscriptionId), nie z danych od klienta
//  - wysyłka tylko dla świeżej subskrypcji (do 15 min od utworzenia)
// Przypomnienia o dostawie wysyła cron bezpośrednio przez Brevo — nie przez ten endpoint.

const SUPABASE_URL         = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const BREVO_API_KEY        = process.env.BREVO_API_KEY!
const FROM_EMAIL           = process.env.BREVO_FROM_EMAIL || 'kontakt@pawbox.pl'
const SITE_URL             = process.env.SITE_URL || 'https://pawbox-eta.vercel.app'
const MAX_AGE_MS           = 15 * 60 * 1000

interface AuthUser { id: string; email: string }

async function getUserFromToken(req: VercelRequest): Promise<AuthUser | null> {
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Bearer ')) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: header },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id && user?.email ? { id: user.id, email: user.email } : null
}

async function sb(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.json()
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const PLAN_NAME: Record<string, string> = { starter: 'Podstawowy', comfort: 'Komfortowy', premium: 'Premium' }

function orderHtml(d: { orderId: string; petName: string; planName: string; nextDelivery: string; itemCount: number }) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#FAF6EF;padding:40px 20px">
  <h1 style="text-align:center;color:#1B5C3A">🐾 PawBox</h1>
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E8DFD0">
    <h2 style="color:#144830;margin-top:0">Zamówienie przyjęte! 🎉</h2>
    <p style="color:#374151;line-height:1.6">Dziękujemy! Twój PawBox dla <strong>${esc(d.petName)}</strong> jest już w przygotowaniu.</p>
    <table style="width:100%;background:#f0f7f3;border-radius:12px;padding:12px 20px;margin:24px 0;font-size:14px;border-collapse:separate">
      <tr><td style="color:#6b7280;padding:6px 0">Numer zamówienia</td><td style="text-align:right;font-weight:bold">#${esc(d.orderId.substring(0, 8).toUpperCase())}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Plan</td><td style="text-align:right;font-weight:bold">${esc(d.planName)}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Liczba karm</td><td style="text-align:right;font-weight:bold">${esc(d.itemCount)}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Pierwsza dostawa</td><td style="text-align:right;font-weight:bold;color:#1B5C3A">${esc(d.nextDelivery)}</td></tr>
    </table>
    <div style="text-align:center">
      <a href="${SITE_URL}/dashboard" style="background:#1B5C3A;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Przejdź do panelu →</a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">© ${new Date().getFullYear()} PawBox · Karma dobierana z miłością 🐾</p>
</div>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!BREVO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const user = await getUserFromToken(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { type, subscriptionId } = req.body || {}
  if (type !== 'order_confirmation') return res.status(400).json({ error: 'Unknown type' })
  if (typeof subscriptionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(subscriptionId)) {
    return res.status(400).json({ error: 'Invalid subscriptionId' })
  }

  try {
    const subs = await sb(
      `/subscriptions?id=eq.${subscriptionId}&select=id,user_id,plan_type,next_delivery_date,created_at,pets(name),subscription_items(id)`
    )
    const sub = Array.isArray(subs) ? subs[0] : null
    if (!sub || sub.user_id !== user.id) return res.status(404).json({ error: 'Not found' })
    if (Date.now() - new Date(sub.created_at).getTime() > MAX_AGE_MS) {
      return res.status(409).json({ error: 'Confirmation window expired' })
    }

    const brevo = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: 'PawBox', email: FROM_EMAIL },
        to:          [{ email: user.email }],
        subject:     `🐾 PawBox #${sub.id.substring(0, 8).toUpperCase()} — zamówienie przyjęte!`,
        htmlContent: orderHtml({
          orderId:      sub.id,
          petName:      sub.pets?.name || 'Twojego pupila',
          planName:     PLAN_NAME[sub.plan_type] || sub.plan_type,
          nextDelivery: sub.next_delivery_date || '—',
          itemCount:    sub.subscription_items?.length || 0,
        }),
      }),
    })
    if (!brevo.ok) throw new Error(`Brevo ${brevo.status}: ${await brevo.text()}`)

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('send-email error:', e)
    return res.status(500).json({ error: 'Email failed' })
  }
}
