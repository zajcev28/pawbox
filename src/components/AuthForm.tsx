import { useState } from 'react'
import { signIn, signUp, resendConfirmation } from '../lib/authFlow'

type Tab = 'login' | 'register'
type Notice = { kind: 'error' | 'info'; text: string }

interface Props {
  initialTab?: Tab
  onSignedIn: () => void
  submitLabel?: Partial<Record<Tab, string>>
}

// Wspólny formularz logowania/rejestracji — strona /auth i modal w quizie.
export default function AuthForm({ initialTab = 'login', onSignedIn, submitLabel }: Props) {
  const [tab, setTab]           = useState<Tab>(initialTab)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [notice, setNotice]     = useState<Notice | null>(null)
  const [canResend, setCanResend] = useState(false)

  const switchTab = (t: Tab) => { setTab(t); setNotice(null); setCanResend(false) }

  const submit = async () => {
    if (loading || !email || !password) return
    setLoading(true); setNotice(null); setCanResend(false)
    const res = tab === 'login' ? await signIn(email, password) : await signUp(email, password)
    setLoading(false)

    switch (res.status) {
      case 'signed_in':
        onSignedIn()
        return
      case 'exists':
        setTab('login')
        setNotice({ kind: 'info', text: res.message })
        return
      case 'confirm_email':
        setNotice({ kind: 'info', text: res.message })
        setCanResend(true)
        return
      case 'error':
        setNotice({ kind: 'error', text: res.message })
        setCanResend(/potwierdzone/.test(res.message))
    }
  }

  const resend = async () => {
    setLoading(true)
    const msg = await resendConfirmation(email)
    setLoading(false)
    setNotice({ kind: 'info', text: msg })
  }

  const label: React.CSSProperties = { display:'block', fontSize:'0.875rem', marginBottom:'0.35rem', color:'#374151' }

  return (
    <div>
      <div style={{ display:'flex', marginBottom:'1.5rem', borderBottom:'2px solid #E8DFD0' }}>
        {(['login', 'register'] as const).map(t => (
          <button key={t} type="button" onClick={() => switchTab(t)}
            style={{ flex:1, padding:'0.7rem', background:'none', border:'none', cursor:'pointer',
              fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1b5c3a' : '#6b7280',
              borderBottom: tab === t ? '2px solid #1b5c3a' : '2px solid transparent',
              marginBottom:'-2px', fontSize:'0.95rem' }}>
            {t === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
          </button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); submit() }} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
        <div>
          <label style={label} htmlFor="auth-email">Email</label>
          <input id="auth-email" className="input" type="email" autoComplete="email" placeholder="twoj@email.com"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="auth-password">Hasło</label>
          <div style={{ position:'relative' }}>
            <input id="auth-password" className="input" type={showPass ? 'text' : 'password'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder="minimum 6 znaków" value={password} onChange={e => setPassword(e.target.value)}
              style={{ paddingRight:'2.75rem' }} />
            <button type="button" onClick={() => setShowPass(v => !v)}
              aria-label={showPass ? 'Ukryj hasło' : 'Pokaż hasło'} title={showPass ? 'Ukryj hasło' : 'Pokaż hasło'}
              style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', padding:0, lineHeight:1 }}>
              {showPass ? '👁️' : '🙈'}
            </button>
          </div>
        </div>

        {notice && (
          <div role="status" style={{ padding:'0.7rem 0.85rem', borderRadius:'0.75rem', fontSize:'0.85rem',
            background: notice.kind === 'error' ? '#fff5f5' : '#f0f7f3',
            border: `1px solid ${notice.kind === 'error' ? '#fecaca' : '#d9ede2'}`,
            color: notice.kind === 'error' ? '#dc2626' : '#1b5c3a' }}>
            {notice.text}
            {canResend && (
              <button type="button" onClick={resend} disabled={loading}
                style={{ display:'block', marginTop:'0.4rem', background:'none', border:'none', padding:0, color:'#1b5c3a', textDecoration:'underline', cursor:'pointer', fontSize:'0.85rem' }}>
                Wyślij link ponownie
              </button>
            )}
          </div>
        )}

        <button type="submit" disabled={loading || !email || !password} className="btn-primary"
          style={{ width:'100%', padding:'0.875rem', fontSize:'1rem' }}>
          {loading ? '⏳ Chwileczkę...' : (submitLabel?.[tab] ?? (tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'))}
        </button>
      </form>
    </div>
  )
}
