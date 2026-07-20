import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'
import { getPromotionResolver } from '#/lib/promotions'
import { readDashboardCache } from '#/lib/dashboard-cache'
import {
  getSdhTitleProfile,
  resolveTitleImageUrls,
  resolveWrestlerPortraitUrls,
  type SdhTitleProfile,
} from '#/lib/sdh'
import {
  cagematchTextToIso,
  resolveWrestlerTitleReignNumber,
  type TitleReignRef,
} from '#/lib/matches-shared'
import {
  eventDateInReign,
  isTitleDefenseRow,
  reignDateBounds,
} from '#/lib/titles-shared'
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
  /** Wrestler-specific reign number on this title (1 = first time holding it). */
  resolvedReignNumber: number | null
  /** SDH full-body portrait (falls back to gallery headshot). */
  imageUrl: string | null
}

export interface WorldChampionEntry {
  titleId: string
  titleName: string
  promotionLabel: string | null
  /** SDH belt art when a crosswalk (or slug fallback) match exists. */
  titleImageUrl: string | null
  // Reign start, DD.MM.YYYY text (title_reigns.from_date).
  fromDate: string | null
  daysHeld: number | null
  teamName: string | null
  champions: Array<TitleReignChampion>
}

export interface TopChampionsRow {
  label: string
  men: WorldChampionEntry | null
  women: WorldChampionEntry | null
}

/** Curated home dashboard slots (AEW → Japan → WWE Raw → WWE SmackDown). */
const TOP_CHAMPION_ROWS: Array<{
  label: string
  menTitleId: string
  womenTitleId: string
}> = [
  { label: 'AEW', menTitleId: '4331', womenTitleId: '4370' },
  { label: 'Japan', menTitleId: '145', womenTitleId: '1577' },
  { label: 'WWE Raw', menTitleId: '6069', womenTitleId: '3116' },
  { label: 'WWE SmackDown', menTitleId: '20', womenTitleId: '2906' },
]

/** SDH slugs for active titles missing a crosswalk row. */
const TOP_CHAMPION_TITLE_IMAGE_FALLBACK_SLUGS: Record<string, string> = {
  '145': 'njpw/iwgp-heavyweight-championship',
  '6069': 'wwe/world-heavyweight-championship',
  '3116': 'wwe/women-s-world-championship',
  '2906': 'wwe/wwe-women-s-championship',
}

async function resolveSdhTitleImagesBySlug(
  slugs: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (slugs.length === 0) return map

  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase
    .from('sdh_titles')
    .select('id, image_url')
    .in('id', slugs)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    if (row.image_url) map.set(row.id, row.image_url)
  }
  return map
}

function daysSince(fromDate: string | null): number | null {
  if (!fromDate) return null
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(fromDate)
  if (!m) return null
  const start = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const days = Math.floor((Date.now() - start) / 86_400_000)
  return days >= 0 ? days : null
}

