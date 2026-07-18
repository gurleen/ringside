import { Badge } from '#/components/ui/badge'
import type { PredictionStatus } from '#/lib/predictions-shared'
import { PREDICTION_POINTS_WINNER } from '#/lib/predictions-shared'
import { cn } from '#/lib/utils'

const LABELS: Record<PredictionStatus, string> = {
  pending: 'Pending',
  correct: `Correct +${PREDICTION_POINTS_WINNER}`,
  incorrect: 'Miss',
  void: 'Void',
}

export function PredictionStatusBadge({
  status,
  className,
}: {
  status: PredictionStatus | string
  className?: string
}) {
  const key = (
    status in LABELS ? status : 'pending'
  ) as PredictionStatus

  return (
    <Badge
      variant={
        key === 'correct'
          ? 'default'
          : key === 'incorrect' || key === 'void'
            ? 'secondary'
            : 'outline'
      }
      className={cn(
        key === 'correct' && 'bg-emerald-600 text-white hover:bg-emerald-600',
        className,
      )}
    >
      {LABELS[key]}
    </Badge>
  )
}
