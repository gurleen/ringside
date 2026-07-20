import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  ATTENDANCE_LABELS,
  isAttendance,
  userShowsQueryOptions,
} from '#/lib/shows'
import { EventAttendanceControl } from '#/components/event-attendance-control'
import { formatEventDate } from '#/routes/events/index'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

interface ShowsSearch {
  page: number
}

export const Route = createFileRoute('/shows/')({
  validateSearch: (search: Record<string, unknown>): ShowsSearch => ({
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

    const options = userShowsQueryOptions(user.id, deps.page)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
      return
    }
    await context.queryClient.ensureQueryData(options)
  },
  component: MyShowsPage,
  pendingComponent: MyShowsSkeleton,
  pendingMs: 100,
})

function MyShowsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-44" />
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

function MyShowsPage() {
  const { user } = Route.useRouteContext()
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const userId = user!.id

  useSuspenseQuery(userShowsQueryOptions(userId, page))
  const { data: showsPage, isFetching } = useQuery({
    ...userShowsQueryOptions(userId, page),
    placeholderData: keepPreviousData,
  })

  const totalPages = showsPage
    ? Math.max(1, Math.ceil(showsPage.total / showsPage.pageSize))
    : 1

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My Shows</h1>
        <p className="text-muted-foreground">
          Events you attended in person or watched on TV.
        </p>
      </div>

      {!showsPage || showsPage.shows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t tracked any shows yet. Open an event and mark how
          you watched it.
        </p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-70' : ''}`}>
          {showsPage.shows.map((show) => {
            const label = isAttendance(show.attendance)
              ? ATTENDANCE_LABELS[show.attendance]
              : show.attendance
            return (
              <Card key={show.id} className="gap-2 py-4">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                  <div className="space-y-1">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: show.event_id }}
                      className="font-semibold hover:underline"
                    >
                      {show.eventName ?? 'Event'}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatEventDate(show.eventDate, show.eventDateText)}
                      {show.promotionLabel ? ` · ${show.promotionLabel}` : null}
                    </p>
                  </div>
                  <Badge variant="secondary">{label}</Badge>
                </CardHeader>
                <CardContent>
                  <EventAttendanceControl
                    eventId={show.event_id}
                    attendance={show}
                    signedIn
                    compact
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showsPage && showsPage.total > showsPage.pageSize && (
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
