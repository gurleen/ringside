import { getCachedSupabaseServerClient } from '#/lib/supabase'

/**
 * Read a precomputed page payload from `public.dashboard_cache`.
 *
 * Keys cover the home dashboard plus default list-page views and promotion
 * dropdowns. Rows are rebuilt on a schedule by
 * `private.refresh_dashboard_cache()` (pg_cron), so the assembled payload
 * matches what the live server functions would compute. Returns `null` when
 * the row is missing (e.g. before the first refresh) so callers can fall back
 * to computing live.
 */
export async function readDashboardCache<T>(key: string): Promise<T | null> {
  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase
    .from('dashboard_cache')
    .select('payload')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return data.payload as T
}