// Curated top champions for the home dashboard (8 fixed title slots).
export const getWorldChampions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<TopChampionsRow>> => {
    const titleIds = TOP_CHAMPION_ROWS.flatMap((row) => [
      row.menTitleId,
      row.womenTitleId,
    ])

    const supabase = getCachedSupabaseServerClient()

    const { data: rows, error } = await supabase
      .from('title_reigns')
      .select('*, title_reign_champions(*), titles!inner(id, name)')
      .in('title_id', titleIds)
      .is('to_date', null)
    if (error) throw new Error(error.message)

    const reignByTitleId = new Map(
      (rows ?? []).map((r) => [r.titles.id, r] as const),
    )

    const wrestlerIds = new Set<string>()
    for (const r of rows ?? []) {
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

    const { data: titleRows, error: tErr } = await supabase
      .from('titles')
      .select('id, promotion')
      .in('id', titleIds)
    if (tErr) throw new Error(tErr.message)
    const promotionByTitle = new Map(
      (titleRows ?? []).map((t) => [t.id, t.promotion]),
    )

    const [resolvePromotion, crosswalkImages, slugImages, portraitImages] =
      await Promise.all([
        getPromotionResolver(),
        resolveTitleImageUrls(titleIds),
        resolveSdhTitleImagesBySlug(
          titleIds
            .map((id) => TOP_CHAMPION_TITLE_IMAGE_FALLBACK_SLUGS[id])
            .filter((slug): slug is string => !!slug),
        ),
        resolveWrestlerPortraitUrls(Array.from(wrestlerIds)),
      ])

    function titleImageUrl(titleId: string): string | null {
      return (
        crosswalkImages.get(titleId) ??
        slugImages.get(TOP_CHAMPION_TITLE_IMAGE_FALLBACK_SLUGS[titleId] ?? '') ??
        null
      )
    }

    function buildEntry(titleId: string): WorldChampionEntry | null {
      const reign = reignByTitleId.get(titleId)
      if (!reign) return null

      return {
        titleId: reign.titles.id,
        titleName: reign.titles.name,
        promotionLabel: resolvePromotion(
          promotionByTitle.get(reign.titles.id) ?? null,
        ),
        titleImageUrl: titleImageUrl(titleId),
        fromDate: reign.from_date,
        daysHeld: daysSince(reign.from_date),
        teamName: reign.team_name,
        champions: [...reign.title_reign_champions]
          .sort((a, b) => a.seq - b.seq)
          .map((c) => ({
            wrestlerId: c.wrestler_id,
            name: c.wrestler_name,
            linkable: !!c.wrestler_id && linkable.has(c.wrestler_id),
            reignCount: c.reign_count,
            resolvedReignNumber: c.reign_count ?? null,
            imageUrl: c.wrestler_id
              ? (portraitImages.get(c.wrestler_id) ?? null)
              : null,
          })),
      }
    }

    return TOP_CHAMPION_ROWS.map((row) => ({
      label: row.label,
      men: buildEntry(row.menTitleId),
      women: buildEntry(row.womenTitleId),
    }))
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

export interface TitleReignDefenseParticipant {
  wrestlerId: string | null
  name: string | null
  linkable: boolean
  imageUrl: string | null
  sideRole: 'winner' | 'loser'
}

export interface TitleReignDefense {
  matchId: string
  eventId: string
  eventName: string
  eventDate: string | null
  dateText: string | null
  matchType: string | null
  defenseNumber: number
  participants: Array<TitleReignDefenseParticipant>
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
  /** Successful title defenses during this reign (excludes the win itself). */
  defenseCount: number
  active: boolean
}

export interface TitleDetail {
  title: EnrichedTitle
  /** SDH name/belt-art history when a high-confidence crosswalk exists. */
  sdh: SdhTitleProfile | null
}

export const TITLE_REIGN_PAGE_SIZE = 10

export interface TitleReignPage {
  reigns: Array<TitleReign>
  total: number
  page: number
  pageSize: number
}

export interface TitleStatsChampion {
  wrestlerId: string | null
  name: string | null
  linkable: boolean
}

export interface TitleStatsReignRecord {
  reignId: string
  reignNumber: number
  value: number
  champions: Array<TitleStatsChampion>
}

export interface TitleStatsHolderRecord {
  wrestlerId: string | null
  name: string | null
  linkable: boolean
  reignsHeld: number
  totalDays: number
  totalDefenses: number
}

export interface TitleStatsDetail {
  reignCount: number
  totalDefenses: number
  uniqueChampions: number
  avgReignDays: number | null
  active: boolean
  longestReign: TitleStatsReignRecord | null
  shortestReign: TitleStatsReignRecord | null
  mostDefenses: TitleStatsReignRecord | null
  mostTimesHeld: TitleStatsHolderRecord | null
  mostDaysHeld: TitleStatsHolderRecord | null
  topHolders: Array<TitleStatsHolderRecord>
}

type MvTitleStatsRow = {
  title_id: string
  reign_count: number
  total_defenses: number
  unique_champions: number
  avg_reign_days: number | null
  active: boolean
  current_reign_id: string | null
  longest_reign_id: string | null
  longest_reign_number: number | null
  longest_reign_days: number | null
  longest_reign_champions: unknown
  shortest_reign_id: string | null
  shortest_reign_number: number | null
  shortest_reign_days: number | null
  shortest_reign_champions: unknown
  most_defenses_reign_id: string | null
  most_defenses_reign_number: number | null
  most_defenses_count: number | null
  most_defenses_champions: unknown
  most_reigns_wrestler_id: string | null
  most_reigns_wrestler_name: string | null
  most_reigns_count: number | null
  most_reigns_total_days: number | null
  most_reigns_total_defenses: number | null
  most_days_wrestler_id: string | null
  most_days_wrestler_name: string | null
  most_days_total: number | null
  most_days_reigns_held: number | null
  most_days_total_defenses: number | null
  top_holders: unknown
}

type MvChampionJson = {
  wrestlerId?: string | null
  name?: string | null
}

type MvHolderJson = {
  wrestlerId?: string | null
  name?: string | null
  reignsHeld?: number
  totalDays?: number
  totalDefenses?: number
}

function parseMvChampions(
  value: unknown,
  linkable: ReadonlySet<string>,
): Array<TitleStatsChampion> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as MvChampionJson
    const wrestlerId =
      typeof row.wrestlerId === 'string' ? row.wrestlerId : null
    const name = typeof row.name === 'string' ? row.name : null
    return [
      {
        wrestlerId,
        name,
        linkable: !!wrestlerId && linkable.has(wrestlerId),
      },
    ]
  })
}

