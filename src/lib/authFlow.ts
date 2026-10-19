import { supabase } from './supabase'

export type AuthOutcome =
  | { status: 'signed_in' }
  | { status: 'confirm_email'; message: string }
  | { status: 'exists'; message: string }
  | { status: 'error'; message: string }

const ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i,     'Nieprawidłowy email lub hasło.'],
  [/email not confirmed/i,           'Konto nie jest jeszcze potwierdzone — kliknij link z maila albo wyślij go ponownie.'],
  [/already registered/i,            'Konto z tym adresem już istnieje — zaloguj się.'],
  [/password should be at least/i,   'Hasło musi mieć co najmniej 6 znaków.'],
  [/rate limit|too many/i,           'Zbyt wiele prób — odczekaj chwilę i spróbuj ponownie.'],
  [/invalid.*email|unable to validate email/i, 'Nieprawidłowy adres email.'],
]

export function translateAuthError(message: string): string {
  return ERRORS.find(([re]) => re.test(message))?.[1] ?? message
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? { status: 'error', message: translateAuthError(error.message) } : { status: 'signed_in' }
}

export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  if (error) {
    const message = translateAuthError(error.message)
    return /already registered/i.test(error.message) ? { status: 'exists', message } : { status: 'error', message }
  }
  // Supabase nie zdradza, że adres jest zajęty: zwraca użytkownika bez tożsamości i nie wysyła maila
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { status: 'exists', message: 'Konto z tym adresem już istnieje — zaloguj się poniżej.' }
  }
  if (!data.session) {
    return { status: 'confirm_email', message: 'Wysłaliśmy link aktywacyjny — sprawdź skrzynkę (także spam).' }
  }
  return { status: 'signed_in' }
}

export async function resendConfirmation(email: string): Promise<string> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
  return error ? translateAuthError(error.message) : 'Link wysłany ponownie.'
}
