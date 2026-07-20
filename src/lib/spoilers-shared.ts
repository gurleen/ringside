import type { MatchCardItem, MatchSide } from '#/lib/events'

/**
 * Strip result cues from a resolved match card so it renders like a
 * scheduled bout (vs connector, no winner/loser, no title-change callouts,
 * no duration / finish / notes that leak the outcome).
 */
export function unspoiledMatchCard(match: MatchCardItem): MatchCardItem {
  if (!match.hasResult) return match

  return {
    ...match,
    hasResult: false,
    titleChange: false,
    isTitleOutcome: false,
    titleDefenseNumber: null,
    winnerReignNumber: null,
    finishNote: null,
    duration: null,
    notes: [],
    result: 'no_decision',
    sides: [...match.sides]
      .sort((a, b) => a.sideIndex - b.sideIndex)
      .map(
        (s): MatchSide => ({
          ...s,
          role: 'side',
        }),
      ),
  }
}
