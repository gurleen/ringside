import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'
import { getPromotionResolver } from '#/lib/events'
import { readDashboardCache } from '#/lib/dashboard-cache'
import { resolveTitleImageUrls } from '#/lib/sdh'
import type { PromotionOption } from '#/lib/events'
import type { Tables } from '#/lib/database.types'

export type TitleRow = Tables<'titles'>
export type EnrichedTitle = TitleRow & {
  promotionLabel: string | null
  reignCount: number
  // True when at least one reign has to_date IS NULL (currently held).
  active: boolean
  /** Full belt art from Smackdown Hotel when a crosswalk match exists. */
  imageUrl: string | null
}

export type TitleStatus = 'all' | 'active' | 'inactive'

const PAGE_SIZE = 9

export interface TitlePage {
  titles: Array<EnrichedTitle>
  total: number
  page: number
  pageSize: number
}

// Distinct promotions that appear on titles, resolved to display labels.
export const listTitlePromotions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<PromotionOption>> => {
    const cached =
      await readDashboardCache<Array<PromotionOption>>('title_promotions')
    if (cached) return cached

    const supabase = getCachedSupabaseServerClient()

    const { data: rows, error } = await supabase
      .from('titles')
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

export const listTitles = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      search?: string
      page?: number
      promotion?: string
      status?: TitleStatus
    }) => ({
      search: input.search?.trim() ?? '',
      page: Math.max(1, input.page ?? 1),
      promotion: input.promotion?.trim() ?? '',
      status: (['all', 'active', 'inactive'].includes(input.status as string)
        ? input.status
        : 'all') as TitleStatus,
    }),
  )
  .handler(async ({ data }): Promise<TitlePage> => {
    // Default list (no search/filter, status=all, page 1) is served from the
    // pg_cron-refreshed dashboard_cache; other parameter combinations compute
    // live.
    if (
      !data.search &&
      data.page === 1 &&
      !data.promotion &&
      data.status === 'all'
    ) {
      const cached =
        await readDashboardCache<TitlePage>('titles_default_page')
      if (cached) return cached
    }

    const supabase = getCachedSupabaseServerClient()
    const from = (data.page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // Active titles = those with at least one open reign (to_date IS NULL).
    // Needed both for the status filter and for the per-card active badge.
    const { data: openReigns, error: openErr } = await supabase
      .from('title_reigns')
      .select('title_id')
      .is('to_date', null)
    if (openErr) throw new Error(openErr.message)
    const activeIds = new Set<string>()
    for (const r of openReigns ?? []) activeIds.add(r.title_id)

    let query = supabase
      .from('titles')
      .select('*', { count: 'exact' })
      .order('name')
      .range(from, to)

    if (data.search) {
      query = query.ilike('name', `%${data.search}%`)
    }

    if (data.promotion) {
      query = query.eq('promotion', data.promotion)
    }

    if (data.status === 'active') {
      if (activeIds.size === 0) {
        return {
          titles: [],
          total: 0,
          page: data.page,
          pageSize: PAGE_SIZE,
        }
      }
      query = query.in('id', Array.from(activeIds))
    } else if (data.status === 'inactive' && activeIds.size > 0) {
      query = query.not('id', 'in', `(${Array.from(activeIds).join(',')})`)
    }

    const { data: rows, count: total, error } = await query
    if (error) throw new Error(error.message)

    const titleRows = rows ?? []

    // Reign counts for the titles on this page.
    const ids = titleRows.map((t) => t.id)
    const countById = new Map<string, number>()
    if (ids.length > 0) {
      const { data: reigns, error: rErr } = await supabase
        .from('title_reigns')
        .select('title_id')
        .in('title_id', ids)
      if (rErr) throw new Error(rErr.message)
      for (const r of reigns ?? []) {
        countById.set(r.title_id, (countById.get(r.title_id) ?? 0) + 1)
      }
    }

    const [resolvePromotion, imageById] = await Promise.all([
      getPromotionResolver(),
      resolveTitleImageUrls(ids),
    ])

    return {
      titles: titleRows.map((t) => ({
        ...t,
        promotionLabel: resolvePromotion(t.promotion),
        reignCount: countById.get(t.id) ?? 0,
        active: activeIds.has(t.id),
        imageUrl: imageById.get(t.id) ?? null,
      })),
      total: total ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    }
  })

export interface TitleReignChampion {
  wrestlerId: string | null
  name: string | null
  linkable: boolean
  reignCount: number | null
}

export interface WorldChampionEntry {
  titleId: string
  titleName: string
  promotionLabel: string | null
  // Reign start, DD.MM.YYYY text (title_reigns.from_date).
  fromDate: string | null
  daysHeld: number | null
  teamName: string | null
  champions: Array<TitleReignChampion>
}

function daysSince(fromDate: string | null): number | null {
  if (!fromDate) return null
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(fromDate)
  if (!m) return null
  const start = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const days = Math.floor((Date.now() - start) / 86_400_000)
  return days >= 0 ? days : null
}

// Reigning champions of "world" titles (dashboard). A title counts as a world
// title when its name contains "World" or "Undisputed" — the latter covers
// the Undisputed WWE Championship, which lacks the word "World".
export const getWorldChampions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<WorldChampionEntry>> => {
    const cached =
      await readDashboardCache<Array<WorldChampionEntry>>('world_champions')
    if (cached) return cached

    const supabase = getCachedSupabaseServerClient()

    const { data: rows, error } = await supabase
      .from('title_reigns')
      .select('*, title_reign_champions(*), titles!inner(id, name)')
      .is('to_date', null)
    if (error) throw new Error(error.message)

    const reigns = (rows ?? []).filter((r) =>
      /world|undisputed/i.test(r.titles.name),
    )

    const wrestlerIds = new Set<string>()
    for (const r of reigns) {
      for (const c of r.title_reign_champions) {
        if (c.wrestler_id) wrestlerIds.add(c.wrestler_id)
      }
    }

    const linkable = new Set<string>()
    if (wrestlerIds.size > 0) {
      const { data: valid, error: wErr } = await supabase
        .from('wrestlers')
        .select('id')
        .in('id', Array.from(wrestlerIds))
      if (wErr) throw new Error(wErr.message)
      for (const w of valid ?? []) linkable.add(w.id)
    }

    // titles.promotion isn't embedded (no FK); resolve via the titles table.
    const { data: titleRows, error: tErr } = await supabase
      .from('titles')
      .select('id, promotion')
      .in('id', Array.from(new Set(reigns.map((r) => r.titles.id))))
    if (tErr) throw new Error(tErr.message)
    const promotionByTitle = new Map(
      (titleRows ?? []).map((t) => [t.id, t.promotion]),
    )

    const resolvePromotion = await getPromotionResolver()

    const entries: Array<WorldChampionEntry> = reigns.map((r) => ({
      titleId: r.titles.id,
      titleName: r.titles.name,
      promotionLabel: resolvePromotion(
        promotionByTitle.get(r.titles.id) ?? null,
      ),
      fromDate: r.from_date,
      daysHeld: daysSince(r.from_date),
      teamName: r.team_name,
      champions: [...r.title_reign_champions]
        .sort((a, b) => a.seq - b.seq)
        .map((c) => ({
          wrestlerId: c.wrestler_id,
          name: c.wrestler_name,
          linkable: !!c.wrestler_id && linkable.has(c.wrestler_id),
          reignCount: c.reign_count,
        })),
    }))

    return entries.sort(
      (a, b) =>
        (a.promotionLabel ?? '').localeCompare(b.promotionLabel ?? '') ||
        a.titleName.localeCompare(b.titleName),
    )
  },
)

