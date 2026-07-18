import { Star } from 'lucide-react'
import { cn } from '#/lib/utils'

function clampRating(rating: number): number {
  return Math.min(10, Math.max(0, rating))
}

function StarGlyph({
  fillFraction,
  sizeClass,
}: {
  fillFraction: number
  sizeClass: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, fillFraction)) * 100)
  const isPartial = pct > 0 && pct < 100
  return (
    <span className={cn('relative inline-block', sizeClass)}>
      <Star
        className={cn(
          sizeClass,
          'fill-muted text-muted-foreground/40',
          // Partial stars show only the filled sliver — no grey remainder.
          isPartial && 'invisible',
        )}
        aria-hidden
      />
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        <Star
          className={cn(sizeClass, 'fill-amber-500 text-amber-500')}
          aria-hidden
        />
      </span>
    </span>
  )
}

export function StarRatingDisplay({
  rating,
  count,
  maxStars = 5,
  mode = 'full',
  className,
}: {
  rating: number | null
  count?: number
  maxStars?: number
  mode?: 'full' | 'compact'
  className?: string
}) {
  if (mode === 'compact') {
    return (
      <span
        className={cn('inline-flex items-center gap-1 tabular-nums', className)}
      >
        <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden />
        <span className="font-medium">
          {rating != null ? rating.toFixed(2) : '—'}
        </span>
        {count != null && (
          <span className="text-muted-foreground">
            ({count} {count === 1 ? 'review' : 'reviews'})
          </span>
        )}
      </span>
    )
  }

  const value = rating != null ? clampRating(rating) : 0
  const starsToShow = Math.max(maxStars, Math.ceil(value) || maxStars)

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      aria-label={
        rating != null
          ? `${rating.toFixed(2)} stars${count != null ? `, ${count} reviews` : ''}`
          : 'No rating'
      }
    >
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: starsToShow }, (_, i) => {
          const fill = Math.min(1, Math.max(0, value - i))
          return <StarGlyph key={i} fillFraction={fill} sizeClass="size-4" />
        })}
      </span>
      <span className="text-sm font-medium tabular-nums">
        {rating != null ? rating.toFixed(2) : '—'}
      </span>
      {count != null && (
        <span className="text-sm text-muted-foreground">
          · {count} {count === 1 ? 'review' : 'reviews'}
        </span>
      )}
    </span>
  )
}
