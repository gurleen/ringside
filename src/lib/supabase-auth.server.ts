import { createServerClient } from '@supabase/ssr'
import {
  getCookies,
  setCookie,
  setResponseHeader,
} from '@tanstack/react-start/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#/lib/database.types'
import { getSupabaseEnv } from '#/lib/supabase'

/**
 * Per-request cookie-backed Supabase client for Auth (SSR).
 *
 * Server-only — import from `*.server.ts` / server-fn handlers, never from
 * modules shared with public data loaders.
 */
export function getSupabaseAuthClient(): SupabaseClient<Database> {
  const { url, key } = getSupabaseEnv()

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }))
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options)
        }
        for (const [headerName, headerValue] of Object.entries(headers)) {
          setResponseHeader(headerName, headerValue)
        }
      },
    },
  })
}