function mapReignRecord(
  reignId: string | null,
  reignNumber: number | null,
  value: number | null,
  champions: unknown,
  linkable: ReadonlySet<string>,
): TitleStatsReignRecord | null {
  if (!reignId || reignNumber == null || value == null) return null
  return {
    reignId,
    reignNumber,
    value,
    champions: parseMvChampions(champions, linkable),
  }
}

function mapHolderRecord(
  wrestlerId: string | null,
  name: string | null,
  reignsHeld: number | null,
  totalDays: number | null,
  totalDefenses: number | null,
  linkable: ReadonlySet<string>,
): TitleStatsHolderRecord | null {
  if (reignsHeld == null || totalDays == null || totalDefenses == null) {
    return null
  }
  if (!wrestlerId && !name) return null
  return {
    wrestlerId,
    name,
    linkable: !!wrestlerId && linkable.has(wrestlerId),
    reignsHeld,
    totalDays,
    totalDefenses,
  }
}

function collectWrestlerIdsFromStats(row: MvTitleStatsRow): Array<string> {
  const ids = new Set<string>()
  const addFromChampions = (value: unknown) => {
    if (!Array.isArray(value)) return
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue
      const wrestlerId = (entry as MvChampionJson).wrestlerId
      if (typeof wrestlerId === 'string') ids.add(wrestlerId)
    }
  }

  addFromChampions(row.longest_reign_champions)
  addFromChampions(row.shortest_reign_champions)
  addFromChampions(row.most_defenses_champions)

  for (const id of [
    row.most_reigns_wrestler_id,
    row.most_days_wrestler_id,
  ]) {
    if (typeof id === 'string') ids.add(id)
  }

  if (Array.isArray(row.top_holders)) {
    for (const entry of row.top_holders) {
      if (!entry || typeof entry !== 'object') continue
      const wrestlerId = (entry as MvHolderJson).wrestlerId
      if (typeof wrestlerId === 'string') ids.add(wrestlerId)
    }
  }

  return Array.from(ids)
}

function mapTopHolders(
  value: unknown,
  linkable: ReadonlySet<string>,
): Array<TitleStatsHolderRecord> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as MvHolderJson
    const mapped = mapHolderRecord(
      typeof row.wrestlerId === 'string' ? row.wrestlerId : null,
      typeof row.name === 'string' ? row.name : null,
      typeof row.reignsHeld === 'number' ? row.reignsHeld : null,
      typeof row.totalDays === 'number' ? row.totalDays : null,
      typeof row.totalDefenses === 'number' ? row.totalDefenses : null,
      linkable,
    )
    return mapped ? [mapped] : []
  })
}

