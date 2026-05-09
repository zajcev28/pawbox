import type { VercelRequest, VercelResponse } from '@vercel/node'

const BREVO_API_KEY = process.env.BREVO_API_KEY!
const BREVO_URL     = 'https://api.brevo.com/v3/smtp/email'
const FROM_EMAIL    = process.env.BREVO_FROM_EMAIL || 'kontakt@pawbox.pl'
const FROM_NAME     = 'PawBox'
const SITE_URL      = process.env.SITE_URL || 'https://pawbox-eta.vercel.app'

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

function orderHtml(d: { orderId: string; petName: string; planName: string; nextDelivery: string; itemCount: number }) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#FAF6EF;padding:40px 20px">
  <h1 style="text-align:center;color:#1B5C3A">🐾 PawBox</h1>
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E8DFD0">
    <h2 style="color:#144830;margin-top:0">Zamówienie przyjęte! 🎉</h2>
    <p style="color:#374151;line-height:1.6">Dziękujemy! Twój PawBox dla <strong>${d.petName}</strong> jest już w przygotowaniu.</p>
    <div style="background:#f0f7f3;border-radius:12px;padding:20px;margin:24px 0;font-size:14px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E8DFD0">
        <span style="color:#6b7280">Numer zamówienia</span>
        <strong>#${d.orderId.substring(0,8).toUpperCase()}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E8DFD0">
        <span style="color:#6b7280">Plan</span>
        <strong style="text-transform:capitalize">${d.planName}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E8DFD0">
        <span style="color:#6b7280">Liczba karm</span>
        <strong>${d.itemCount}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0">
        <span style="color:#6b7280">Pierwsza dostawa</span>
        <strong style="color:#1B5C3A">${d.nextDelivery}</strong>
      </div>
    </div>
    <div style="text-align:center">
      <a href="${SITE_URL}/dashboard" style="background:#1B5C3A;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Przejdź do panelu →</a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">© 2025 PawBox · Karma dobierana z miłością 🐾</p>
</div>`
}

function reminderHtml(d: { petName: string; deliveryDate: string; itemCount: number }) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#FAF6EF;padding:40px 20px">
  <h1 style="text-align:center;color:#1B5C3A">🐾 PawBox</h1>
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E8DFD0">
    <h2 style="color:#144830;margin-top:0">📦 Twoja dostawa zbliża się!</h2>
    <p style="color:#374151;line-height:1.6">Za 2 dni dostarczymy PawBox dla <strong>${d.petName}</strong>.</p>
    <div style="background:#f0f7f3;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
      <div style="font-size:13px;color:#6b7280">Data dostawy</div>
      <div style="font-size:24px;font-weight:700;color:#1B5C3A">${d.deliveryDate}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px">${d.itemCount} karm w zestawie</div>
    </div>
    <div style="text-align:center">
      <a href="${SITE_URL}/subscription" style="background:#1B5C3A;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Zarządzaj dostawą →</a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">
    © 2025 PawBox · <a href="${SITE_URL}/dashboard" style="color:#9ca3af">Wyłącz powiadomienia w ustawieniach</a>
  </p>
</div>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!BREVO_API_KEY)        return res.status(500).json({ error: 'BREVO_API_KEY not set' })

  const { type, to, data } = req.body
  if (!type || !to || !data) return res.status(400).json({ error: 'Missing params' })

  try {
    if (type === 'order_confirmation') {
      await sendEmail(to,
        `🐾 PawBox #${data.orderId?.substring(0,8).toUpperCase()} — zamówienie przyjęte!`,
        orderHtml(data)
      )
    } else if (type === 'delivery_reminder') {
      await sendEmail(to, `📦 PawBox — Twoja dostawa za 2 dni!`, reminderHtml(data))
    } else {
      return res.status(400).json({ error: `Unknown type: ${type}` })
    }
    return res.status(200).json({ success: true })
  } catch (e: any) {
    console.error('Email error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
