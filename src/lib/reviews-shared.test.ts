import { describe, expect, test } from 'bun:test'
import { isMatchReviewable } from '#/lib/reviews-shared'

describe('isMatchReviewable', () => {
  test('accepts a decisive match with winner and loser sides', () => {
    expect(isMatchReviewable('decisive', ['winner', 'loser'])).toBe(true)
  })

  test('rejects unresolved and unknown matches', () => {
    expect(isMatchReviewable('no_decision', ['side', 'side'])).toBe(false)
    expect(isMatchReviewable('unknown', ['side', 'side'])).toBe(false)
  })

  test('requires both result sides even when marked decisive', () => {
    expect(isMatchReviewable('decisive', ['winner', 'side'])).toBe(false)
    expect(isMatchReviewable('decisive', ['loser', 'side'])).toBe(false)
  })
})
