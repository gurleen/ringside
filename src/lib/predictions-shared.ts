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
