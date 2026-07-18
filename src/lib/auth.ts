import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'

import {
  fetchCurrentUser,
  isUsernameAvailable,
  performExchangeAuthCode,
  performSignIn,
  performSignOut,
  performSignUp,
  validateEmail,
  validatePassword,
  validateUsername,
} from '#/lib/auth.server'
import type { AuthUser } from '#/lib/auth.server'

export type { AuthUser, SignInResult, SignUpResult } from '#/lib/auth.server'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthUser | null> => {
    return fetchCurrentUser()
  },
)

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'current-user'],
    queryFn: () => getCurrentUser(),
    staleTime: Infinity,
    gcTime: Infinity,
  })

export const checkUsernameAvailable = createServerFn({ method: 'GET' })
  .validator((data: { username: string }) => ({
    username: validateUsername(data.username),
  }))
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    return isUsernameAvailable(data.username)
  })

export const signUp = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string; username: string }) => ({
    email: validateEmail(data.email),
    password: validatePassword(data.password),
    username: validateUsername(data.username),
  }))
  .handler(async ({ data }) => {
    return performSignUp(data)
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => ({
    email: validateEmail(data.email),
    password: validatePassword(data.password),
  }))
  .handler(async ({ data }) => {
    return performSignIn(data)
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  return performSignOut()
})

export const exchangeAuthCode = createServerFn({ method: 'GET' })
  .validator((data: { code?: string; next?: string }) => data)
  .handler(async ({ data }) => {
    return performExchangeAuthCode(data)
  })
