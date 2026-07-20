import { describe, expect, test } from 'bun:test'
import {
  cagematchTextToIso,
  countPriorWrestlerTitleReigns,
  isDarkMatch,
  isHouseShow,
  isTitleContendershipMatch,
  isTitleOutcomeMatch,
  matchHasChampion,
  resolveWrestlerTitleReignNumber,
} from '#/lib/matches-shared'

describe('isDarkMatch', () => {
  test('detects match types that start with Dark', () => {
    expect(isDarkMatch('Dark Match')).toBe(true)
    expect(isDarkMatch('Dark Tag Team Match')).toBe(true)
    expect(isDarkMatch('  Dark  Match')).toBe(true)
  })

  test('does not flag unrelated darkness wording', () => {
    expect(isDarkMatch('World Of Darkness Match')).toBe(false)
    expect(isDarkMatch('Match')).toBe(false)
    expect(isDarkMatch(null)).toBe(false)
  })
})

describe('isHouseShow', () => {
  test('detects House Show event types', () => {
    expect(isHouseShow('House Show')).toBe(true)
    expect(isHouseShow(' house show ')).toBe(true)
  })

  test('does not flag unrelated house wording', () => {
    expect(isHouseShow('In Your House')).toBe(false)
    expect(isHouseShow('PPV')).toBe(false)
    expect(isHouseShow(null)).toBe(false)
  })
})

describe('isTitleContendershipMatch', () => {
  test('detects common contendership naming patterns', () => {
    expect(isTitleContendershipMatch('#1 Contendership Battle Royal')).toBe(
      true,
    )
    expect(
      isTitleContendershipMatch(
        '/ WWE Universal Title #1 Contendership Donnybrook Match',
      ),
    ).toBe(true)
    expect(
      isTitleContendershipMatch(
        '/ AEW Continental Title Eliminator Match',
      ),
    ).toBe(true)
    expect(isTitleContendershipMatch('Forbidden Door Qualifying Match')).toBe(
      true,
    )
    expect(isTitleContendershipMatch('Proving Ground Match')).toBe(true)
  })

  test('does not flag actual title defenses', () => {
    expect(isTitleContendershipMatch('Match')).toBe(false)
    expect(isTitleContendershipMatch('Elimination Chamber Match')).toBe(false)
    expect(isTitleContendershipMatch('/ WWE Title Match')).toBe(false)
  })
})

describe('isTitleOutcomeMatch', () => {
  test('treats champion retention as a title outcome', () => {
    expect(
      isTitleOutcomeMatch({
        titleName: 'World Title',
        titleChange: false,
        matchType: 'Match',
        sides: [{ isChampion: true }, { isChampion: false }],
      }),
    ).toBe(true)
  })

  test('treats vacant-title wins as a title outcome', () => {
    expect(
      isTitleOutcomeMatch({
        titleName: 'World Title',
        titleChange: true,
        matchType: 'Match (vakant)',
        sides: [{ isChampion: false }, { isChampion: false }],
      }),
    ).toBe(true)
  })

  test('excludes contendership bouts even when a title is attached', () => {
    expect(
      isTitleOutcomeMatch({
        titleName: 'World Title',
        titleChange: false,
        matchType: '#1 Contendership Fatal Four Way Match',
        sides: [{ isChampion: false }, { isChampion: false }],
      }),
    ).toBe(false)
  })

  test('excludes tournament rounds without a defending champion', () => {
    expect(
      isTitleOutcomeMatch({
        titleName: 'World Title',
        titleChange: false,
        matchType: 'Tournament Semi Final Match',
        sides: [{ isChampion: false }, { isChampion: false }],
      }),
    ).toBe(false)
  })
})

describe('matchHasChampion', () => {
  test('requires an explicit champion flag', () => {
    expect(matchHasChampion([{ isChampion: true }])).toBe(true)
    expect(matchHasChampion([{ isChampion: false }, { isChampion: null }])).toBe(
      false,
    )
  })
})

describe('resolveWrestlerTitleReignNumber', () => {
  const reigns = [
    {
      title_id: 't1',
      from_date: '01.01.2020',
      champions: [{ wrestler_id: 'w1', wrestler_name: 'Alice', reign_count: null }],
    },
    {
      title_id: 't1',
      from_date: '01.06.2022',
      champions: [{ wrestler_id: 'w1', wrestler_name: 'Alice', reign_count: 2 }],
    },
  ] as const

  test('uses explicit reign_count when Cagematch populated it', () => {
    expect(
      resolveWrestlerTitleReignNumber(
        reigns,
        't1',
        '2022-06-01',
        new Set(['w1']),
        new Set(['alice']),
        2,
      ),
    ).toBe(2)
  })

  test('infers a first reign when reign_count is omitted', () => {
    expect(
      resolveWrestlerTitleReignNumber(
        reigns,
        't1',
        '2020-01-01',
        new Set(['w1']),
        new Set(['alice']),
        null,
      ),
    ).toBe(1)
  })

  test('infers repeat reigns from prior title history', () => {
    expect(
      resolveWrestlerTitleReignNumber(
        reigns,
        't1',
        '2023-01-01',
        new Set(['w1']),
        new Set(['alice']),
        null,
      ),
    ).toBe(3)
  })
})

describe('cagematchTextToIso', () => {
  test('parses complete dates and rejects partial ones', () => {
    expect(cagematchTextToIso('27.05.2023')).toBe('2023-05-27')
    expect(cagematchTextToIso('xx.xx.2020')).toBeNull()
  })
})

describe('countPriorWrestlerTitleReigns', () => {
  test('counts only earlier reigns for the same wrestler and title', () => {
    const reigns = [
      {
        title_id: 't1',
        from_date: '01.01.2020',
        champions: [{ wrestler_id: 'w1', wrestler_name: 'Alice' }],
      },
      {
        title_id: 't1',
        from_date: '01.01.2021',
        champions: [{ wrestler_id: 'w2', wrestler_name: 'Bob' }],
      },
    ]
    expect(
      countPriorWrestlerTitleReigns(
        reigns,
        't1',
        '2022-01-01',
        new Set(['w1']),
        new Set(['alice']),
      ),
    ).toBe(1)
  })
})
