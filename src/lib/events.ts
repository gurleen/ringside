import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'
import { readDashboardCache } from '#/lib/dashboard-cache'
import { resolveTitleImageUrls, resolveWrestlerHeadshotUrls } from '#/lib/sdh'
import type { Tables } from '#/lib/database.types'

export type EventRow = Tables<'events'>
export type EnrichedEvent = EventRow & { promotionLabel: string | null }

const PAGE_SIZE = 24

// Local promotion abbreviations, keyed by full name. The DB only stores the
// full promotion name, so we map to a short label here and fall back to the
// full name when there's no known abbreviation.
const PROMOTION_ABBREVIATIONS: Record<string, string> = {
  'All Elite Wrestling': 'AEW',
  'World Wrestling Entertainment': 'WWE',
}

function promotionLabelFor(name: string): string {
  return PROMOTION_ABBREVIATIONS[name] ?? name
}

export async function getPromotionResolver(): Promise<
  (promotionId: string | null) => string | null
> {
  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase.from('promotions').select('id, name')
  if (error) throw new Error(error.message)

  const nameById = new Map<string, string>()
  for (const p of data ?? []) nameById.set(p.id, p.name)

  return (promotionId) => {
    if (!promotionId) return null
    const name = nameById.get(promotionId)
    if (!name) return promotionId
    return promotionLabelFor(name)
  }
}

export interface PromotionOption {
  id: string
  label: string
}

// Distinct promotions that actually appear in the events table, resolved to
// their display label. There's no FK from events.promotion → promotions.id,
// so we gather the distinct ids from events and resolve names separately.
export const listEventPromotions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<PromotionOption>> => {
    const cached =
      await readDashboardCache<Array<PromotionOption>>('event_promotions')
    if (cached) return cached

    const supabase = getCachedSupabaseServerClient()

    const { data: rows, error } = await supabase
      .from('events')
      .select('promotion')
      .not('promotion', 'is', null)
    if (error) throw new Error(error.message)

    const ids = new Set<string>()
    for (const r of rows ?? []) if (r.promotion) ids.add(r.promotion)

    const { data: promos, error: pErr } = await supabase
      .from('promotions')
      .select('id, name')
    if (pErr) throw new Error(pErr.message)

    const nameById = new Map<string, string>()
    for (const p of promos ?? []) nameById.set(p.id, p.name)

    return Array.from(ids)
      .map((id) => {
        const name = nameById.get(id)
        return { id, label: name ? promotionLabelFor(name) : id }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  },
)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Most recent past events (dashboard). Undated events are excluded. Served
// from the pg_cron-refreshed `dashboard_cache`; falls back to computing live
// when the cache row is missing (e.g. before the first scheduled refresh).
export const getRecentEvents = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<EnrichedEvent>> => {
    const cached =
      await readDashboardCache<Array<EnrichedEvent>>('recent_events')
    if (cached) return cached

    const supabase = getCachedSupabaseServerClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .lte('event_date', todayISO())
      .order('event_date', { ascending: false })
      .limit(8)
    if (error) throw new Error(error.message)

    const resolvePromotion = await getPromotionResolver()
    return (data ?? []).map((e) => ({
      ...e,
      promotionLabel: resolvePromotion(e.promotion),
    }))
  },
)

export interface EventPage {
  events: Array<EnrichedEvent>
  total: number
  page: number
  pageSize: number
}

// Sort order for the events list, keyed on event_date.
export type EventSort = 'date_desc' | 'date_asc'

