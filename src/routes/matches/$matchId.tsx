import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { matchSummaryQueryOptions } from '#/lib/events'
import type { MatchSummary } from '#/lib/events'
import { matchReviewsQueryOptions } from '#/lib/reviews'
import { MatchResultText } from '#/components/match-result-text'
import { ReviewCard } from '#/components/review-card'
import { ReviewForm } from '#/components/review-form'
import { StarRatingDisplay } from '#/components/star-rating-display'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { formatEventDate } from '#/routes/events/index'

interface MatchReviewsSearch {
  page: number
}

export const Route = createFileRoute('/matches/$matchId')({
  validateSearch: (search: Record<string, unknown>): MatchReviewsSearch => ({
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, params, deps, cause }) => {
    const summary = await context.queryClient.ensureQueryData(
      matchSummaryQueryOptions(params.matchId),
    )
    if (!summary) throw notFound()

    const reviewsOptions = matchReviewsQueryOptions(params.matchId, deps.page)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(reviewsOptions)
      return
    }
    await context.queryClient.ensureQueryData(reviewsOptions)
  },
  component: MatchReviewsPage,
  pendingComponent: MatchReviewsSkeleton,
  pendingMs: 100,
  notFoundComponent: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">Match not found.</p>
      <Link
        to="/events"
        search={{
          q: '',
          page: 1,
          future: false,
          promotion: '',
          sort: 'date_desc',
        }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to events
      </Link>
    </div>
  ),
})

function MatchReviewsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-40" />
      <Card className="gap-3 py-4">
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-5 w-72" />
        </CardContent>
      </Card>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function sideNames(
  match: MatchSummary,
  role: 'winner' | 'loser' | 'side',
): Array<string> {
  return match.sides
    .filter((s) => s.role === role)
    .flatMap((s) =>
      s.participants
        .filter((p) => p.role === 'wrestler' || p.role === 'team')
        .map((p) => p.name)
        .filter((name): name is string => !!name),
    )
}

function MatchReviewsPage() {
  const { matchId } = Route.useParams()
  const { page } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate({ from: Route.fullPath })

  const { data: match } = useSuspenseQuery(matchSummaryQueryOptions(matchId))
  const summary = match as MatchSummary

  const { data: reviewsPage, isFetching } = useQuery({
    ...matchReviewsQueryOptions(matchId, page),
    placeholderData: keepPreviousData,
  })

  const winners = sideNames(summary, 'winner')
  const losers = sideNames(summary, 'loser')
  const sides = sideNames(summary, 'side')

  const totalPages = reviewsPage
    ? Math.max(1, Math.ceil(reviewsPage.total / reviewsPage.pageSize))
    : 1

  return (
    <div className="space-y-6">
      <Link
        to="/events/$eventId"
        params={{ eventId: summary.event.id }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to {summary.event.name ?? 'event'}
      </Link>

      <Card className="gap-3 py-4">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {summary.event.name ?? 'Untitled event'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[
                  summary.event.promotionLabel,
                  formatEventDate(summary.event.event_date, summary.event.date),
                  summary.matchType,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {summary.duration && (
              <div className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3.5" />
                  {summary.duration}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <MatchResultText winners={winners} losers={losers} sides={sides} />
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Ringside reviews</h2>
          <StarRatingDisplay
            rating={reviewsPage?.summary.average ?? null}
            count={reviewsPage?.summary.count ?? 0}
            mode="full"
            maxStars={5}
          />
        </div>

        {user ? (
          <ReviewForm
            matchId={matchId}
            eventDate={summary.event.event_date}
          />
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              search={{ error: undefined }}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Log in
            </Link>{' '}
            to write a review of this match.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">
          All reviews
          {reviewsPage ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {reviewsPage.total}
            </span>
          ) : null}
        </h3>

        {!reviewsPage || reviewsPage.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet. Be the first to weigh in.
          </p>
        ) : (
          <div className={`space-y-3 ${isFetching ? 'opacity-70' : ''}`}>
            {reviewsPage.reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUser={user}
                eventDate={summary.event.event_date}
              />
            ))}
          </div>
        )}

        {reviewsPage && reviewsPage.total > reviewsPage.pageSize && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() =>
                void navigate({
                  search: { page: page - 1 },
                  resetScroll: false,
                })
              }
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() =>
                void navigate({
                  search: { page: page + 1 },
                  resetScroll: false,
                })
              }
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
