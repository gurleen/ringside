import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'

export type PromotionAbbrRow = {
  promotionId: string
  name: string
  abbreviation: string | null
}

/** Resolve a promotion id to its display label (abbr ?? name ?? id). */
export function promotionLabel(
  promotionId: string | null,
  byId: Map<string, PromotionAbbrRow>,
): string | null {
  if (!promotionId) return null
  const row = byId.get(promotionId)
  if (!row) return promotionId
  return row.abbreviation ?? row.name
}

export async function fetchPromotionAbbrs(): Promise<Array<PromotionAbbrRow>> {
  const supabase = getCachedSupabaseServerClient()

  const [promos, abbrs] = await Promise.all([
    supabase.from('promotions').select('id, name'),
    supabase.from('promotion_abbr').select('promotion_id, abbreviation'),
  ])

  if (promos.error) throw new Error(promos.error.message)
  if (abbrs.error) throw new Error(abbrs.error.message)

  const abbrById = new Map<string, string>()
  for (const a of abbrs.data ?? []) {
    abbrById.set(a.promotion_id, a.abbreviation)
  }

  return (promos.data ?? []).map((p) => ({
    promotionId: p.id,
    name: p.name,
    abbreviation: abbrById.get(p.id) ?? null,
  }))
}

export async function getPromotionResolver(): Promise<
  (promotionId: string | null) => string | null
> {
  const rows = await fetchPromotionAbbrs()
  const byId = new Map<string, PromotionAbbrRow>()
  for (const row of rows) byId.set(row.promotionId, row)

  return (promotionId) => promotionLabel(promotionId, byId)
}

export const listPromotionAbbrs = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<PromotionAbbrRow>> => {
    return fetchPromotionAbbrs()
  },
)

export const promotionAbbrsQueryOptions = () =>
  queryOptions({
    queryKey: ['promotions', 'abbrs'],
    queryFn: () => listPromotionAbbrs(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
