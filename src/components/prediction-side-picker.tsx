import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  deleteMatchPrediction,
  upsertMatchPrediction,
} from '#/lib/predictions'
import type { MatchPredictionRow } from '#/lib/predictions'
import type { MatchSide } from '#/lib/events'
import {
  pickLabel,
  predictionSideParticipants,
  sideLabel,
  sidesMatch,
} from '#/lib/predictions-shared'
import { PredictionStatusBadge } from '#/components/prediction-status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export function PredictionSidePicker({
  eventId,
  matchId,
  sides,
  prediction,
  locked,
  signedIn,
}: {
  eventId: string
  matchId: string
  sides: Array<MatchSide>
  prediction: MatchPredictionRow | undefined
  locked: boolean
  signedIn: boolean
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const upsert = useMutation({
    mutationFn: async (predictedSideIndex: number) => {
      const row = await upsertMatchPrediction({
        data: { matchId, eventId, predictedSideIndex },
      })
      await queryClient.invalidateQueries({ queryKey: ['predictions'] })
      return row
    },
    onSuccess: () => {
      setError(null)
      setChanging(false)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not save prediction.')
    },
  })

  const remove = useMutation({
    mutationFn: async (predictionId: string) => {
      const result = await deleteMatchPrediction({ data: { predictionId } })
      await queryClient.invalidateQueries({ queryKey: ['predictions'] })
      return result
    },
    onSuccess: () => {
      setError(null)
      setChanging(false)
      setClearOpen(false)
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Could not clear prediction.',
      )
    },
  })

  const pending = upsert.isPending || remove.isPending
  const selectedLabel = prediction ? pickLabel(sides, prediction) : null

  if (!signedIn) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        <Link
          to="/login"
          search={{ error: undefined }}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Log in
        </Link>{' '}
        to predict a winner
        {locked ? ' (locked)' : ''}.
      </p>
    )
  }

  if (locked) {
    if (!prediction) {
      return (
        <p className="text-center text-xs text-muted-foreground">
          Predictions locked — no pick for this match.
        </p>
      )
    }
    return (
      <div className="flex flex-col items-center gap-1.5 text-center">
        <PredictionStatusBadge status={prediction.status} />
        <p className="text-sm font-medium">
          You selected <span className="text-foreground">{selectedLabel}</span>
        </p>
      </div>
    )
  }

  if (pending) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-1 text-center"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {remove.isPending ? 'Clearing pick…' : 'Saving pick…'}
        </p>
      </div>
    )
  }

  if (prediction && !changing) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your prediction
          </p>
          <p className="mt-1 text-base font-semibold">
            You selected {selectedLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null)
              setChanging(true)
            }}
          >
            Change pick
          </Button>
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" size="sm" variant="ghost">
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this prediction?</AlertDialogTitle>
                <AlertDialogDescription>
                  You selected {selectedLabel}. This removes your pick for this
                  match. You can choose again until the event locks.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep pick</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    remove.mutate(prediction.id)
                  }}
                >
                  Clear pick
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {error ? (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-medium text-muted-foreground">
        {prediction ? 'Change your pick' : 'Predict the winner'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {sides.map((side) => {
          const selected =
            prediction?.predicted_side_index === side.sideIndex ||
            (prediction != null &&
              sidesMatch(
                side.participants,
                predictionSideParticipants(prediction),
              ))
          return (
            <Button
              key={side.id}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={pending}
              className={cn(
                'max-w-48 truncate',
                selected && 'ring-2 ring-offset-1',
              )}
              onClick={() => upsert.mutate(side.sideIndex)}
            >
              {sideLabel(side)}
            </Button>
          )
        })}
        {prediction && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setChanging(false)}
          >
            Cancel
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
