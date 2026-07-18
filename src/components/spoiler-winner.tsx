import { cn } from '#/lib/utils'

function joinWinnerNames(names: Array<string>): string {
  if (names.length <= 1) return names[0] ?? '—'
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/** Strip trailing score brackets from finish notes ("No Contest [2:2]" → "No Contest"). */
export function cleanFinishNote(note: string): string {
  const cleaned = note.replace(/\s*\[[^\]]*\]\s*$/g, '').trim()
  return cleaned || note.trim()
}

/**
 * Label for the rivalry Winner column: winner names, else a finish note
 * (No Contest / Draw / …), else a generic non-decisive label, else "—".
 */
export function winnerColumnLabel({
  winners,
  finishNote,
  result,
}: {
  winners: Array<string>
  finishNote?: string | null
  result?: string | null
}): string {
  if (winners.length > 0) return joinWinnerNames(winners)
  const note = finishNote?.trim()
  if (note) return cleanFinishNote(note)
  if (result === 'no_decision' || result === 'unknown') return 'No Contest'
  return '—'
}

/**
 * Fixed-length stand-in shown while spoilers are off. Using the same string
 * for every row keeps the blurred width identical, so the text length can't
 * leak which name (or finish type) is underneath.
 */
const HIDDEN_PLACEHOLDER = 'Hidden result'

/** Winner / finish label; blurred when spoilers are off and the cell has a result. */
export function SpoilerWinner({
  winners,
  finishNote,
  result,
  spoilers,
  className,
}: {
  winners: Array<string>
  finishNote?: string | null
  result?: string | null
  spoilers: boolean
  className?: string
}) {
  const label = winnerColumnLabel({ winners, finishNote, result })
  const isEmpty = label === '—'
  const hidden = !isEmpty && !spoilers

  return (
    <span
      className={cn(
        'text-sm',
        isEmpty && 'text-muted-foreground',
        hidden && 'select-none whitespace-nowrap blur-sm',
        className,
      )}
      aria-label={hidden ? 'Result hidden' : undefined}
      title={hidden ? 'Turn on Spoilers to reveal' : undefined}
    >
      {hidden ? HIDDEN_PLACEHOLDER : label}
    </span>
  )
}