export const listEvents = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      search?: string
      page?: number
      future?: boolean
      promotion?: string
      sort?: EventSort
    }) => ({
      search: input.search?.trim() ?? '',
      page: Math.max(1, input.page ?? 1),
      future: input.future ?? false,
      promotion: input.promotion?.trim() ?? '',
      sort: (input.sort === 'date_asc' ? 'date_asc' : 'date_desc') as EventSort,
    }),
  )
  .handler(async ({ data }): Promise<EventPage> => {
    // Default list (no search/filter, past-only, newest first, page 1) is
    // served from the pg_cron-refreshed dashboard_cache; other parameter
    // combinations compute live.
    if (
      !data.search &&
      data.page === 1 &&
      !data.future &&
      !data.promotion &&
      data.sort === 'date_desc'
    ) {
      const cached =
        await readDashboardCache<EventPage>('events_default_page')
      if (cached) return cached
    }

    const supabase = getCachedSupabaseServerClient()
    const from = (data.page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .order('event_date', {
        ascending: data.sort === 'date_asc',
        nullsFirst: false,
      })
      .range(from, to)

    if (data.search) {
      query = query.ilike('name', `%${data.search}%`)
    }

    if (data.promotion) {
      query = query.eq('promotion', data.promotion)
    }

    if (!data.future) {
      // Hide events dated in the future; keep past and undated events.
      query = query.or(`event_date.lte.${todayISO()},event_date.is.null`)
    }

    const { data: rows, count: total, error } = await query
    if (error) throw new Error(error.message)

    const resolvePromotion = await getPromotionResolver()

    return {
      events: (rows ?? []).map((e) => ({
        ...e,
        promotionLabel: resolvePromotion(e.promotion),
      })),
      total: total ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    }
  })

export interface MatchParticipant {
  role: string
  id: string | null
  name: string | null
  linkable: boolean
  /** Latest SDH headshot when the wrestler has a crosswalk match. */
  imageUrl: string | null
}

export interface MatchSide {
  id: string
  sideIndex: number
  role: string
  isChampion: boolean
  participants: Array<MatchParticipant>
}

export interface MatchCardItem {
  id: string
  index: number
  matchType: string | null
  titleId: string | null
  titleName: string | null
  titleLinkable: boolean
  /** SDH belt art when the title has a crosswalk match. */
  titleImageUrl: string | null
  titleChange: boolean | null
  duration: string | null
  result: string | null
  finishNote: string | null
  rating: number | null
  votes: number | null
  sides: Array<MatchSide>
  notes: Array<string>
}

export interface EventDetail {
  event: EnrichedEvent
  matches: Array<MatchCardItem>
}

const sideOrder: Record<string, number> = { winner: 0, side: 1, loser: 2 }

export const getEvent = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }): Promise<EventDetail | null> => {
    const supabase = getCachedSupabaseServerClient()

    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!event) return null

    const resolvePromotion = await getPromotionResolver()
    const enrichedEvent: EnrichedEvent = {
      ...event,
      promotionLabel: resolvePromotion(event.promotion),
    }

    const { data: rows, error: matchError } = await supabase
      .from('matches')
      .select('*, match_sides(*, match_side_participants(*)), match_notes(*)')
      .eq('event_id', data.id)
      .order('match_index')
    if (matchError) throw new Error(matchError.message)

    const matchRows = rows ?? []

    // Collect wrestler participant ids to determine which are linkable.
    const wrestlerIds = new Set<string>()
    for (const m of matchRows) {
      for (const s of m.match_sides) {
        for (const p of s.match_side_participants) {
          if (p.participant_role === 'wrestler' && p.participant_id) {
            wrestlerIds.add(p.participant_id)
          }
        }
      }
    }

    const linkable = new Set<string>()
    let headshots = new Map<string, string>()
    if (wrestlerIds.size > 0) {
      const ids = Array.from(wrestlerIds)
      const [{ data: valid, error: wErr }, headshotMap] = await Promise.all([
        supabase.from('wrestlers').select('id').in('id', ids),
        resolveWrestlerHeadshotUrls(ids),
      ])
      if (wErr) throw new Error(wErr.message)
      for (const w of valid ?? []) linkable.add(w.id)
      headshots = headshotMap
    }

    // Determine which match title ids exist in the titles table so we only
    // link the ones that have a destination page. Also resolve SDH belt art.
    const titleIds = new Set<string>()
    for (const m of matchRows) if (m.title_id) titleIds.add(m.title_id)

    const linkableTitles = new Set<string>()
    let titleImages = new Map<string, string>()
    if (titleIds.size > 0) {
      const ids = Array.from(titleIds)
      const [{ data: validTitles, error: tErr }, images] = await Promise.all([
        supabase.from('titles').select('id').in('id', ids),
        resolveTitleImageUrls(ids),
      ])
      if (tErr) throw new Error(tErr.message)
      for (const t of validTitles ?? []) linkableTitles.add(t.id)
      titleImages = images
    }

    const matches: Array<MatchCardItem> = matchRows.map((m) => ({
      id: m.id,
      index: m.match_index,
      matchType: m.match_type,
      titleId: m.title_id,
      titleName: m.title_name,
      titleLinkable: !!m.title_id && linkableTitles.has(m.title_id),
      titleImageUrl: m.title_id ? (titleImages.get(m.title_id) ?? null) : null,
      titleChange: m.title_change,
      duration: m.duration,
      result: m.result,
      finishNote: m.finish_note,
      rating: m.match_rating,
      votes: m.match_votes,
      notes: [...m.match_notes]
        .sort((a, b) => a.seq - b.seq)
        .map((n) => n.note),
      sides: [...m.match_sides]
        .sort(
          (a, b) =>
            (sideOrder[a.side_role] ?? 9) - (sideOrder[b.side_role] ?? 9) ||
            a.side_index - b.side_index,
        )
        .map((s) => ({
          id: s.id,
          sideIndex: s.side_index,
          role: s.side_role,
          isChampion: s.is_champion ?? false,
          participants: [...s.match_side_participants]
            .sort((a, b) => a.seq - b.seq)
            .map((p) => ({
              role: p.participant_role,
              id: p.participant_id,
              name: p.participant_name,
              linkable:
                p.participant_role === 'wrestler' &&
                !!p.participant_id &&
                linkable.has(p.participant_id),
              imageUrl:
                p.participant_role === 'wrestler' && p.participant_id
                  ? (headshots.get(p.participant_id) ?? null)
                  : null,
            })),
        })),
    }))

    return { event: enrichedEvent, matches }
  })

export const eventsQueryOptions = (
  search: string,
  page: number,
  future: boolean,
  promotion: string,
  sort: EventSort,
) =>
  queryOptions({
    queryKey: ['events', 'list', { search, page, future, promotion, sort }],
    queryFn: () =>
      listEvents({ data: { search, page, future, promotion, sort } }),
  })

export const eventPromotionsQueryOptions = () =>
  queryOptions({
    queryKey: ['events', 'promotions'],
    queryFn: () => listEventPromotions(),
  })

export const recentEventsQueryOptions = () =>
  queryOptions({
    queryKey: ['events', 'recent'],
    queryFn: () => getRecentEvents(),
  })

export const eventQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['event', id],
    queryFn: () => getEvent({ data: { id } }),
  })
