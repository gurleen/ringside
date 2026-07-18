// Client-safe review constants/types shared between reviews.ts (client +
// server) and reviews.server.ts (server-only). Keep runtime values out of
// reviews.server.ts if client code needs them — TanStack Start's import
// protection blocks .server.* imports from the client bundle.

export type ViewingMethod = 'in_person' | 'live' | 'later'

export const VIEWING_METHODS: Array<ViewingMethod> = [
  'in_person',
  'live',
  'later',
]

export function isMatchReviewable(
  result: string | null,
  sideRoles: Iterable<string>,
): boolean {
  if (result !== 'decisive') return false

  let hasWinner = false
  let hasLoser = false
  for (const role of sideRoles) {
    if (role === 'winner') hasWinner = true
    if (role === 'loser') hasLoser = true
  }
  return hasWinner && hasLoser
}