function mapTitleStatsRow(
  row: MvTitleStatsRow,
  linkable: ReadonlySet<string>,
): TitleStatsDetail {
  return {
    reignCount: row.reign_count,
    totalDefenses: row.total_defenses,
    uniqueChampions: row.unique_champions,
    avgReignDays:
      row.avg_reign_days != null ? Number(row.avg_reign_days) : null,
    active: row.active,
    longestReign: mapReignRecord(
      row.longest_reign_id,
      row.longest_reign_number,
      row.longest_reign_days,
      row.longest_reign_champions,
      linkable,
    ),
    shortestReign: mapReignRecord(
      row.shortest_reign_id,
      row.shortest_reign_number,
      row.shortest_reign_days,
      row.shortest_reign_champions,
      linkable,
    ),
    mostDefenses: mapReignRecord(
      row.most_defenses_reign_id,
      row.most_defenses_reign_number,
      row.most_defenses_count,
      row.most_defenses_champions,
      linkable,
    ),
    mostTimesHeld: mapHolderRecord(
      row.most_reigns_wrestler_id,
      row.most_reigns_wrestler_name,
      row.most_reigns_count,
      row.most_reigns_total_days,
      row.most_reigns_total_defenses,
      linkable,
    ),
    mostDaysHeld: mapHolderRecord(
      row.most_days_wrestler_id,
      row.most_days_wrestler_name,
      row.most_days_reigns_held,
      row.most_days_total,
      row.most_days_total_defenses,
      linkable,
    ),
    topHolders: mapTopHolders(row.top_holders, linkable),
  }
}

type ReignRow = Tables<'title_reigns'> & {
  title_reign_champions: Array<Tables<'title_reign_champions'>>
}

type TitleChangeRow = {
  id: string
  event_id: string
  match_index: number
  events: {
    id: string
    name: string | null
    date: string | null
    event_date: string | null
  } | null
  match_sides: Array<{
    side_role: string
    side_index: number
    match_side_participants: Array<{
      participant_role: string
      participant_id: string | null
      participant_name: string | null
      seq: number
    }>
  }>
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

type DefenseMatchRow = {
  id: string
  match_index: number
  match_type: string | null
  title_change: boolean | null
  result: string | null
  events: {
    id: string
    name: string | null
    date: string | null
    event_date: string | null
    event_type: string | null
  } | null
  match_sides: Array<{
    side_role: string
    side_index: number
    is_champion: boolean | null
    match_side_participants: Array<{
      participant_role: string
      participant_id: string | null
      participant_name: string | null
      seq: number
    }>
  }>
}

async function fetchTitleDefenseMatches(
  titleId: string,
): Promise<Array<DefenseMatchRow>> {
  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, match_index, match_type, title_change, result, events(id, name, date, event_date, event_type), match_sides(side_role, side_index, is_champion, match_side_participants(participant_role, participant_id, participant_name, seq))',
    )
    .eq('title_id', titleId)
    .eq('result', 'decisive')
    .eq('title_change', false)
  if (error) throw new Error(error.message)
  return (data ?? []).filter((row) =>
    isTitleDefenseRow({
      result: row.result,
      titleChange: row.title_change,
      matchType: row.match_type,
      eventType: row.events?.event_type,
      sides: row.match_sides.map((s) => ({ isChampion: s.is_champion })),
    }),
  )
}

function extractDefenseParticipants(
  sides: DefenseMatchRow['match_sides'],
): Array<TitleReignDefenseParticipant> {
  const participants: Array<TitleReignDefenseParticipant> = []
  const sorted = [...sides].sort(
    (a, b) =>
      (sideOrder[a.side_role] ?? 9) - (sideOrder[b.side_role] ?? 9) ||
      a.side_index - b.side_index,
  )

  for (const side of sorted) {
    if (side.side_role !== 'winner' && side.side_role !== 'loser') continue
    const parts = [...side.match_side_participants].sort((a, b) => a.seq - b.seq)
    for (const p of parts) {
      if (p.participant_role !== 'wrestler') continue
      participants.push({
        wrestlerId: p.participant_id,
        name: p.participant_name,
        linkable: false,
        imageUrl: null,
        sideRole: side.side_role as 'winner' | 'loser',
      })
    }
  }

  return participants
}

