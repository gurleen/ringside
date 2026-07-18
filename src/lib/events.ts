import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'
import { readDashboardCache } from '#/lib/dashboard-cache'
import { getPromotionResolver } from '#/lib/promotions'
import { performUpdateEventTime } from '#/lib/events.server'
import { resolveTitleImageUrls, resolveWrestlerHeadshotUrls } from '#/lib/sdh'
import { isMatchReviewable } from '#/lib/reviews-shared'
import { isMatchPredictable } from '#/lib/predictions-shared'
import {
  eventLockInstant,
  zonedWallTimeToInstant,
} from '#/lib/event-time'
import type { EventTimeInput } from '#/lib/events.server'
import type { Tables } from '#/lib/database.types'

export type EventRow = Tables<'events'>
export type EnrichedEvent = EventRow & { promotionLabel: string | null }

export { getPromotionResolver } from '#/lib/promotions'

const PAGE_SIZE = 24

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

    const resolvePromotion = await getPromotionResolver()

    return Array.from(ids)
      .map((id) => ({ id, label: resolvePromotion(id) ?? id }))
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

export type EventListItem = EnrichedEvent & {
  /** Whether the event has started/happened yet; null when undeterminable. */
  hasOccurred: boolean | null
}

export interface EventPage {
  events: Array<EventListItem>
  total: number
  page: number
  pageSize: number
}

// The dashboard_cache payload predates `hasOccurred`, so both the cached and
// live paths produce this base shape and occurrence is attached afterwards.
type EventPageBase = Omit<EventPage, 'events'> & {
  events: Array<EnrichedEvent>
}

// Whether each event has happened yet. When an admin-entered start time is
// available, the event "has occurred" once that instant passes. Otherwise we
// fall back to the same signal review eligibility uses: at least one match
// with a decisive result and winner/loser sides. Events with no usable signal
// (no time, no matches) resolve to null.
async function resolveEventOccurrences(
  events: Array<EventRow>,
): Promise<Map<string, boolean | null>> {
  const occurred = new Map<string, boolean | null>()
  const needMatchCheck: Array<string> = []
  const now = Date.now()

  for (const e of events) {
    const start = zonedWallTimeToInstant(
      e.event_date,
      e.event_time,
      e.event_timezone,
    )
    if (start) {
      occurred.set(e.id, start.getTime() <= now)
    } else {
      occurred.set(e.id, null)
      needMatchCheck.push(e.id)
    }
  }

  if (needMatchCheck.length > 0) {
    const supabase = getCachedSupabaseServerClient()
    const { data, error } = await supabase
      .from('matches')
      .select('event_id, result, match_sides(side_role)')
      .in('event_id', needMatchCheck)
    if (error) throw new Error(error.message)

    for (const m of data) {
      const prev = occurred.get(m.event_id)
      if (prev === true) continue
      const reviewable = isMatchReviewable(
        m.result,
        m.match_sides.map((s) => s.side_role),
      )
      // Any decisive match means the event happened; a card of matches with
      // no results yet means it hasn't.
      occurred.set(m.event_id, reviewable ? true : false)
    }
  }

  return occurred
}

async function attachEventOccurrences(base: EventPageBase): Promise<EventPage> {
  const occurrences = await resolveEventOccurrences(base.events)
  return {
    ...base,
    events: base.events.map((e) => ({
      ...e,
      hasOccurred: occurrences.get(e.id) ?? null,
    })),
  }
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
        await readDashboardCache<EventPageBase>('events_default_page')
      if (cached) return attachEventOccurrences(cached)
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

    return attachEventOccurrences({
      events: (rows ?? []).map((e) => ({
        ...e,
        promotionLabel: resolvePromotion(e.promotion),
      })),
      total: total ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    })
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
  hasResult: boolean
  /** True when the match has no decisive result yet and ≥2 sides. */
  isPredictable: boolean
  finishNote: string | null
  rating: number | null
  votes: number | null
  sides: Array<MatchSide>
  notes: Array<string>
}

export interface EventDetail {
  event: EnrichedEvent
  matches: Array<MatchCardItem>
  /** ISO timestamp when predictions lock; null when the event has no date. */
  predictionsLockAt: string | null
  predictionsLocked: boolean
}

const sideOrder: Record<string, number> = { winner: 0, side: 1, loser: 2 }

type MatchRowWithChildren = Tables<'matches'> & {
  match_sides: Array<
    Tables<'match_sides'> & {
      match_side_participants: Array<Tables<'match_side_participants'>>
    }
  >
  match_notes: Array<Tables<'match_notes'>>
}

async function buildMatchCardItems(
  matchRows: Array<MatchRowWithChildren>,
): Promise<Array<MatchCardItem>> {
  const supabase = getCachedSupabaseServerClient()

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

  return matchRows.map((m) => {
    return {
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
      hasResult: isMatchReviewable(
        m.result,
        m.match_sides.map((side) => side.side_role),
      ),
      isPredictable: isMatchPredictable(
        m.result,
        m.match_sides.map((side) => side.side_role),
      ),
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
    }
  })
}

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

    const matches = await buildMatchCardItems(rows)
    const lockAt = eventLockInstant(
      event.event_date,
      event.event_time,
      event.event_timezone,
    )

    return {
      event: enrichedEvent,
      matches,
      predictionsLockAt: lockAt ? lockAt.toISOString() : null,
      predictionsLocked: !lockAt || lockAt.getTime() <= Date.now(),
    }
  })

export type MatchSummary = MatchCardItem & { event: EnrichedEvent }

export const getMatchSummary = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }): Promise<MatchSummary | null> => {
    const supabase = getCachedSupabaseServerClient()

    const { data: match, error } = await supabase
      .from('matches')
      .select('*, match_sides(*, match_side_participants(*)), match_notes(*)')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!match) return null

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', match.event_id)
      .maybeSingle()
    if (eventError) throw new Error(eventError.message)
    if (!event) return null

    const resolvePromotion = await getPromotionResolver()
    const cards = await buildMatchCardItems([match])
    const card = cards[0]
    if (!card.hasResult) return null

    return {
      ...card,
      event: {
        ...event,
        promotionLabel: resolvePromotion(event.promotion),
      },
    }
  })

// Admin-only: set/clear an event's local venue start time + time zone.
// Authorization + validation live in `events.server.ts`; RLS enforces the
// admin check again at the database.
export const updateEventTime = createServerFn({ method: 'POST' })
  .validator((input: EventTimeInput) => ({
    eventId: input.eventId,
    eventTime: input.eventTime ?? null,
    eventTimezone: input.eventTimezone ?? null,
  }))
  .handler(async ({ data }) => {
    return performUpdateEventTime(data)
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

export const matchSummaryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['match', id],
    queryFn: () => getMatchSummary({ data: { id } }),
  })
