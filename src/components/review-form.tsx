import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StarRatingInput } from '#/components/star-rating-input'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  createMatchReview,
  updateMatchReview,
  VIEWING_METHODS,
} from '#/lib/reviews'
import type { MatchReviewRow, ViewingMethod } from '#/lib/reviews'

const VIEWING_LABELS: Record<ViewingMethod, string> = {
  in_person: 'In person',
  live: 'Live (TV / stream)',
  later: 'Later (on demand)',
}

export type ReviewFormValues = {
  rating: number | null
  reviewText: string
  isFirstWatch: boolean | null
  watchedAt: string
  viewingMethod: ViewingMethod | null
}

function valuesFromReview(review?: MatchReviewRow | null): ReviewFormValues {
  return {
    rating: review?.rating ?? null,
    reviewText: review?.review_text ?? '',
    isFirstWatch: review?.is_first_watch ?? null,
    watchedAt: review?.watched_at ?? '',
    viewingMethod: (review?.viewing_method as ViewingMethod | null) ?? null,
  }
}

function isLiveOrInPerson(method: ViewingMethod | null): boolean {
  return method === 'live' || method === 'in_person'
}

export function ReviewForm({
  matchId,
  review,
  eventDate,
  onSuccess,
  onCancel,
}: {
  matchId: string
  review?: MatchReviewRow | null
  /** ISO date (`YYYY-MM-DD`) of the match's event; used when watching live/in person. */
  eventDate?: string | null
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ReviewFormValues>(() =>
    valuesFromReview(review),
  )
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!review
  const lockWatchFields = isLiveOrInPerson(values.viewingMethod)

  function applyViewingMethod(next: ViewingMethod | null) {
    setValues((v) => {
      if (!isLiveOrInPerson(next)) {
        return { ...v, viewingMethod: next }
      }
      return {
        ...v,
        viewingMethod: next,
        isFirstWatch: true,
        watchedAt: eventDate ?? v.watchedAt,
      }
    })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (review) {
        return updateMatchReview({
          data: {
            reviewId: review.id,
            rating: values.rating,
            reviewText: values.reviewText || null,
            isFirstWatch: values.isFirstWatch,
            watchedAt: values.watchedAt || null,
            viewingMethod: values.viewingMethod,
          },
        })
      }
      return createMatchReview({
        data: {
          matchId,
          rating: values.rating,
          reviewText: values.reviewText || null,
          isFirstWatch: values.isFirstWatch,
          watchedAt: values.watchedAt || null,
          viewingMethod: values.viewingMethod,
        },
      })
    },
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      if (!isEdit) {
        setValues(valuesFromReview(null))
      }
      onSuccess?.()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not save review.')
    },
  })

  return (
    <form
      className="space-y-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        mutation.mutate()
      }}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {isEdit ? 'Edit review' : 'Write a review'}
        </h3>
        <p className="text-xs text-muted-foreground">
          Rate in quarter-star steps (0.25–10). A rating and/or text is
          required.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label>Rating</Label>
        <StarRatingInput
          value={values.rating}
          disabled={mutation.isPending}
          onChange={(rating) => setValues((v) => ({ ...v, rating }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`review-text-${matchId}`}>Review</Label>
        <Textarea
          id={`review-text-${matchId}`}
          value={values.reviewText}
          disabled={mutation.isPending}
          maxLength={10000}
          rows={4}
          placeholder="What stood out?"
          onChange={(event) =>
            setValues((v) => ({ ...v, reviewText: event.target.value }))
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id={`first-watch-${matchId}`}
            checked={values.isFirstWatch === true}
            disabled={mutation.isPending || lockWatchFields}
            onCheckedChange={(checked) =>
              setValues((v) => ({
                ...v,
                isFirstWatch: checked ? true : null,
              }))
            }
          />
          <Label htmlFor={`first-watch-${matchId}`}>First time watching</Label>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`watched-at-${matchId}`}>Watched on</Label>
          <Input
            id={`watched-at-${matchId}`}
            type="date"
            className="w-auto"
            value={values.watchedAt}
            disabled={mutation.isPending || lockWatchFields}
            onChange={(event) =>
              setValues((v) => ({ ...v, watchedAt: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>How did you watch?</Label>
          <Select
            value={values.viewingMethod ?? 'none'}
            disabled={mutation.isPending}
            onValueChange={(next) =>
              applyViewingMethod(
                next === 'none' ? null : (next as ViewingMethod),
              )
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {VIEWING_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {VIEWING_LABELS[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Saving…'
            : isEdit
              ? 'Save changes'
              : 'Post review'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