function buildDefenseFromRow(
  row: DefenseMatchRow,
  defenseNumber: number,
): TitleReignDefense {
  const event = row.events
  return {
    matchId: row.id,
    eventId: event?.id ?? '',
    eventName: event?.name ?? 'Untitled event',
    eventDate: event?.event_date ?? null,
    dateText: event?.date ?? null,
    matchType: row.match_type,
    defenseNumber,
    participants: extractDefenseParticipants(row.match_sides),
  }
}

function reignDefenseMatches(
  rows: ReadonlyArray<DefenseMatchRow>,
  fromDate: string | null,
  toDate: string | null,
): Array<TitleReignDefense> {
  const { startIso, endIso } = reignDateBounds(fromDate, toDate)
  if (!startIso) return []

  const chronological = rows
    .filter((row) =>
      eventDateInReign(row.events?.event_date, startIso, endIso),
    )
    .sort((a, b) => {
      const aDate = a.events?.event_date ?? ''
      const bDate = b.events?.event_date ?? ''
      return (
        aDate.localeCompare(bDate) ||
        (a.events?.date ?? '').localeCompare(b.events?.date ?? '') ||
        a.match_index - b.match_index
      )
    })

  return chronological
    .map((row, index) => buildDefenseFromRow(row, index + 1))
    .reverse()
}

async function enrichReignDefenses(
  defenses: Array<TitleReignDefense>,
): Promise<Array<TitleReignDefense>> {
  const wrestlerIds = new Set<string>()
  for (const defense of defenses) {
    for (const p of defense.participants) {
      if (p.wrestlerId) wrestlerIds.add(p.wrestlerId)
    }
  }
  if (wrestlerIds.size === 0) return defenses

  const supabase = getCachedSupabaseServerClient()
  const ids = Array.from(wrestlerIds)
  const [{ data: valid, error }, headshots] = await Promise.all([
    supabase.from('wrestlers').select('id').in('id', ids),
    resolveWrestlerPortraitUrls(ids),
  ])
  if (error) throw new Error(error.message)

  const linkable = new Set<string>()
  for (const w of valid ?? []) linkable.add(w.id)

  return defenses.map((defense) => ({
    ...defense,
    participants: defense.participants.map((p) => ({
      ...p,
      linkable: !!p.wrestlerId && linkable.has(p.wrestlerId),
      imageUrl: p.wrestlerId ? (headshots.get(p.wrestlerId) ?? null) : null,
    })),
  }))
}

function resolveChampionReignNumbers(
  titleId: string,
  allReignRefs: ReadonlyArray<TitleReignRef>,
  fromDate: string | null,
  champions: Array<{
    wrestler_id: string | null
    wrestler_name: string | null
    reign_count: number | null
  }>,
): Array<number | null> {
  const startIso = cagematchTextToIso(fromDate)
  if (!startIso) return champions.map(() => null)

  return champions.map((c) =>
    resolveWrestlerTitleReignNumber(
      allReignRefs,
      titleId,
      startIso,
      c.wrestler_id ? new Set([c.wrestler_id]) : new Set<string>(),
      c.wrestler_name
        ? new Set([c.wrestler_name.toLowerCase()])
        : new Set<string>(),
      c.reign_count,
    ),
  )
}

function indexChangesByDate(
  changes: ReadonlyArray<TitleChangeRow>,
): Map<string, Array<TitleChangeRow>> {
  const changesByDate = new Map<string, Array<TitleChangeRow>>()
  for (const m of changes) {
    const dateText = m.events?.date
    if (!dateText) continue
    const list = changesByDate.get(dateText) ?? []
    list.push(m)
    changesByDate.set(dateText, list)
  }
  return changesByDate
}

