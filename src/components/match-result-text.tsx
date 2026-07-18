import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

/** Collapse a side to "N others" (with a full-name tooltip) at this count. */
export const MATCH_SIDE_COLLAPSE_AT = 5

function joinNames(names: Array<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

function OthersTooltip({ names }: { names: Array<string> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-help underline decoration-dotted underline-offset-2"
        >
          {names.length} others
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{joinNames(names)}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Renders a match side's names. Sides of 5+ collapse to "N others" (tooltip
 * lists everyone). When `anchorFirst` is set, the first name stays visible —
 * "X & N others" — so even multi-person cards don't read as "7 others def.
 * 7 others".
 */
export function MatchSideNames({
  names,
  empty = '—',
  anchorFirst = false,
}: {
  names: Array<string>
  empty?: string
  anchorFirst?: boolean
}) {
  if (names.length === 0) return <>{empty}</>
  if (names.length < MATCH_SIDE_COLLAPSE_AT) {
    return <>{joinNames(names)}</>
  }

  if (anchorFirst) {
    const [first, ...rest] = names
    return (
      <>
        {first} & <OthersTooltip names={rest} />
      </>
    )
  }

  return <OthersTooltip names={names} />
}

/**
 * "Winners def. Losers", collapsing any side of 5+ solo names. The winners
 * side keeps its first name when collapsed; the losers side becomes
 * "N others" with a tooltip of everyone. Falls back to a "vs" line when
 * there is no winner/loser.
 */
export function MatchResultText({
  winners,
  losers,
  sides = [],
}: {
  winners: Array<string>
  losers: Array<string>
  sides?: Array<string>
}) {
  if (winners.length > 0 || losers.length > 0) {
    return (
      <>
        <MatchSideNames names={winners} anchorFirst />
        {' def. '}
        <MatchSideNames names={losers} />
      </>
    )
  }

  if (sides.length === 0) return null

  if (sides.length < MATCH_SIDE_COLLAPSE_AT) {
    return <>{sides.join(' vs ')}</>
  }

  const [first, ...rest] = sides
  return (
    <>
      {first} vs <OthersTooltip names={rest} />
    </>
  )
}
