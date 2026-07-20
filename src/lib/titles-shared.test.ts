import { describe, expect, test } from 'bun:test'
import {
  eventDateInReign,
  formatChampionReignLabel,
  formatDefenseCountLabel,
  isTitleDefenseRow,
} from '#/lib/titles-shared'

describe('isTitleDefenseRow', () => {
  test('accepts retained title matches with a champion', () => {
    expect(
      isTitleDefenseRow({
        result: 'decisive',
        titleChange: false,
        matchType: 'Match',
        sides: [{ isChampion: true }, { isChampion: false }],
      }),
    ).toBe(true)
  })

  test('rejects contendership and title changes', () => {
    expect(
      isTitleDefenseRow({
        result: 'decisive',
        titleChange: false,
        matchType: '#1 Contendership Match',
        sides: [{ isChampion: false }],
      }),
    ).toBe(false)
    expect(
      isTitleDefenseRow({
        result: 'decisive',
        titleChange: true,
        matchType: 'Match',
        sides: [{ isChampion: false }],
      }),
    ).toBe(false)
  })

  test('rejects dark matches', () => {
    expect(
      isTitleDefenseRow({
        result: 'decisive',
        titleChange: false,
        matchType: 'Dark Match',
        sides: [{ isChampion: true }, { isChampion: false }],
      }),
    ).toBe(false)
  })
})

describe('eventDateInReign', () => {
  test('checks inclusive reign bounds', () => {
    expect(
      eventDateInReign('2022-06-01', '2022-01-01', '2022-12-31'),
    ).toBe(true)
    expect(
      eventDateInReign('2021-12-31', '2022-01-01', '2022-12-31'),
    ).toBe(false)
    expect(eventDateInReign('2023-01-01', '2022-01-01', null)).toBe(true)
  })
})

describe('formatChampionReignLabel', () => {
  test('labels first and repeat reigns', () => {
    expect(formatChampionReignLabel(1)).toBe('First reign')
    expect(formatChampionReignLabel(2)).toBe('2nd reign')
    expect(formatChampionReignLabel(11)).toBe('11th reign')
  })
})

describe('formatDefenseCountLabel', () => {
  test('describes active and completed reigns', () => {
    expect(formatDefenseCountLabel(0, true)).toBe('No successful defenses yet')
    expect(formatDefenseCountLabel(3, true)).toBe('3 successful defenses so far')
    expect(formatDefenseCountLabel(1, false)).toBe('1 successful defense')
  })
})
