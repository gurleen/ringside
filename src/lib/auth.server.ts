import { redirect } from '@tanstack/react-router'
import { getRequestUrl } from '@tanstack/react-start/server'

import { getSupabaseAuthClient } from '#/lib/supabase-auth.server'
import { getSupabaseServerClient } from '#/lib/supabase'

export type AuthUser = {
  id: string
  email: string
  username: string
}

const USERNAME_RE = /^[a-z0-9_]{3,30}$/

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function validateUsername(username: string): string {
  const normalized = normalizeUsername(username)
  if (!USERNAME_RE.test(normalized)) {
    throw new Error(
      'Username must be 3–30 characters: lowercase letters, numbers, or underscores.',
    )
  }
  return normalized
}

export function validateEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@') || trimmed.length > 255) {
    throw new Error('Enter a valid email address.')
  }
  return trimmed
}

export function validatePassword(password: string): string {
  if (password.length < 8 || password.length > 72) {
    throw new Error('Password must be between 8 and 72 characters.')
  }
  return password
}

export async function loadAuthUser(
  userId: string,
  email: string | undefined,
): Promise<AuthUser | null> {
  if (!email) return null

  const supabase = getSupabaseAuthClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) return null

  return {
    id: userId,
    email,
    username: profile.username,
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseAuthClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return loadAuthUser(user.id, user.email)
}

export async function isUsernameAvailable(
  username: string,
): Promise<{ available: boolean }> {
  const supabase = getSupabaseServerClient()
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return { available: !existing }
}

export type SignUpResult =
  | { status: 'signed_in'; user: AuthUser }
  | { status: 'confirm_email'; email: string }
  | { status: 'error'; message: string }

export async function performSignUp(data: {
  email: string
  password: string
  username: string
}): Promise<SignUpResult> {
  const availability = await isUsernameAvailable(data.username)
  if (!availability.available) {
    return { status: 'error', message: 'That username is already taken.' }
  }

  const supabase = getSupabaseAuthClient()
  const requestUrl = getRequestUrl()
  const emailRedirectTo = `${requestUrl.origin}/auth/confirm`

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { username: data.username },
      emailRedirectTo,
    },
  })

  if (error) {
    return { status: 'error', message: error.message }
  }

  if (authData.session && authData.user) {
    const user = await loadAuthUser(authData.user.id, authData.user.email)
    if (!user) {
      return {
        status: 'error',
        message: 'Account created but profile could not be loaded.',
      }
    }
    return { status: 'signed_in', user }
  }

  return { status: 'confirm_email', email: data.email }
}

export type SignInResult =
  | { status: 'signed_in'; user: AuthUser }
  | { status: 'error'; message: string }

export async function performSignIn(data: {
  email: string
  password: string
}): Promise<SignInResult> {
  const supabase = getSupabaseAuthClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (error) {
    return {
      status: 'error',
      message: error.message,
    }
  }

  const user = await loadAuthUser(authData.user.id, authData.user.email)
  if (!user) {
    return {
      status: 'error',
      message: 'Signed in but profile could not be loaded.',
    }
  }

  return { status: 'signed_in', user }
}

export async function performSignOut() {
  const supabase = getSupabaseAuthClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
  return { ok: true as const }
}

export async function performExchangeAuthCode(data: {
  code?: string
  next?: string
}) {
  const next =
    data.next && data.next.startsWith('/') && !data.next.startsWith('//')
      ? data.next
      : '/'

  if (!data.code) {
    throw redirect({ to: '/login', search: { error: 'missing_code' } })
  }

  const supabase = getSupabaseAuthClient()
  const { error } = await supabase.auth.exchangeCodeForSession(data.code)

  if (error) {
    throw redirect({
      to: '/login',
      search: { error: 'confirm_failed' },
    })
  }

  if (next === '/') {
    throw redirect({ to: '/' })
  }

  throw redirect({ href: next })
}
