import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'
import { readDashboardCache } from '#/lib/dashboard-cache'
import { getPromotionResolver } from '#/lib/promotions'
import { getSdhWrestlerProfile } from '#/lib/sdh'
import type { Tables } from '#/lib/database.types'
import type { SdhWrestlerProfile } from '#/lib/sdh'

export type Wrestler = Tables<'wrestlers'>
export type Promotion = Tables<'promotions'>
export type WrestlerAttribute = Tables<'wrestler_attributes'>
export type WrestlerRole = Tables<'wrestler_roles'>

const PAGE_SIZE = 24

export interface WrestlerPage {
  wrestlers: Array<Wrestler>
  total: number
  page: number
  pageSize: number
}

export const listWrestlers = createServerFn({ method: 'GET' })
  .validator((input: { search?: string; page?: number }) => ({
    search: input.search?.trim() ?? '',
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<WrestlerPage> => {
    // Default list (no search, page 1) is served from the pg_cron-refreshed
    // dashboard_cache; other parameter combinations compute live.
    if (!data.search && data.page === 1) {
      const cached =
        await readDashboardCache<WrestlerPage>('wrestlers_default_page')
      if (cached) return cached
    }

    const supabase = getCachedSupabaseServerClient()
    const from = (data.page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('wrestlers')
      .select('*', { count: 'exact' })
      .order('roster_rating', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (data.search) {
      query = query.ilike('name', `%${data.search}%`)
    }

    const { data: rows, count: total, error } = await query
    if (error) throw new Error(error.message)

    return {
      wrestlers: rows,
      total: total ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    }
  })

export interface WrestlerDetail {
  wrestler: Wrestler
  /** Complete Smackdown Hotel profile when a trusted crosswalk match exists. */
  sdh: SdhWrestlerProfile | null
  attributes: Array<WrestlerAttribute>
  roles: Array<WrestlerRole>
  promotions: Array<Promotion>
}

export const getWrestler = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }): Promise<WrestlerDetail | null> => {
    const supabase = getCachedSupabaseServerClient()

    const { data: wrestler, error } = await supabase
      .from('wrestlers')
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!wrestler) return null

    const [attributes, roles, promotionLinks, sdh] = await Promise.all([
      supabase
        .from('wrestler_attributes')
        .select('*')
        .eq('wrestler_id', data.id)
        .order('attr_type')
        .order('seq'),
      supabase
        .from('wrestler_roles')
        .select('*')
        .eq('wrestler_id', data.id)
        .order('seq'),
      supabase
        .from('wrestler_promotions')
        .select('promotion_id, seq')
        .eq('wrestler_id', data.id)
        .order('seq'),
      getSdhWrestlerProfile(data.id),
    ])

    if (attributes.error) throw new Error(attributes.error.message)
    if (roles.error) throw new Error(roles.error.message)
    if (promotionLinks.error) throw new Error(promotionLinks.error.message)
    const promotionIds = promotionLinks.data.map((p) => p.promotion_id)
    let promotions: Array<Promotion> = []
    if (promotionIds.length > 0) {
      const { data: promoRows, error: promoError } = await supabase
        .from('promotions')
        .select('*')
        .in('id', promotionIds)
      if (promoError) throw new Error(promoError.message)
      promotions = promoRows
    }

    return {
      wrestler,
      sdh,
      attributes: attributes.data,
      roles: roles.data,
      promotions,
    }
  })

// ---- TanStack Query option helpers ----

export const wrestlersQueryOptions = (search: string, page: number) =>
  queryOptions({
    queryKey: ['wrestlers', 'list', { search, page }],
    queryFn: () => listWrestlers({ data: { search, page } }),
  })

export const wrestlerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['wrestler', id],
    queryFn: () => getWrestler({ data: { id } }),
  })

// ---- Wrestler match history ----

export const MATCH_PAGE_SIZE = 10

export type WrestlerMatchOutcome = 'win' | 'loss' | 'draw'

export interface WrestlerMatch {
  id: string
  matchType: string | null
  titleName: string | null
  titleId: string | null
  titleLinkable: boolean
  titleChange: boolean | null
  rating: number | null
  duration: string | null
  /** Raw `matches.result` (`decisive` / `no_decision` / `unknown`). */
  result: string | null
  /** Finish label for non-decisive bouts (e.g. "No Contest", "Time Limit Draw"). */
  finishNote: string | null
  outcome: WrestlerMatchOutcome
  winners: Array<string>
  losers: Array<string>
  // For no-decision matches (side_role = "side"), all corner names.
  sides: Array<string>
  event: {
    id: string
    name: string | null
    date: string | null
    eventDate: string | null
    promotionLabel: string | null
  }
}

