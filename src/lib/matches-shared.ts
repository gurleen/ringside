export interface TitleOutcomeSide {
  isChampion?: boolean | null
}

/**
 * Cagematch match types where a title is on the line symbolically (e.g.
 * "#1 Contendership …", title eliminators) but the bout does not decide the
 * championship.
 */
export function isTitleContendershipMatch(matchType: string | null): boolean {
  if (!matchType) return false
  return (
    /\bcontend(er)?ship\b/i.test(matchType) ||
    /\bcontenders?\b/i.test(matchType) ||
    /\beliminator\b/i.test(matchType) ||
    /\bqualifier\b/i.test(matchType) ||
    /\bqualifying\b/i.test(matchType) ||
    /\bproving ground\b/i.test(matchType)
  )
}

/** Matches whose type starts with "Dark" (e.g. "Dark Match", "Dark Tag Team Match"). */
export function isDarkMatch(matchType: string | null): boolean {
  return matchType != null && /^dark\b/i.test(matchType.trim())
}

export function matchHasChampion(
  sides: ReadonlyArray<TitleOutcomeSide>,
): boolean {
  return sides.some((s) => s.isChampion === true)
}

export interface TitleReignChampionRef {
  wrestler_id?: string | null
  wrestler_name?: string | null
  reign_count?: number | null
}

export interface TitleReignRef {
  title_id: string
  from_date: string | null
  champions: ReadonlyArray<TitleReignChampionRef>
}

/** Parse Cagematch `DD.MM.YYYY` text dates; returns null when partial/invalid. */
export function cagematchTextToIso(date: string | null | undefined): string | null {
  if (!date) return null
  const parts = date.split('.')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  if (
    !/^\d{2}$/.test(day) ||
    !/^\d{2}$/.test(month) ||
    !/^\d{4}$/.test(year)
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

export function championMatchesWinners(
  champion: TitleReignChampionRef,
  winnerIds: ReadonlySet<string>,
  winnerNames: ReadonlySet<string>,
): boolean {
  return (
    (!!champion.wrestler_id && winnerIds.has(champion.wrestler_id)) ||
    (!!champion.wrestler_name &&
      winnerNames.has(champion.wrestler_name.toLowerCase()))
  )
}

/** Reigns the same wrestler(s) held on this title strictly before `beforeDateIso`. */
export function countPriorWrestlerTitleReigns(
  reigns: ReadonlyArray<TitleReignRef>,
  titleId: string,
  beforeDateIso: string,
  winnerIds: ReadonlySet<string>,
  winnerNames: ReadonlySet<string>,
): number {
  let prior = 0
  for (const reign of reigns) {
    if (reign.title_id !== titleId) continue
    const reignIso = cagematchTextToIso(reign.from_date)
    if (!reignIso || reignIso >= beforeDateIso) continue
    const held = reign.champions.some((c) =>
      championMatchesWinners(c, winnerIds, winnerNames),
    )
    if (held) prior++
  }
  return prior
}

/**
 * Wrestler-specific reign number for a title change. Cagematch usually omits
 * `reign_count` on a first reign (it starts at 2 for repeat reigns), so when
 * that field is missing we infer from prior reign rows for the same wrestler.
 */
export function resolveWrestlerTitleReignNumber(
  reigns: ReadonlyArray<TitleReignRef>,
  titleId: string,
  eventDateIso: string,
  winnerIds: ReadonlySet<string>,
  winnerNames: ReadonlySet<string>,
  explicitReignCount: number | null | undefined,
): number | null {
  if (winnerIds.size === 0 && winnerNames.size === 0) return null
  if (explicitReignCount != null) return explicitReignCount
  const prior = countPriorWrestlerTitleReigns(
    reigns,
    titleId,
    eventDateIso,
    winnerIds,
    winnerNames,
  )
  return prior + 1
}

/**
 * True when a resolved bout actually decided the title (defense or change),
 * not merely involved the belt (contendership, tournament rounds, etc.).
 */
export function isTitleOutcomeMatch(input: {
  titleId?: string | null
  titleName?: string | null
  titleChange?: boolean | null
  matchType?: string | null
  sides: ReadonlyArray<TitleOutcomeSide>
}): boolean {
  if (!input.titleId && !input.titleName) return false
  if (isTitleContendershipMatch(input.matchType ?? null)) return false
  if (input.titleChange) return true
  return matchHasChampion(input.sides)
}
