import {
  cagematchTextToIso,
  isDarkMatch,
  isTitleOutcomeMatch,
  type TitleOutcomeSide,
} from '#/lib/matches-shared'

export function isTitleDefenseRow(input: {
  result: string | null
  titleChange: boolean | null
  matchType: string | null
  sides: ReadonlyArray<TitleOutcomeSide>
}): boolean {
  if (input.result !== 'decisive') return false
  if (input.titleChange) return false
  if (isDarkMatch(input.matchType)) return false
  return isTitleOutcomeMatch({
    titleName: 'title',
    titleChange: false,
    matchType: input.matchType,
    sides: input.sides,
  })
}

/** Whether an event's ISO date falls within a reign window (inclusive). */
export function eventDateInReign(
  eventDateIso: string | null | undefined,
  reignStartIso: string | null,
  reignEndIso: string | null,
): boolean {
  if (!eventDateIso || !reignStartIso) return false
  if (eventDateIso < reignStartIso) return false
  if (reignEndIso && eventDateIso > reignEndIso) return false
  return true
}

export function reignDateBounds(fromDate: string | null, toDate: string | null) {
  return {
    startIso: cagematchTextToIso(fromDate),
    endIso: cagematchTextToIso(toDate),
  }
}

export function formatChampionReignLabel(reignNumber: number | null): string | null {
  if (reignNumber == null) return null
  if (reignNumber === 1) return 'First reign'
  const mod100 = reignNumber % 100
  if (mod100 >= 11 && mod100 <= 13) return `${reignNumber}th reign`
  switch (reignNumber % 10) {
    case 1:
      return `${reignNumber}st reign`
    case 2:
      return `${reignNumber}nd reign`
    case 3:
      return `${reignNumber}rd reign`
    default:
      return `${reignNumber}th reign`
  }
}

export function formatDefenseCountLabel(
  count: number,
  active: boolean,
): string {
  if (count === 0) {
    return active
      ? 'No successful defenses yet'
      : 'No successful defenses on record'
  }
  const noun = count === 1 ? 'defense' : 'defenses'
  return active
    ? `${count} successful ${noun} so far`
    : `${count} successful ${noun}`
}
