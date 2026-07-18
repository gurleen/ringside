import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { leaderboardQueryOptions } from '#/lib/predictions'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

interface LeaderboardSearch {
  page: number
}

export const Route = createFileRoute('/leaderboard/')({
  validateSearch: (search: Record<string, unknown>): LeaderboardSearch => ({
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, deps, cause }) => {
    const options = leaderboardQueryOptions(deps.page)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
      return
    }
    await context.queryClient.ensureQueryData(options)
  },
  component: LeaderboardPage,
  pendingComponent: LeaderboardSkeleton,
  pendingMs: 100,
})

function LeaderboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function LeaderboardPage() {
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  useSuspenseQuery(leaderboardQueryOptions(page))
  const { data, isFetching } = useQuery({
    ...leaderboardQueryOptions(page),
    placeholderData: keepPreviousData,
  })

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          All-time prediction points. Correct winner picks are worth 1 point.
        </p>
      </div>

      {!data || data.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scored predictions yet. Make picks on upcoming events to get on
          the board.
        </p>
      ) : (
        <div className={isFetching ? 'opacity-70' : ''}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Correct</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Incorrect
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {entry.rank}
                  </TableCell>
                  <TableCell className="font-medium">{entry.username}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {entry.points}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.correct}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {entry.incorrect}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.total > data.pageSize && (
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
