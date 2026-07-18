import { describe, expect, test } from 'vitest'
import {
  normalizeRivalryIds,
  parseRivalryKey,
  rivalryIdsFromMatchSides,
  rivalryKeyFromIds,
} from '#/lib/rivalries-shared'

describe('rivalries-shared', () => {
  test('rivalryKeyFromIds sorts and dedupes', () => {
    expect(rivalryKeyFromIds(['9451', '11207', '9451'])).toBe('9451-11207')
  })

  test('parseRivalryKey accepts canonical keys only', () => {
    expect(parseRivalryKey('9451-11207')).toEqual(['9451', '11207'])
    expect(parseRivalryKey('11207-9451')).toBeNull()
    expect(parseRivalryKey('9451')).toBeNull()
  })

  test('normalizeRivalryIds sorts numerically', () => {
    expect(normalizeRivalryIds(['100', '20', '3'])).toEqual(['3', '20', '100'])
  })

  test('rivalryIdsFromMatchSides gates on side count and linkable wrestlers', () => {
    expect(
      rivalryIdsFromMatchSides([
        { participants: [{ role: 'wrestler', id: '1' }] },
      ]),
    ).toBeNull()

    expect(
      rivalryIdsFromMatchSides([
        { participants: [{ role: 'wrestler', id: '2' }] },
        { participants: [{ role: 'wrestler', id: '1' }] },
      ]),
    ).toEqual(['1', '2'])

    expect(
      rivalryIdsFromMatchSides([
        { participants: [{ role: 'wrestler', id: '1' }] },
        { participants: [{ role: 'wrestler', id: null }] },
      ]),
    ).toBeNull()

    expect(
      rivalryIdsFromMatchSides([
        { participants: [{ role: 'wrestler', id: '1' }] },
        { participants: [{ role: 'valet', id: '9' }] },
        { participants: [{ role: 'wrestler', id: '2' }] },
      ]),
    ).toEqual(['1', '2'])
  })
})
