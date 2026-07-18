import { describe, expect, test } from 'vitest'
import {
  cleanFinishNote,
  winnerColumnLabel,
} from '#/components/spoiler-winner'

describe('spoiler-winner', () => {
  test('cleanFinishNote strips trailing score brackets', () => {
    expect(cleanFinishNote('No Contest [2:2]')).toBe('No Contest')
    expect(cleanFinishNote('Time Limit Draw')).toBe('Time Limit Draw')
  })

  test('winnerColumnLabel prefers winners, then finish note, then No Contest', () => {
    expect(
      winnerColumnLabel({
        winners: ['Roman Reigns'],
        finishNote: 'No Contest',
        result: 'decisive',
      }),
    ).toBe('Roman Reigns')

    expect(
      winnerColumnLabel({
        winners: [],
        finishNote: 'Time Limit Draw [0:0]',
        result: 'no_decision',
      }),
    ).toBe('Time Limit Draw')

    expect(
      winnerColumnLabel({
        winners: [],
        finishNote: null,
        result: 'no_decision',
      }),
    ).toBe('No Contest')

    expect(
      winnerColumnLabel({
        winners: [],
        finishNote: null,
        result: null,
      }),
    ).toBe('—')
  })
})
