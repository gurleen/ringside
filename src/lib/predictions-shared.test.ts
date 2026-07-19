import { describe, expect, test } from 'bun:test'
import {
  hasCompletePredictionSlate,
  isMatchPredictable,
  isPredictionShareEligibleMatch,
  participantsFingerprint,
  pickLabel,
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

describe('prediction share eligibility', () => {
  test('includes open and decisive multi-side matches', () => {
    expect(
      isPredictionShareEligibleMatch({
        id: 'a',
        sides: { length: 2 },
        isPredictable: true,
        hasResult: false,
      }),
    ).toBe(true)
    expect(
      isPredictionShareEligibleMatch({
        id: 'b',
        sides: { length: 2 },
        isPredictable: false,
        hasResult: true,
      }),
    ).toBe(true)
  })

  test('excludes single-side and non-contest matches', () => {
    expect(
      isPredictionShareEligibleMatch({
        id: 'c',
        sides: { length: 1 },
        isPredictable: false,
        hasResult: false,
      }),
    ).toBe(false)
    expect(
      isPredictionShareEligibleMatch({
        id: 'd',
        sides: { length: 2 },
        isPredictable: false,
        hasResult: false,
      }),
    ).toBe(false)
  })

  test('hasCompletePredictionSlate requires a pick for every eligible match', () => {
    const matches = [
      {
        id: 'm1',
        sides: { length: 2 },
        isPredictable: true,
        hasResult: false,
      },
      {
        id: 'm2',
        sides: { length: 2 },
        isPredictable: false,
        hasResult: true,
      },
      {
        id: 'skip',
        sides: { length: 1 },
        isPredictable: false,
        hasResult: false,
      },
    ]
    expect(hasCompletePredictionSlate(matches, { m1: {}, m2: {} })).toBe(true)
    expect(hasCompletePredictionSlate(matches, { m1: {} })).toBe(false)
    expect(hasCompletePredictionSlate(matches, {})).toBe(false)
  })
})

describe('pickLabel', () => {
  const sides = [
    {
      sideIndex: 0,
      participants: [
        { role: 'wrestler', id: '1', name: 'Rhea Ripley' },
        { role: 'wrestler', id: '2', name: 'Liv Morgan' },
        { role: 'wrestler', id: '3', name: 'Raquel Rodriguez' },
      ],
    },
    {
      sideIndex: 1,
      participants: [{ role: 'wrestler', id: '4', name: 'Iyo Sky' }],
    },
  ]

  test('uses the current side when the index still matches', () => {
    expect(
      pickLabel(sides, {
        predicted_side_index: 1,
        predicted_participants: [{ id: '4', name: 'Iyo Sky' }],
      }),
    ).toBe('Iyo Sky')
  })

  test('compacts multi-person sides', () => {
    expect(
      pickLabel(sides, {
        predicted_side_index: 0,
        predicted_participants: [],
      }),
    ).toBe('Rhea Ripley & 2 others')
  })

  test('falls back to the participant snapshot when the card changed', () => {
    expect(
      pickLabel(sides, {
        predicted_side_index: 9,
        predicted_participants: [
          { id: '99', name: 'Old Wrestler' },
          { id: '98', name: 'Other Wrestler' },
        ],
      }),
    ).toBe('Old Wrestler & Other Wrestler')
  })
})
