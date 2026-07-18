import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  predictionParticipants,
  userPredictionsQueryOptions,
} from '#/lib/predictions'
import { PredictionStatusBadge } from '#/components/prediction-status-badge'
import { formatEventDate } from '#/routes/events/index'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

interface PredictionsSearch {
  page: number
}

export const Route = createFileRoute('/predictions/')({
  validateSearch: (search: Record<string, unknown>): PredictionsSearch => ({
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

    const options = userPredictionsQueryOptions(user.id, deps.page)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
      return
    }
    await context.queryClient.ensureQueryData(options)
  },
  component: MyPredictionsPage,
  pendingComponent: MyPredictionsSkeleton,
  pendingMs: 100,
})

function MyPredictionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  )
}

function MyPredictionsPage() {
  const { user } = Route.useRouteContext()
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const userId = user!.id

  useSuspenseQuery(userPredictionsQueryOptions(userId, page))
  const { data: predictionsPage, isFetching } = useQuery({
    ...userPredictionsQueryOptions(userId, page),
    placeholderData: keepPreviousData,
  })

  const totalPages = predictionsPage
    ? Math.max(1, Math.ceil(predictionsPage.total / predictionsPage.pageSize))
    : 1

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My Predictions</h1>
        <p className="text-muted-foreground">
          Your match winner picks. Editable until each event starts.
        </p>
      </div>

      {!predictionsPage || predictionsPage.predictions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t made any predictions yet. Open an upcoming event and
          pick a winner on each match.
        </p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-70' : ''}`}>
          {predictionsPage.predictions.map((prediction) => {
            const pickNames = predictionParticipants(prediction)
              .map((p) => p.name)
              .join(' & ')
            return (
              <Card key={prediction.id} className="gap-2 py-4">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                  <div className="space-y-1">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: prediction.event_id }}
                      className="font-semibold hover:underline"
                    >
                      {prediction.eventName ?? 'Event'}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatEventDate(prediction.eventDate, null)}
                      {prediction.matchType
                        ? ` · ${prediction.matchType}`
                        : prediction.matchIndex != null
                          ? ` · Match ${prediction.matchIndex}`
                          : null}
                    </p>
                  </div>
                  <PredictionStatusBadge status={prediction.status} />
                </CardHeader>
                <CardContent className="text-sm">
                  <p>
                    Pick:{' '}
                    <span className="font-medium">
                      {pickNames || `Side ${prediction.predicted_side_index + 1}`}
                    </span>
                  </p>
                  {!prediction.predictionsLocked && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Still open — edit or clear on the event page.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {predictionsPage && predictionsPage.total > predictionsPage.pageSize && (
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
