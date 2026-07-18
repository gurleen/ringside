import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#/lib/database.types'

let publicClient: SupabaseClient<Database> | undefined
let cachedPublicClient: SupabaseClient<Database> | undefined

/** Workers `cf` init fields (ignored outside workerd). */
type CfRequestInit = RequestInit & {
  cf?: {
    cacheEverything?: boolean
    cacheTtl?: number
  }
}

export function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. See .env.example.',
    )
  }

  return { url, key }
}

/** Seconds until next UTC midnight, floored at 60 so TTL never hits 0. */
function secondsUntilUtcMidnight(): number {
  const now = new Date()
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )
  return Math.max(60, Math.floor((next - now.getTime()) / 1000))
}

/**
 * Edge-cache GET/HEAD subrequests until UTC midnight (Workers `cf` options).
 * Non-GET methods pass through uncached. Outside workerd, `cf` is ignored.
 */
function cachedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return fetch(input, init)
  }

  const nextInit: CfRequestInit = {
    ...init,
    cf: {
      cacheEverything: true,
      cacheTtl: secondsUntilUtcMidnight(),
    },
  }
  return fetch(input, nextInit)
}

/**
 * Sessionless server-side Supabase client for public data — **no edge cache**.
 * Use for freshness-sensitive reads, writes, and future live features (reviews).
 *
 * Reads credentials from server-only env vars (never prefixed with `VITE_`),
 * so the key is never shipped to the browser. Only call this from server
 * functions / server code (e.g. inside `createServerFn`).
 */
export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (publicClient) return publicClient

  const { url, key } = getSupabaseEnv()

  publicClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return publicClient
}

/**
 * Same anon client as {@link getSupabaseServerClient}, but GET/HEAD PostgREST
 * subrequests are edge-cached until UTC midnight. Opt in only for stable
 * public wrestling reference data — not for auth, writes, or live features.
 */
export function getCachedSupabaseServerClient(): SupabaseClient<Database> {
  if (cachedPublicClient) return cachedPublicClient

  const { url, key } = getSupabaseEnv()

  cachedPublicClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: cachedFetch as typeof fetch },
  })

  return cachedPublicClient
}
