import { describe, expect, it } from 'vitest'
import { unspoiledMatchCard } from '#/lib/spoilers-shared'
import type { MatchCardItem } from '#/lib/events'

function sampleMatch(
  overrides: Partial<MatchCardItem> = {},
): MatchCardItem {
  return {
    id: 'e1-1',
    index: 1,
    matchType: 'Singles Match',
    titleId: 't1',
    titleName: 'World Championship',
    titleLinkable: true,
    titleImageUrl: null,
    titleChange: true,
    isTitleOutcome: true,
    titleDefenseNumber: null,
    winnerReignNumber: 3,
    duration: '12:34',
    result: 'decisive',
    hasResult: true,
    isPredictable: false,
    finishNote: 'Pinfall',
    rating: null,
    votes: null,
    notes: ['Title match'],
    sides: [
      {
        id: 's-w',
        sideIndex: 1,
        role: 'winner',
        isChampion: false,
        participants: [
          {
            role: 'wrestler',
            id: 'w1',
            name: 'Alice',
            linkable: true,
            imageUrl: null,
          },
        ],
      },
      {
        id: 's-l',
        sideIndex: 0,
        role: 'loser',
        isChampion: true,
        participants: [
          {
            role: 'wrestler',
            id: 'w2',
            name: 'Bob',
            linkable: true,
            imageUrl: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('unspoiledMatchCard', () => {
  it('leaves unresolved matches unchanged', () => {
    const match = sampleMatch({
      hasResult: false,
      result: 'no_decision',
      titleChange: false,
      finishNote: null,
      duration: null,
      notes: [],
      sides: [
        {
          id: 's0',
          sideIndex: 0,
          role: 'side',
          isChampion: true,
          participants: [],
        },
        {
          id: 's1',
          sideIndex: 1,
          role: 'side',
          isChampion: false,
          participants: [],
        },
      ],
    })
    expect(unspoiledMatchCard(match)).toBe(match)
  })

  it('strips result cues and sorts sides by sideIndex', () => {
    const match = sampleMatch()
    const next = unspoiledMatchCard(match)

    expect(next).not.toBe(match)
    expect(next.hasResult).toBe(false)
    expect(next.result).toBe('no_decision')
    expect(next.titleChange).toBe(false)
    expect(next.isTitleOutcome).toBe(false)
    expect(next.winnerReignNumber).toBeNull()
    expect(next.titleDefenseNumber).toBeNull()
    expect(next.finishNote).toBeNull()
    expect(next.duration).toBeNull()
    expect(next.notes).toEqual([])
    expect(next.sides.map((s) => s.role)).toEqual(['side', 'side'])
    expect(next.sides.map((s) => s.sideIndex)).toEqual([0, 1])
    expect(next.sides[0]?.participants[0]?.name).toBe('Bob')
    expect(next.sides[1]?.participants[0]?.name).toBe('Alice')
    // Pre-match cues kept
    expect(next.titleName).toBe('World Championship')
    expect(next.sides[0]?.isChampion).toBe(true)
  })
})
