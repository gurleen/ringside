/** Client-safe rivalry key helpers (no server imports). */

export function normalizeRivalryIds(
  ids: ReadonlyArray<string>,
): Array<string> {
  const unique = new Set<string>()
  for (const id of ids) {
    const trimmed = id.trim()
    if (trimmed) unique.add(trimmed)
  }
  return Array.from(unique).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )
}

/** Sorted unique wrestler ids joined by `-` (Cagematch ids are numeric strings). */
export function rivalryKeyFromIds(ids: ReadonlyArray<string>): string {
  return normalizeRivalryIds(ids).join('-')
}

/** Parse a rivalry key into sorted unique ids, or null if invalid. */
export function parseRivalryKey(key: string): Array<string> | null {
  const trimmed = key.trim()
  if (!trimmed) return null
  const parts = trimmed.split('-').map((p) => p.trim()).filter(Boolean)
  const ids = normalizeRivalryIds(parts)
  if (ids.length < 2) return null
  // Reject non-canonical keys (unsorted / duplicates) so URLs stay stable.
  if (rivalryKeyFromIds(ids) !== trimmed) return null
  return ids
}

type SideLike = {
  participants: Array<{ role: string; id: string | null }>
}

/**
 * Rivalry ids for a match card: 2–4 sides, every wrestler participant
 * linkable. Returns sorted unique ids, or null when ineligible.
 */
export function rivalryIdsFromMatchSides(
  sides: ReadonlyArray<SideLike>,
): Array<string> | null {
  if (sides.length < 2 || sides.length > 4) return null

  const ids: Array<string> = []
  for (const side of sides) {
    for (const p of side.participants) {
      if (p.role !== 'wrestler') continue
      if (!p.id?.trim()) return null
      ids.push(p.id.trim())
    }
  }

  const normalized = normalizeRivalryIds(ids)
  if (normalized.length < 2) return null
  return normalized
}