async function fetchTitleChangeMatches(
  titleId: string,
): Promise<Array<TitleChangeRow>> {
  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, event_id, match_index, events(id, name, date, event_date), match_sides(side_role, side_index, match_side_participants(participant_role, participant_id, participant_name, seq))',
    )
    .eq('title_id', titleId)
    .eq('title_change', true)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchAllReignRefs(
  titleId: string,
): Promise<Array<TitleReignRef>> {
  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase
    .from('title_reigns')
    .select(
      'from_date, title_reign_champions(wrestler_id, wrestler_name, reign_count)',
    )
    .eq('title_id', titleId)
    .order('reign_number', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    title_id: titleId,
    from_date: r.from_date,
    champions: r.title_reign_champions,
  }))
}

function buildReignsFromRows(
  titleId: string,
  reignRows: ReadonlyArray<ReignRow>,
  allReignRefs: ReadonlyArray<TitleReignRef>,
  changesByDate: ReadonlyMap<string, Array<TitleChangeRow>>,
  defenseRows: ReadonlyArray<DefenseMatchRow>,
  linkable: ReadonlySet<string>,
  headshots: ReadonlyMap<string, string>,
): Array<TitleReign> {
  return reignRows.map((r) => {
    const sortedChampions = [...r.title_reign_champions].sort(
      (a, b) => a.seq - b.seq,
    )
    const resolvedNumbers = resolveChampionReignNumbers(
      titleId,
      allReignRefs,
      r.from_date,
      sortedChampions,
    )
    const champions = sortedChampions.map((c, i) => ({
      wrestlerId: c.wrestler_id,
      name: c.wrestler_name,
      linkable: !!c.wrestler_id && linkable.has(c.wrestler_id),
      reignCount: c.reign_count,
      resolvedReignNumber: resolvedNumbers[i] ?? null,
      imageUrl: c.wrestler_id ? (headshots.get(c.wrestler_id) ?? null) : null,
    }))

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
      defenseCount: reignDefenseMatches(defenseRows, r.from_date, r.to_date)
        .length,
      active: r.to_date == null,
    }
  })
}

export const getTitle = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }): Promise<TitleDetail | null> => {
    const supabase = getCachedSupabaseServerClient()

    const [
      { data: title, error },
      { count: reignCount, error: countErr },
      { data: activeRows, error: activeErr },
      imageById,
      sdh,
    ] = await Promise.all([
      supabase.from('titles').select('*').eq('id', data.id).maybeSingle(),
      supabase
        .from('title_reigns')
        .select('*', { count: 'exact', head: true })
        .eq('title_id', data.id),
      supabase
        .from('title_reigns')
        .select('id')
        .eq('title_id', data.id)
        .is('to_date', null)
        .limit(1),
      resolveTitleImageUrls([data.id]),
      getSdhTitleProfile(data.id),
    ])
    if (error) throw new Error(error.message)
    if (countErr) throw new Error(countErr.message)
    if (activeErr) throw new Error(activeErr.message)
    if (!title) return null

    const resolvePromotion = await getPromotionResolver()

    return {
      title: {
        ...title,
        promotionLabel: resolvePromotion(title.promotion),
        reignCount: reignCount ?? 0,
        active: (activeRows?.length ?? 0) > 0,
        imageUrl: imageById.get(title.id) ?? null,
      },
      sdh,
    }
  })

