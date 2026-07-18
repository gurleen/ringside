import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Pencil, Trash2 } from 'lucide-react'
import { ReviewForm } from '#/components/review-form'
import { StarRatingDisplay } from '#/components/star-rating-display'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { deleteMatchReview } from '#/lib/reviews'
import type { MatchReviewWithAuthor, ViewingMethod } from '#/lib/reviews'
import type { AuthUser } from '#/lib/auth'
import { formatEventDate } from '#/routes/events/index'

const VIEWING_LABELS: Record<ViewingMethod, string> = {
  in_person: 'In person',
  live: 'Live',
  later: 'Later',
}

function formatReviewDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ReviewCard({
  review,
  currentUser,
  showMatchContext = false,
  matchType,
  eventId,
  eventName,
  eventDate,
}: {
  review: MatchReviewWithAuthor
  currentUser: AuthUser | null
  showMatchContext?: boolean
  matchType?: string | null
  eventId?: string | null
  eventName?: string | null
  eventDate?: string | null
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOwner = currentUser?.id === review.user_id

  const deleteMutation = useMutation({
    mutationFn: () => deleteMatchReview({ data: { reviewId: review.id } }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not delete review.')
    },
  })

  if (editing) {
    return (
      <ReviewForm
        matchId={review.match_id}
        review={review}
        eventDate={eventDate}
        onSuccess={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const viewingMethod = review.viewing_method as ViewingMethod | null

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {review.username ?? 'Unknown user'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatReviewDate(review.created_at)}
            </span>
          </div>
          {showMatchContext && (
            <div className="text-sm text-muted-foreground">
              {eventId ? (
                <Link
                  to="/events/$eventId"
                  params={{ eventId }}
                  className="hover:underline"
                >
                  {eventName ?? 'Untitled event'}
                </Link>
              ) : (
                (eventName ?? 'Untitled event')
              )}
              {eventDate ? ` · ${formatEventDate(eventDate, null)}` : null}
              {matchType ? ` · ${matchType}` : null}
              {' · '}
              <Link
                to="/matches/$matchId"
                params={{ matchId: review.match_id }}
                search={{ page: 1 }}
                className="hover:underline"
              >
                View match reviews
              </Link>
            </div>
          )}
          {review.rating != null && (
            <StarRatingDisplay
              rating={review.rating}
              mode="full"
              maxStars={5}
            />
          )}
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit review"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete review"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (
                  window.confirm('Delete this review? This cannot be undone.')
                ) {
                  deleteMutation.mutate()
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {review.is_first_watch && (
            <Badge variant="secondary">First watch</Badge>
          )}
          {viewingMethod && (
            <Badge variant="outline">{VIEWING_LABELS[viewingMethod]}</Badge>
          )}
          {review.watched_at && (
            <Badge variant="outline">
              Watched {formatEventDate(review.watched_at, null)}
            </Badge>
          )}
        </div>
        {review.review_text && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {review.review_text}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
