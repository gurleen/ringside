import { describe, expect, test } from 'bun:test'
import {
  isMatchPredictable,
  participantsFingerprint,
  sidesMatch,
  snapshotParticipants,
} from '#/lib/predictions-shared'

describe('isMatchPredictable', () => {
  test('accepts unresolved multi-side matches', () => {
    expect(isMatchPredictable('no_decision', ['side', 'side'])).toBe(true)
    expect(isMatchPredictable('unknown', ['side', 'side'])).toBe(true)
  })

  test('rejects decisive matches with winner and loser', () => {
    expect(isMatchPredictable('decisive', ['winner', 'loser'])).toBe(false)
  })

  test('requires at least two sides', () => {
    expect(isMatchPredictable('no_decision', ['side'])).toBe(false)
    expect(isMatchPredictable('no_decision', [])).toBe(false)
  })
})

describe('participant fingerprints', () => {
  test('prefers ids and ignores non-wrestlers', () => {
    expect(
      participantsFingerprint([
        { role: 'team', id: 't1', name: 'Team' },
        { role: 'wrestler', id: '2', name: 'B' },
        { role: 'wrestler', id: '1', name: 'A' },
      ]),
    ).toEqual(['id:1', 'id:2'])
  })

  test('falls back to lowercased names', () => {
    expect(
      participantsFingerprint([
        { role: 'wrestler', id: null, name: ' Orange Cassidy ' },
      ]),
    ).toEqual(['name:orange cassidy'])
  })

  test('sidesMatch compares fingerprints', () => {
    expect(
      sidesMatch(
        [
          { role: 'wrestler', id: '1', name: 'A' },
          { role: 'wrestler', id: '2', name: 'B' },
        ],
        [
          { role: 'wrestler', id: '2', name: 'B' },
          { role: 'wrestler', id: '1', name: 'A' },
        ],
      ),
    ).toBe(true)
    expect(
      sidesMatch(
        [{ role: 'wrestler', id: '1', name: 'A' }],
        [{ role: 'wrestler', id: '2', name: 'B' }],
      ),
    ).toBe(false)
  })

  test('snapshotParticipants sorts and drops teams/valets', () => {
    expect(
      snapshotParticipants([
        { role: 'valet', id: 'v', name: 'Manager' },
        { role: 'wrestler', id: '2', name: 'B' },
        { role: 'wrestler', id: '1', name: 'A' },
      ]),
    ).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ])
  })
})
