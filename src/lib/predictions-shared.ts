// Client-safe prediction constants/types shared between predictions.ts and
// predictions.server.ts. Keep runtime values out of predictions.server.ts if
// client code needs them — TanStack Start's import protection blocks .server.*
// imports from the client bundle.

import { isMatchReviewable } from '#/lib/reviews-shared'

export const PREDICTION_POINTS_WINNER = 1

export type PredictionStatus = 'pending' | 'correct' | 'incorrect' | 'void'

export type PredictedParticipant = {
  id: string | null
  name: string
}

/** A match is predictable when it does not yet have a decisive result and has ≥2 sides. */
export function isMatchPredictable(
  result: string | null,
  sideRoles: Iterable<string>,
): boolean {
  const roles = Array.from(sideRoles)
  if (roles.length < 2) return false
  return !isMatchReviewable(result, roles)
}

function participantKey(p: { id?: string | null; name?: string | null }): string | null {
  const id = p.id?.trim()
  if (id) return `id:${id}`
  const name = p.name?.trim().toLowerCase()
  if (name) return `name:${name}`
  return null
}

/** Stable sorted fingerprint of a side's wrestler participants. */
export function participantsFingerprint(
  participants: Iterable<{ id?: string | null; name?: string | null; role?: string | null }>,
): Array<string> {
  const keys = new Set<string>()
  for (const p of participants) {
    if (p.role != null && p.role !== 'wrestler') continue
    const key = participantKey(p)
    if (key) keys.add(key)
  }
  return Array.from(keys).sort()
}

export function sidesMatch(
  a: Iterable<{ id?: string | null; name?: string | null; role?: string | null }>,
  b: Iterable<{ id?: string | null; name?: string | null; role?: string | null }>,
): boolean {
  const fa = participantsFingerprint(a)
  const fb = participantsFingerprint(b)
  if (fa.length === 0 || fb.length === 0) return false
  if (fa.length !== fb.length) return false
  return fa.every((k, i) => k === fb[i])
}

export function snapshotParticipants(
  participants: Iterable<{
    id?: string | null
    name?: string | null
    role?: string | null
  }>,
): Array<PredictedParticipant> {
  const byKey = new Map<string, PredictedParticipant>()
  for (const p of participants) {
    if (p.role != null && p.role !== 'wrestler') continue
    const name = p.name?.trim()
    if (!name) continue
    const id = p.id?.trim() || null
    const key = participantKey({ id, name })
    if (!key || byKey.has(key)) continue
    byKey.set(key, { id, name })
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const ka = participantKey(a) ?? ''
    const kb = participantKey(b) ?? ''
    return ka.localeCompare(kb)
  })
}

type SideLike = {
  sideIndex: number
  participants: Array<{
    id?: string | null
    name?: string | null
    role?: string | null
  }>
}

type PredictionLike = {
  predicted_side_index: number
  predicted_participants: unknown
}

/** Compact side label for pickers and share cards. */
export function sideLabel(side: SideLike): string {
  const wrestlers = side.participants.filter((p) => p.role === 'wrestler')
  const names = (wrestlers.length > 0 ? wrestlers : side.participants)
    .map((p) => p.name?.trim())
    .filter((name): name is string => !!name)
  if (names.length === 0) return `Side ${side.sideIndex + 1}`
  if (names.length <= 2) return names.join(' & ')
  return `${names[0]} & ${names.length - 1} others`
}

export function predictionSideParticipants(prediction: PredictionLike) {
  return Array.isArray(prediction.predicted_participants)
    ? (
        prediction.predicted_participants as Array<{
          id?: string | null
          name?: string | null
        }>
      ).map((p) => ({ ...p, role: 'wrestler' as const }))
    : []
}

export function resolvePickedSide<T extends SideLike>(
  sides: Array<T>,
  prediction: PredictionLike,
): T | undefined {
  return (
    sides.find((s) => s.sideIndex === prediction.predicted_side_index) ??
    sides.find((side) =>
      sidesMatch(side.participants, predictionSideParticipants(prediction)),
    )
  )
}

/** Label for a stored pick, falling back to the participant snapshot. */
export function pickLabel(
  sides: Array<SideLike>,
  prediction: PredictionLike,
): string {
  const picked = resolvePickedSide(sides, prediction)
  if (picked) return sideLabel(picked)
  const names = predictionSideParticipants(prediction)
    .map((p) => p.name?.trim())
    .filter((name): name is string => !!name)
  if (names.length > 0) {
    if (names.length <= 2) return names.join(' & ')
    return `${names[0]} & ${names.length - 1} others`
  }
  return `Side ${prediction.predicted_side_index + 1}`
}

type MatchForShare = {
  id: string
  sides: { length: number }
  isPredictable: boolean
  hasResult: boolean
}

/**
 * Matches that belong on a prediction share card: real contests (≥2 sides)
 * that are still open or already decided. Includes dark matches.
 */
export function isPredictionShareEligibleMatch(match: MatchForShare): boolean {
  return match.sides.length >= 2 && (match.isPredictable || match.hasResult)
}

export function predictionShareEligibleMatches<T extends MatchForShare>(
  matches: ReadonlyArray<T>,
): Array<T> {
  return matches.filter(isPredictionShareEligibleMatch)
}

/** True when every eligible match has a prediction row for this user. */
export function hasCompletePredictionSlate(
  matches: ReadonlyArray<MatchForShare>,
  predictions: Readonly<Record<string, unknown>>,
): boolean {
  const eligible = predictionShareEligibleMatches(matches)
  return (
    eligible.length > 0 && eligible.every((m) => predictions[m.id] != null)
  )
}
