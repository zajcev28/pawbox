import { useEffect, useState } from 'react'
import { type Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function Settings({ session }: { session: Session }) {
  // ─── Stan ────────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  // Adres
  const [street,  setStreet]  = useState('')
  const [city,    setCity]    = useState('')
  const [postal,  setPostal]  = useState('')

  // Powiadomienia
  const [notifyDelivery, setNotifyDelivery] = useState(false)

  // Hasło
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass,    setShowPass]    = useState(false)

  // ─── Załaduj dane ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('street, city, postal_code, notify_delivery')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setStreet(data.street || '')
          setCity(data.city || '')
          setPostal(data.postal_code || '')
          setNotifyDelivery(data.notify_delivery || false)
        }
        setLoading(false)
      })
  }, [session.user.id])

  // ─── Toast helper ─────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Zapis adresu ─────────────────────────────────────────────────────────
  const saveAddress = async () => {
    setSaving('address')
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: session.user.id, street, city, postal_code: postal })
    setSaving(null)
    error ? showToast('Błąd zapisu adresu', false) : showToast('Adres zapisany ✓')
  }

  // ─── Zapis powiadomień ───────────────────────────────────────────────────
  const saveNotifications = async (val: boolean) => {
    setNotifyDelivery(val)
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: session.user.id, notify_delivery: val })
    error ? showToast('Błąd zapisu ustawień', false) : showToast(val ? 'Powiadomienia włączone ✓' : 'Powiadomienia wyłączone ✓')
  }

  // ─── Zmiana hasła ─────────────────────────────────────────────────────────
  const changePassword = async () => {
    if (newPass.length < 6) { showToast('Hasło musi mieć min. 6 znaków', false); return }
    if (newPass !== confirmPass) { showToast('Hasła nie są identyczne', false); return }
    setSaving('password')
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setSaving(null)
    if (error) {
      showToast('Błąd zmiany hasła: ' + error.message, false)
    } else {
      showToast('Hasło zmienione ✓')
      setNewPass('')
      setConfirmPass('')
    }
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'white', borderRadius: '1rem',
    border: '1px solid #E8DFD0', padding: '1.5rem',
    marginBottom: '1.5rem',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: '0.875rem',
    marginBottom: '0.35rem', color: '#374151', fontWeight: 500,
  }
  const sectionTitle: React.CSSProperties = {
    fontFamily: 'Lora,Georgia,serif', fontSize: '1.1rem',
    margin: '0 0 1.25rem', color: '#144830',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAF6EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#1b5c3a', fontFamily: 'Lora,Georgia,serif' }}>Ładowanie ustawień...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EF', padding: '3rem 1rem' }}>
      <div style={{ maxWidth: 580, margin: '0 auto' }}>

        <h1 style={{ fontFamily: 'Lora,Georgia,serif', fontSize: '2rem', marginBottom: '0.5rem' }}>
          Ustawienia
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.875rem' }}>
          {session.user.email}
        </p>

        {/* ── Adres dostawy ── */}
        <div style={card}>
          <h2 style={sectionTitle}>📦 Adres dostawy</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={label}>Ulica i numer</label>
              <input className="input" placeholder="np. Marszałkowska 1/2"
                value={street} onChange={e => setStreet(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem' }}>
              <div>
                <label style={label}>Kod pocztowy</label>
                <input className="input" placeholder="00-000"
                  value={postal} onChange={e => setPostal(e.target.value)} />
              </div>
              <div>
                <label style={label}>Miasto</label>
                <input className="input" placeholder="Warszawa"
                  value={city} onChange={e => setCity(e.target.value)} />
              </div>
            </div>
            <button onClick={saveAddress} disabled={saving === 'address'}
              className="btn-primary"
              style={{ alignSelf: 'flex-start', padding: '0.6rem 1.5rem', fontSize: '0.875rem' }}>
              {saving === 'address' ? '⏳ Zapisuję...' : 'Zapisz adres'}
            </button>
          </div>
        </div>

        {/* ── Powiadomienia ── */}
        <div style={card}>
          <h2 style={sectionTitle}>🔔 Powiadomienia email</h2>
          <div
            onClick={() => saveNotifications(!notifyDelivery)}
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', padding: '0.75rem', borderRadius: '0.75rem', border: `2px solid ${notifyDelivery ? '#1b5c3a' : '#E8DFD0'}`, background: notifyDelivery ? '#f0f7f3' : 'white', transition: 'all 0.2s' }}>

            {/* Toggle switch */}
            <div style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: notifyDelivery ? '#1b5c3a' : '#d1d5db', transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 2, left: notifyDelivery ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Przypomnienie o dostawie
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Wyślemy email 2 dni przed każdą dostawą
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
            Powiadomienia o zamówieniu są zawsze wysyłane i nie można ich wyłączyć.
          </p>
        </div>

        {/* ── Zmiana hasła ── */}
        <div style={card}>
          <h2 style={sectionTitle}>🔒 Zmiana hasła</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={label}>Nowe hasło</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPass ? 'text' : 'password'}
                  placeholder="minimum 6 znaków"
                  value={newPass} onChange={e => setNewPass(e.target.value)}
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.1rem', padding: 0 }}>
                  {showPass ? '👁️' : '🙈'}
                </button>
              </div>
            </div>
            <div>
              <label style={label}>Powtórz nowe hasło</label>
              <input className="input" type={showPass ? 'text' : 'password'}
                placeholder="minimum 6 znaków"
                value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
              {confirmPass && newPass !== confirmPass && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.35rem' }}>
                  Hasła nie są identyczne
                </p>
              )}
            </div>
            <button onClick={changePassword}
              disabled={saving === 'password' || !newPass || !confirmPass || newPass !== confirmPass}
              className="btn-primary"
              style={{ alignSelf: 'flex-start', padding: '0.6rem 1.5rem', fontSize: '0.875rem' }}>
              {saving === 'password' ? '⏳ Zmieniam...' : 'Zmień hasło'}
            </button>
          </div>
        </div>

        {/* ── Strefa niebezpieczna ── */}
        <div style={{ ...card, borderColor: '#fecaca' }}>
          <h2 style={{ ...sectionTitle, color: '#dc2626' }}>⚠️ Strefa niebezpieczna</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            Usunięcie konta jest nieodwracalne. Wszystkie dane, pupile i subskrypcje zostaną trwale usunięte.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.')) {
                if (window.confirm('Ostatnie potwierdzenie — usunąć konto bezpowrotnie?')) {
                  supabase.auth.signOut()
                  // Tu można dodać wywołanie do usunięcia konta przez Supabase Admin API
                  alert('Skontaktuj się z kontakt@pawbox.pl aby dokończyć usuwanie konta.')
                }
              }
            }}
            style={{ padding: '0.6rem 1.5rem', borderRadius: '0.75rem', border: '2px solid #fecaca', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            Usuń konto
          </button>
        </div>

      </div>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#1b5c3a' : '#dc2626',
          color: 'white', padding: '0.75rem 1.5rem', borderRadius: '2rem',
          fontSize: '0.875rem', fontWeight: 500, zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