// Match that started this reign (title_change on the same calendar date).
export interface TitleChangeMatch {
  matchId: string
  eventId: string
  eventName: string
  // Prefer events.event_date (ISO); fall back to events.date (DD.MM.YYYY).
  eventDate: string | null
  dateText: string | null
  winners: Array<string>
  losers: Array<string>
}

export interface TitleReign {
  id: string
  reignNumber: number
  fromDate: string | null
  toDate: string | null
  durationDays: number | null
  location: string | null
  teamName: string | null
  champions: Array<TitleReignChampion>
  changeMatch: TitleChangeMatch | null
}

export interface TitleDetail {
  title: EnrichedTitle
  reigns: Array<TitleReign>
}

const sideOrder: Record<string, number> = { winner: 0, side: 1, loser: 2 }

// Prefer wrestler names for the "X def. Y" line; fall back to team names.
// Skip valets. Join with " & ".
function sideNames(
  sides: Array<{
    side_role: string
    side_index: number
    match_side_participants: Array<{
      participant_role: string
      participant_name: string | null
      seq: number
    }>
  }>,
  role: 'winner' | 'loser',
): Array<string> {
  const matching = sides
    .filter((s) => s.side_role === role)
    .sort((a, b) => a.side_index - b.side_index)

  const names: Array<string> = []
  for (const s of matching) {
    const parts = [...s.match_side_participants].sort((a, b) => a.seq - b.seq)
    const wrestlers = parts
      .filter((p) => p.participant_role === 'wrestler' && p.participant_name)
      .map((p) => p.participant_name as string)
    if (wrestlers.length > 0) {
      names.push(...wrestlers)
      continue
    }
    const teams = parts
      .filter((p) => p.participant_role === 'team' && p.participant_name)
      .map((p) => p.participant_name as string)
    names.push(...teams)
  }
  return names
}

function winnerIds(
  sides: Array<{
    side_role: string
    match_side_participants: Array<{
      participant_role: string
      participant_id: string | null
    }>
  }>,
): Set<string> {
  const ids = new Set<string>()
  for (const s of sides) {
    if (s.side_role !== 'winner') continue
    for (const p of s.match_side_participants) {
      if (p.participant_role === 'wrestler' && p.participant_id) {
        ids.add(p.participant_id)
      }
    }
  }
  return ids
}

