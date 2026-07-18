import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { userReviewsQueryOptions } from '#/lib/reviews'
import { ReviewCard } from '#/components/review-card'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'

interface ReviewsSearch {
  page: number
}

export const Route = createFileRoute('/reviews/')({
  validateSearch: (search: Record<string, unknown>): ReviewsSearch => ({
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login', search: { error: undefined } })
    }
  },
  loader: async ({ context, deps, cause }) => {
    const user = context.user
    if (!user) return

    const options = userReviewsQueryOptions(user.id, deps.page)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
      return
    }
    await context.queryClient.ensureQueryData(options)
  },
  component: MyReviewsPage,
  pendingComponent: MyReviewsSkeleton,
  pendingMs: 100,
})

function MyReviewsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  )
}

function MyReviewsPage() {
  const { user } = Route.useRouteContext()
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // beforeLoad guarantees a signed-in user.
  const userId = user!.id

  useSuspenseQuery(userReviewsQueryOptions(userId, page))
  const { data: reviewsPage, isFetching } = useQuery({
    ...userReviewsQueryOptions(userId, page),
    placeholderData: keepPreviousData,
  })

  const totalPages = reviewsPage
    ? Math.max(1, Math.ceil(reviewsPage.total / reviewsPage.pageSize))
    : 1

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My Reviews</h1>
        <p className="text-muted-foreground">
          Reviews you&apos;ve written across the match database.
        </p>
      </div>

      {!reviewsPage || reviewsPage.reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t reviewed any matches yet. Open an event and click
          Reviews on a match to get started.
        </p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-70' : ''}`}>
          {reviewsPage.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUser={user}
              showMatchContext
              matchType={review.matchType}
              eventId={review.eventId}
              eventName={review.eventName}
              eventDate={review.eventDate}
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
    </div>
  )
}