export interface WrestlerMatchPage {
  matches: Array<WrestlerMatch>
  total: number
  page: number
  pageSize: number
}

const sideOrder: Record<string, number> = { winner: 0, side: 1, loser: 2 }

export type WrestlerMatchMeta = {
  eventDate: string | null
  date: string | null
  sideRole: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function participantNames(
  participants: Array<{
    participant_role: string
    participant_name: string | null
    seq: number
  }>,
): Array<string> {
  const sorted = [...participants].sort((a, b) => a.seq - b.seq)
  const wrestlers = sorted
    .filter((p) => p.participant_role === 'wrestler' && p.participant_name)
    .map((p) => p.participant_name as string)
  if (wrestlers.length > 0) return wrestlers
  return sorted
    .filter((p) => p.participant_role === 'team' && p.participant_name)
    .map((p) => p.participant_name as string)
}

function namesForRole(
  sides: Array<{
    side_role: string
    side_index: number
    match_side_participants: Array<{
      participant_role: string
      participant_name: string | null
      seq: number
    }>
  }>,
  role: string,
): Array<string> {
  return sides
    .filter((s) => s.side_role === role)
    .sort((a, b) => a.side_index - b.side_index)
    .flatMap((s) => participantNames(s.match_side_participants))
}

/** Collect this wrestler's matches via participation rows (deduped). */
export async function collectWrestlerMatchMeta(
  wrestlerId: string,
): Promise<Map<string, WrestlerMatchMeta>> {
  const supabase = getCachedSupabaseServerClient()
  const { data: participationRows, error: pErr } = await supabase
    .from('match_side_participants')
    .select(
      'match_sides!inner(match_id, side_role, matches!inner(id, events!inner(event_date, date)))',
    )
    .eq('participant_id', wrestlerId)
    .eq('participant_role', 'wrestler')
  if (pErr) throw new Error(pErr.message)

  type PartRow = {
    match_sides: {
      match_id: string
      side_role: string
      matches: {
        id: string
        events: { event_date: string | null; date: string | null }
      }
    }
  }

  const byMatch = new Map<string, WrestlerMatchMeta>()
  for (const row of participationRows as Array<PartRow>) {
    const matchId = row.match_sides.match_id
    if (byMatch.has(matchId)) continue
    byMatch.set(matchId, {
      eventDate: row.match_sides.matches.events.event_date,
      date: row.match_sides.matches.events.date,
      sideRole: row.match_sides.side_role,
    })
  }
  return byMatch
}

export function sortMatchIdsDesc(
  byMatch: Map<string, WrestlerMatchMeta>,
): Array<string> {
  return Array.from(byMatch.entries())
    .sort((a, b) => {
      const aDate = a[1].eventDate
      const bDate = b[1].eventDate
      if (aDate && bDate) return bDate.localeCompare(aDate)
      if (aDate) return -1
      if (bDate) return 1
      return (b[1].date ?? '').localeCompare(a[1].date ?? '')
    })
    .map(([id]) => id)
}

export async function hydrateWrestlerMatches(
  pageIds: Array<string>,
  byMatch: Map<string, WrestlerMatchMeta>,
): Promise<Array<WrestlerMatch>> {
  if (pageIds.length === 0) return []

  const supabase = getCachedSupabaseServerClient()
  const { data: matchRows, error: mErr } = await supabase
    .from('matches')
    .select(
      'id, match_type, title_id, title_name, title_change, duration, match_rating, result, finish_note, events(id, name, date, event_date, promotion), match_sides(side_role, side_index, match_side_participants(participant_role, participant_id, participant_name, seq))',
    )
    .in('id', pageIds)
  if (mErr) throw new Error(mErr.message)

  const titleIds = new Set<string>()
  for (const m of matchRows) if (m.title_id) titleIds.add(m.title_id)

  const linkableTitles = new Set<string>()
  if (titleIds.size > 0) {
    const { data: validTitles, error: tErr } = await supabase
      .from('titles')
      .select('id')
      .in('id', Array.from(titleIds))
    if (tErr) throw new Error(tErr.message)
    for (const t of validTitles) linkableTitles.add(t.id)
  }

  const resolvePromotion = await getPromotionResolver()
  const byId = new Map(matchRows.map((m) => [m.id, m]))

  return pageIds.flatMap((id) => {
    const m = byId.get(id)
    const meta = byMatch.get(id)
    if (!m || !meta) return []

    const sides = [...m.match_sides].sort(
      (a, b) =>
        (sideOrder[a.side_role] ?? 9) - (sideOrder[b.side_role] ?? 9) ||
        a.side_index - b.side_index,
    )

    const outcome: WrestlerMatchOutcome =
      meta.sideRole === 'winner'
        ? 'win'
        : meta.sideRole === 'loser'
          ? 'loss'
          : 'draw'

    const winners = namesForRole(sides, 'winner')
    const losers = namesForRole(sides, 'loser')
    const sideNames =
      winners.length === 0 && losers.length === 0
        ? sides.flatMap((s) => participantNames(s.match_side_participants))
        : []

    return [
      {
        id: m.id,
        matchType: m.match_type,
        titleName: m.title_name,
        titleId: m.title_id,
        titleLinkable: !!m.title_id && linkableTitles.has(m.title_id),
        titleChange: m.title_change,
        rating: m.match_rating,
        duration: m.duration,
        result: m.result,
        finishNote: m.finish_note,
        outcome,
        winners,
        losers,
        sides: sideNames,
        event: {
          id: m.events.id,
          name: m.events.name,
          date: m.events.date,
          eventDate: m.events.event_date,
          promotionLabel: resolvePromotion(m.events.promotion),
        },
      },
    ]
  })
}

export const listWrestlerMatches = createServerFn({ method: 'GET' })
  .validator((input: { id: string; page?: number }) => ({
    id: input.id,
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<WrestlerMatchPage> => {
    const byMatch = await collectWrestlerMatchMeta(data.id)
    const sortedIds = sortMatchIdsDesc(byMatch)
    const total = sortedIds.length
    const from = (data.page - 1) * MATCH_PAGE_SIZE
    const pageIds = sortedIds.slice(from, from + MATCH_PAGE_SIZE)
    const matches = await hydrateWrestlerMatches(pageIds, byMatch)

    return {
      matches,
      total,
      page: data.page,
      pageSize: MATCH_PAGE_SIZE,
    }
  })

export interface WrestlerAdjacentMatches {
  previous: WrestlerMatch | null
  next: WrestlerMatch | null
}

/**
 * Previous = most recent past/today bout that has a decision (the wrestler's
 * side_role is winner/loser; "side" rows are no-decision/unentered results).
 * Next = soonest future bout, including a bout today with no result yet.
 * Dated events only.
 */
export const getWrestlerAdjacentMatches = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }): Promise<WrestlerAdjacentMatches> => {
    const byMatch = await collectWrestlerMatchMeta(data.id)
    const today = todayISO()

    let previousId: string | null = null
    let previousDate: string | null = null
    let nextId: string | null = null
    let nextDate: string | null = null

    for (const [id, meta] of byMatch) {
      const eventDate = meta.eventDate
      if (!eventDate) continue
      const hasResult = meta.sideRole !== 'side'
      if (eventDate <= today && hasResult) {
        if (!previousDate || eventDate > previousDate) {
          previousDate = eventDate
          previousId = id
        }
      } else if (eventDate >= today) {
        if (!nextDate || eventDate < nextDate) {
          nextDate = eventDate
          nextId = id
        }
      }
    }

    const ids = [previousId, nextId].filter((id): id is string => id != null)
    const hydrated = await hydrateWrestlerMatches(ids, byMatch)
    const byId = new Map(hydrated.map((m) => [m.id, m]))

    return {
      previous: previousId ? (byId.get(previousId) ?? null) : null,
      next: nextId ? (byId.get(nextId) ?? null) : null,
    }
  })

export const wrestlerMatchesQueryOptions = (id: string, page: number) =>
  queryOptions({
    queryKey: ['wrestler', id, 'matches', { page }],
    queryFn: () => listWrestlerMatches({ data: { id, page } }),
  })

export const wrestlerAdjacentMatchesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['wrestler', id, 'adjacent-matches'],
    queryFn: () => getWrestlerAdjacentMatches({ data: { id } }),
  })