export const getTitle = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }): Promise<TitleDetail | null> => {
    const supabase = getCachedSupabaseServerClient()

    const { data: title, error } = await supabase
      .from('titles')
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!title) return null

    const [
      { data: reignRows, error: rErr },
      { data: changeRows, error: cErr },
      imageById,
    ] = await Promise.all([
      supabase
        .from('title_reigns')
        .select('*, title_reign_champions(*)')
        .eq('title_id', data.id)
        .order('reign_number', { ascending: false }),
      // Title-change matches for this belt. Joined to reigns by events.date
      // === title_reigns.from_date (both text DD.MM.YYYY). No FK between them.
      supabase
        .from('matches')
        .select(
          'id, event_id, match_index, events(id, name, date, event_date), match_sides(side_role, side_index, match_side_participants(participant_role, participant_id, participant_name, seq))',
        )
        .eq('title_id', data.id)
        .eq('title_change', true),
      resolveTitleImageUrls([data.id]),
    ])
    if (rErr) throw new Error(rErr.message)
    if (cErr) throw new Error(cErr.message)

    const reignsData = reignRows ?? []
    const changes = changeRows ?? []

    // Index title-change matches by event date text (DD.MM.YYYY).
    const changesByDate = new Map<string, typeof changes>()
    for (const m of changes) {
      const dateText = m.events?.date
      if (!dateText) continue
      const list = changesByDate.get(dateText) ?? []
      list.push(m)
      changesByDate.set(dateText, list)
    }

    // Collect champion wrestler ids to determine which are linkable.
    const wrestlerIds = new Set<string>()
    for (const r of reignsData) {
      for (const c of r.title_reign_champions) {
        if (c.wrestler_id) wrestlerIds.add(c.wrestler_id)
      }
    }

    const linkable = new Set<string>()
    if (wrestlerIds.size > 0) {
      const { data: valid, error: wErr } = await supabase
        .from('wrestlers')
        .select('id')
        .in('id', Array.from(wrestlerIds))
      if (wErr) throw new Error(wErr.message)
      for (const w of valid ?? []) linkable.add(w.id)
    }

    const resolvePromotion = await getPromotionResolver()

    const reigns: Array<TitleReign> = reignsData.map((r) => {
      const champions = [...r.title_reign_champions]
        .sort((a, b) => a.seq - b.seq)
        .map((c) => ({
          wrestlerId: c.wrestler_id,
          name: c.wrestler_name,
          linkable: !!c.wrestler_id && linkable.has(c.wrestler_id),
          reignCount: c.reign_count,
        }))

      // Pick the title-change match on this reign's start date. If several
      // share the date, prefer the one whose winners overlap the champions.
      let changeMatch: TitleChangeMatch | null = null
      const candidates = r.from_date
        ? (changesByDate.get(r.from_date) ?? [])
        : []
      if (candidates.length > 0) {
        const champIds = new Set(
          champions.map((c) => c.wrestlerId).filter((id): id is string => !!id),
        )
        const ranked = [...candidates].sort((a, b) => {
          const aHit = [...winnerIds(a.match_sides)].some((id) =>
            champIds.has(id),
          )
            ? 1
            : 0
          const bHit = [...winnerIds(b.match_sides)].some((id) =>
            champIds.has(id),
          )
            ? 1
            : 0
          return bHit - aHit || a.match_index - b.match_index
        })
        const pick = ranked[0]
        const event = pick.events
        if (event) {
          const sides = [...pick.match_sides].sort(
            (a, b) =>
              (sideOrder[a.side_role] ?? 9) - (sideOrder[b.side_role] ?? 9) ||
              a.side_index - b.side_index,
          )
          changeMatch = {
            matchId: pick.id,
            eventId: event.id,
            eventName: event.name ?? 'Untitled event',
            eventDate: event.event_date,
            dateText: event.date,
            winners: sideNames(sides, 'winner'),
            losers: sideNames(sides, 'loser'),
          }
        }
      }

      return {
        id: r.id,
        reignNumber: r.reign_number,
        fromDate: r.from_date,
        toDate: r.to_date,
        durationDays: r.duration_days,
        location: r.location,
        teamName: r.team_name,
        champions,
        changeMatch,
      }
    })

    return {
      title: {
        ...title,
        promotionLabel: resolvePromotion(title.promotion),
        reignCount: reigns.length,
        active: reigns.some((r) => r.toDate == null),
        imageUrl: imageById.get(title.id) ?? null,
      },
      reigns,
    }
  })

export const titlesQueryOptions = (
  search: string,
  page: number,
  promotion: string,
  status: TitleStatus,
) =>
  queryOptions({
    queryKey: ['titles', 'list', { search, page, promotion, status }],
    queryFn: () => listTitles({ data: { search, page, promotion, status } }),
  })

export const titlePromotionsQueryOptions = () =>
  queryOptions({
    queryKey: ['titles', 'promotions'],
    queryFn: () => listTitlePromotions(),
  })

export const titleQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['title', id],
    queryFn: () => getTitle({ data: { id } }),
  })

export const worldChampionsQueryOptions = () =>
  queryOptions({
    queryKey: ['titles', 'world-champions'],
    queryFn: () => getWorldChampions(),
  })