export const listTitleReigns = createServerFn({ method: 'GET' })
  .validator((input: { titleId: string; page: number }) => ({
    titleId: input.titleId,
    page:
      typeof input.page === 'number' && input.page > 0
        ? Math.floor(input.page)
        : 1,
  }))
  .handler(async ({ data }): Promise<TitleReignPage> => {
    const supabase = getCachedSupabaseServerClient()
    const page = data.page
    const from = (page - 1) * TITLE_REIGN_PAGE_SIZE
    const to = from + TITLE_REIGN_PAGE_SIZE - 1

    const [
      { data: reignRows, error: rErr, count },
      allReignRefs,
      changeRows,
      defenseRows,
    ] = await Promise.all([
      supabase
        .from('title_reigns')
        .select('*, title_reign_champions(*)', { count: 'exact' })
        .eq('title_id', data.titleId)
        .order('reign_number', { ascending: false })
        .range(from, to),
      fetchAllReignRefs(data.titleId),
      fetchTitleChangeMatches(data.titleId),
      fetchTitleDefenseMatches(data.titleId),
    ])
    if (rErr) throw new Error(rErr.message)

    const changesByDate = indexChangesByDate(changeRows)

    const wrestlerIds = new Set<string>()
    for (const r of reignRows ?? []) {
      for (const c of r.title_reign_champions) {
        if (c.wrestler_id) wrestlerIds.add(c.wrestler_id)
      }
    }

    let linkable = new Set<string>()
    let headshots = new Map<string, string>()
    if (wrestlerIds.size > 0) {
      const ids = Array.from(wrestlerIds)
      const [{ data: valid, error: wErr }, headshotMap] = await Promise.all([
        supabase.from('wrestlers').select('id').in('id', ids),
        resolveWrestlerPortraitUrls(ids),
      ])
      if (wErr) throw new Error(wErr.message)
      for (const w of valid ?? []) linkable.add(w.id)
      headshots = headshotMap
    }

    const reigns = buildReignsFromRows(
      data.titleId,
      reignRows ?? [],
      allReignRefs,
      changesByDate,
      defenseRows,
      linkable,
      headshots,
    )

    return {
      reigns,
      total: count ?? 0,
      page,
      pageSize: TITLE_REIGN_PAGE_SIZE,
    }
  })

export const listTitleReignDefenses = createServerFn({ method: 'GET' })
  .validator((input: { titleId: string; reignId: string }) => ({
    titleId: input.titleId,
    reignId: input.reignId,
  }))
  .handler(async ({ data }): Promise<Array<TitleReignDefense>> => {
    const supabase = getCachedSupabaseServerClient()

    const { data: reign, error } = await supabase
      .from('title_reigns')
      .select('id, title_id, from_date, to_date')
      .eq('id', data.reignId)
      .eq('title_id', data.titleId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!reign) return []

    const defenseRows = await fetchTitleDefenseMatches(data.titleId)
    const defenses = reignDefenseMatches(
      defenseRows,
      reign.from_date,
      reign.to_date,
    )
    return enrichReignDefenses(defenses)
  })

export const getTitleStats = createServerFn({ method: 'GET' })
  .validator((input: { titleId: string }) => ({ titleId: input.titleId }))
  .handler(async ({ data }): Promise<TitleStatsDetail | null> => {
    const supabase = getCachedSupabaseServerClient()

    const { data: row, error } = await supabase
      .from('mv_title_stats')
      .select('*')
      .eq('title_id', data.titleId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) return null

    const statsRow = row as unknown as MvTitleStatsRow
    const wrestlerIds = collectWrestlerIdsFromStats(statsRow)
    const linkable = new Set<string>()

    if (wrestlerIds.length > 0) {
      const { data: valid, error: wErr } = await supabase
        .from('wrestlers')
        .select('id')
        .in('id', wrestlerIds)
      if (wErr) throw new Error(wErr.message)
      for (const w of valid ?? []) linkable.add(w.id)
    }

    return mapTitleStatsRow(statsRow, linkable)
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

export const titleReignsQueryOptions = (titleId: string, page: number) =>
  queryOptions({
    queryKey: ['title', titleId, 'reigns', page],
    queryFn: () => listTitleReigns({ data: { titleId, page } }),
  })

export const titleStatsQueryOptions = (titleId: string) =>
  queryOptions({
    queryKey: ['title', titleId, 'stats'],
    queryFn: () => getTitleStats({ data: { titleId } }),
    staleTime: 10 * 60 * 1000,
  })

export const titleReignDefensesQueryOptions = (
  titleId: string,
  reignId: string,
) =>
  queryOptions({
    queryKey: ['title', titleId, 'reign', reignId, 'defenses'],
    queryFn: () =>
      listTitleReignDefenses({ data: { titleId, reignId } }),
  })

export const worldChampionsQueryOptions = () =>
  queryOptions({
    queryKey: ['titles', 'top-champions'],
    queryFn: () => getWorldChampions(),
  })
