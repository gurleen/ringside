import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getCachedSupabaseServerClient } from '#/lib/supabase'
import { resolveWrestlerHeadshotUrls } from '#/lib/sdh'
import { normalizeRivalryIds } from '#/lib/rivalries-shared'
import {
  MATCH_PAGE_SIZE,
  collectWrestlerMatchMeta,
  hydrateWrestlerMatches,
  sortMatchIdsDesc,
} from '#/lib/wrestling'
import type {
  WrestlerMatch,
  WrestlerMatchMeta,
  WrestlerMatchOutcome,
} from '#/lib/wrestling'

export {
  rivalryKeyFromIds,
  parseRivalryKey,
  rivalryIdsFromMatchSides,
  normalizeRivalryIds,
} from '#/lib/rivalries-shared'

export interface RivalryWrestler {
  id: string
  name: string
  imageUrl: string | null
}

export interface RivalryDetail {
  ids: Array<string>
  wrestlers: Array<RivalryWrestler>
}

export interface RivalryMatch extends Omit<WrestlerMatch, 'outcome'> {
  outcome: WrestlerMatchOutcome | null
}

export interface RivalryMatchPage {
  matches: Array<RivalryMatch>
  total: number
  page: number
  pageSize: number
}

const PARTICIPANT_CHUNK = 200

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

/** Keep matches whose wrestler-id set equals the rivalry set. */
async function filterExactSetMatchIds(
  candidateIds: Array<string>,
  rivalryIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  if (candidateIds.length === 0) return []

  const rivalrySet = new Set(rivalryIds)
  const supabase = getCachedSupabaseServerClient()
  const wrestlerIdsByMatch = new Map<string, Set<string>>()

  for (let i = 0; i < candidateIds.length; i += PARTICIPANT_CHUNK) {
    const chunk = candidateIds.slice(i, i + PARTICIPANT_CHUNK)
    const { data, error } = await supabase
      .from('match_sides')
      .select(
        'match_id, match_side_participants(participant_role, participant_id)',
      )
      .in('match_id', chunk)
    if (error) throw new Error(error.message)

    for (const side of data ?? []) {
      let set = wrestlerIdsByMatch.get(side.match_id)
      if (!set) {
        set = new Set()
        wrestlerIdsByMatch.set(side.match_id, set)
      }
      for (const p of side.match_side_participants ?? []) {
        if (p.participant_role !== 'wrestler') continue
        const id = p.participant_id?.trim()
        if (id) set.add(id)
      }
    }
  }

  return candidateIds.filter((id) => {
    const set = wrestlerIdsByMatch.get(id)
    return set != null && setsEqual(set, rivalrySet)
  })
}

async function intersectRivalryMatchMeta(
  ids: ReadonlyArray<string>,
  focusWrestlerId: string | undefined,
  includeOthers: boolean,
): Promise<{
  sortedIds: Array<string>
  byMatch: Map<string, WrestlerMatchMeta>
}> {
  const metas = await Promise.all(
    ids.map((id) => collectWrestlerMatchMeta(id)),
  )

  let intersection: Array<string> | null = null
  for (const meta of metas) {
    const matchIds = new Set(meta.keys())
    if (intersection == null) {
      intersection = Array.from(matchIds)
    } else {
      intersection = intersection.filter((id) => matchIds.has(id))
    }
  }

  const candidates = intersection ?? []
  const includedIds = includeOthers
    ? candidates
    : await filterExactSetMatchIds(candidates, ids)

  const focusMeta =
    focusWrestlerId != null
      ? (metas[ids.indexOf(focusWrestlerId)] ?? metas[0])
      : metas[0]

  const byMatch = new Map<string, WrestlerMatchMeta>()
  for (const id of includedIds) {
    const meta = focusMeta.get(id)
    if (meta) byMatch.set(id, meta)
  }

  return { sortedIds: sortMatchIdsDesc(byMatch), byMatch }
}

export const getRivalry = createServerFn({ method: 'GET' })
  .validator((input: { ids: Array<string> }) => ({
    ids: normalizeRivalryIds(input.ids),
  }))
  .handler(async ({ data }): Promise<RivalryDetail | null> => {
    if (data.ids.length < 2) return null

    const supabase = getCachedSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('wrestlers')
      .select('id, name')
      .in('id', data.ids)
    if (error) throw new Error(error.message)

    if (rows.length !== data.ids.length) return null

    const byId = new Map(rows.map((r) => [r.id, r]))
    const headshots = await resolveWrestlerHeadshotUrls(data.ids)

    return {
      ids: data.ids,
      wrestlers: data.ids.map((id) => {
        const row = byId.get(id)!
        return {
          id: row.id,
          name: row.name,
          imageUrl: headshots.get(id) ?? null,
        }
      }),
    }
  })

export const listRivalryMatches = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      ids: Array<string>
      page?: number
      focusWrestlerId?: string
      includeOthers?: boolean
    }) => {
      const ids = normalizeRivalryIds(input.ids)
      const focus = input.focusWrestlerId?.trim() || undefined
      if (focus && !ids.includes(focus)) {
        throw new Error('focusWrestlerId must be one of the rivalry wrestlers')
      }
      return {
        ids,
        page: Math.max(1, input.page ?? 1),
        focusWrestlerId: focus,
        includeOthers: input.includeOthers ?? false,
      }
    },
  )
  .handler(async ({ data }): Promise<RivalryMatchPage> => {
    if (data.ids.length < 2) {
      return {
        matches: [],
        total: 0,
        page: data.page,
        pageSize: MATCH_PAGE_SIZE,
      }
    }

    const { sortedIds, byMatch } = await intersectRivalryMatchMeta(
      data.ids,
      data.focusWrestlerId,
      data.includeOthers,
    )
    const total = sortedIds.length
    const from = (data.page - 1) * MATCH_PAGE_SIZE
    const pageIds = sortedIds.slice(from, from + MATCH_PAGE_SIZE)
    const hydrated = await hydrateWrestlerMatches(pageIds, byMatch)

    const matches: Array<RivalryMatch> = data.focusWrestlerId
      ? hydrated
      : hydrated.map((m) => ({ ...m, outcome: null }))

    return {
      matches,
      total,
      page: data.page,
      pageSize: MATCH_PAGE_SIZE,
    }
  })

export const rivalryQueryOptions = (ids: ReadonlyArray<string>) => {
  const normalized = normalizeRivalryIds(ids)
  return queryOptions({
    queryKey: ['rivalry', normalized],
    queryFn: () => getRivalry({ data: { ids: normalized } }),
  })
}

export const rivalryMatchesQueryOptions = (
  ids: ReadonlyArray<string>,
  page: number,
  focusWrestlerId?: string,
  includeOthers = false,
) => {
  const normalized = normalizeRivalryIds(ids)
  const focus = focusWrestlerId?.trim() || undefined
  return queryOptions({
    queryKey: [
      'rivalry',
      normalized,
      'matches',
      { page, focus: focus ?? null, includeOthers },
    ],
    queryFn: () =>
      listRivalryMatches({
        data: {
          ids: normalized,
          page,
          focusWrestlerId: focus,
          includeOthers,
        },
      }),
  })
}
