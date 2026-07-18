import { useEffect, useId, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

function snapQuarter(value: number): number {
  return Math.round(value * 4) / 4
}

function clampRating(value: number): number {
  return Math.min(10, Math.max(0.25, snapQuarter(value)))
}

function StarButton({
  index,
  value,
  disabled,
  onPick,
}: {
  index: number
  value: number | null
  disabled?: boolean
  onPick: (rating: number) => void
}) {
  const fill = value == null ? 0 : Math.min(1, Math.max(0, value - index))
  const isPartial = fill > 0 && fill < 1

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    let fraction = 0.25
    if (ratio >= 0.875) fraction = 1
    else if (ratio >= 0.625) fraction = 0.75
    else if (ratio >= 0.375) fraction = 0.5
    else fraction = 0.25
    onPick(clampRating(index + fraction))
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className="relative inline-flex size-7 disabled:opacity-50"
      aria-hidden
      tabIndex={-1}
    >
      <Star
        className={cn(
          'size-7 fill-muted text-muted-foreground/40',
          // Partial stars show only the filled sliver — no grey remainder.
          isPartial && 'invisible',
        )}
      />
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${Math.round(fill * 100)}%` }}
      >
        <Star className="size-7 fill-amber-500 text-amber-500" />
      </span>
    </button>
  )
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  className?: string
}) {
  const labelId = useId()
  const [expanded, setExpanded] = useState(() => value != null && value > 5)

  useEffect(() => {
    if (value != null && value > 5) setExpanded(true)
  }, [value])

  const starCount = expanded || (value != null && value > 5) ? 10 : 5

  function adjust(delta: number) {
    if (value == null) {
      onChange(delta > 0 ? 0.25 : null)
      return
    }
    const next = value + delta
    if (next < 0.25) {
      onChange(null)
      return
    }
    onChange(clampRating(next))
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="slider"
        aria-labelledby={labelId}
        aria-valuemin={0.25}
        aria-valuemax={10}
        aria-valuenow={value ?? undefined}
        aria-valuetext={
          value != null ? `${value.toFixed(2)} stars` : 'No rating'
        }
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            adjust(0.25)
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            adjust(-0.25)
          } else if (event.key === 'Home') {
            event.preventDefault()
            onChange(0.25)
          } else if (event.key === 'End') {
            event.preventDefault()
            onChange(10)
            setExpanded(true)
          } else if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault()
            onChange(null)
          }
        }}
        className="inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
      >
        <span id={labelId} className="sr-only">
          Star rating
        </span>
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: starCount }, (_, i) => (
            <StarButton
              key={i}
              index={i}
              value={value}
              disabled={disabled}
              onPick={(rating) => {
                onChange(rating)
                if (rating > 5) setExpanded(true)
              }}
            />
          ))}
        </span>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {value != null ? value.toFixed(2) : 'No rating'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {!expanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setExpanded(true)}
          >
            Show stars past 5
          </Button>
        )}
        {value != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Clear rating
          </Button>
        )}
      </div>
    </div>
  )
}
