import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import {
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  parseRivalryKey,
  rivalryMatchesQueryOptions,
  rivalryQueryOptions,
} from '#/lib/rivalries'
import type { RivalryMatch, RivalryWrestler } from '#/lib/rivalries'
import { SpoilerWinner } from '#/components/spoiler-winner'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatEventDate } from '#/routes/events/index'
import { cn } from '#/lib/utils'

interface RivalrySearch {
  page: number
}

export const Route = createFileRoute('/rivalries/$rivalryKey')({
  validateSearch: (search: Record<string, unknown>): RivalrySearch => ({
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, params, deps, cause }) => {
    const ids = parseRivalryKey(params.rivalryKey)
    if (!ids) throw notFound()

    const rivalry = await context.queryClient.ensureQueryData(
      rivalryQueryOptions(ids),
    )
    if (!rivalry) throw notFound()

    const matchesOptions = rivalryMatchesQueryOptions(ids, deps.page)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(matchesOptions)
      return
    }
    await context.queryClient.ensureQueryData(matchesOptions)
  },
  component: RivalryPage,
  pendingComponent: RivalrySkeleton,
  pendingMs: 100,
  notFoundComponent: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">Rivalry not found.</p>
      <Link
        to="/wrestlers"
        search={{ q: '', page: 1 }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to wrestlers
      </Link>
    </div>
  ),
})

const numberFmt = new Intl.NumberFormat('en-US')

function RivalrySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-40" />
      <Card className="gap-0 py-4">
        <CardContent className="flex flex-wrap items-center justify-center gap-4 px-4">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="size-12 rounded-full" />
        </CardContent>
      </Card>
      <div className="rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="m-4 h-10 w-auto" />
        ))}
      </div>
    </div>
  )
}

function RivalryPage() {
  const { rivalryKey } = Route.useParams()
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [spoilers, setSpoilers] = useState(false)
  const [includeOthers, setIncludeOthers] = useState(false)
  const ids = parseRivalryKey(rivalryKey)!

  const { data: rivalry } = useSuspenseQuery(rivalryQueryOptions(ids))
  const detail = rivalry!
  const { data, isPlaceholderData, isFetching } = useQuery({
    ...rivalryMatchesQueryOptions(ids, page, undefined, includeOthers),
    // Keep previous rows only while paginating. Switching includeOthers drops
    // placeholder data so the table shows skeleton rows instead of a stale list.
    placeholderData: (previousData, previousQuery) => {
      const prevKey = previousQuery?.queryKey[3] as
        | { includeOthers?: boolean }
        | undefined
      if (prevKey?.includeOthers === includeOthers) return previousData
      return undefined
    },
  })
  // No data yet (including after an includeOthers toggle with no cache).
  const showTableSkeleton = !data
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1

  return (
    <div className="space-y-6">
      <Link
        to="/wrestlers"
        search={{ q: '', page: 1 }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to wrestlers
      </Link>

      <Card className="gap-0 py-4">
        <CardContent className="space-y-3 px-4 text-center">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            All-time rivalry
          </p>
          <RivalryTitle wrestlers={detail.wrestlers} />
          {data ? (
            <p className="text-sm text-muted-foreground">
              {numberFmt.format(data.total)}{' '}
              {data.total === 1 ? 'match' : 'matches'}
            </p>
          ) : (
            <Skeleton className="mx-auto h-5 w-24" />
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="rivalry-include-others"
              checked={includeOthers}
              disabled={isFetching}
              onCheckedChange={(checked) => {
                setIncludeOthers(checked)
                if (page !== 1) void navigate({ search: { page: 1 } })
              }}
            />
            <Label htmlFor="rivalry-include-others" className="text-sm">
              Include matches with others
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="rivalry-spoilers"
              checked={spoilers}
              onCheckedChange={setSpoilers}
            />
            <Label htmlFor="rivalry-spoilers" className="text-sm">
              Spoilers
            </Label>
          </div>
        </div>

        <div
          className={cn(
            'rounded-lg border transition-opacity',
            isPlaceholderData && 'opacity-60',
          )}
          aria-busy={showTableSkeleton || isPlaceholderData}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden w-32 sm:table-cell">Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Winner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showTableSkeleton || !data ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20 sm:hidden" />
                        <Skeleton className="h-5 w-48 max-w-full" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-28" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data.matches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No matches on record for this rivalry.
                  </TableCell>
                </TableRow>
              ) : (
                data.matches.map((match) => (
                  <RivalryMatchRow
                    key={match.id}
                    match={match}
                    spoilers={spoilers}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {numberFmt.format(totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                void navigate({
                  search: { page: page - 1 },
                })
              }
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() =>
                void navigate({
                  search: { page: page + 1 },
                })
              }
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RivalryTitle({ wrestlers }: { wrestlers: Array<RivalryWrestler> }) {
  if (wrestlers.length === 2) {
    const [a, b] = wrestlers
    return (
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <WrestlerChip wrestler={a} />
        <span className="text-sm font-medium text-muted-foreground">vs</span>
        <WrestlerChip wrestler={b} />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {wrestlers.map((w, i) => (
        <span key={w.id} className="inline-flex items-center gap-3">
          {i > 0 && (
            <span className="text-muted-foreground">
              {i === wrestlers.length - 1 ? '&' : ','}
            </span>
          )}
          <WrestlerChip wrestler={w} />
        </span>
      ))}
    </div>
  )
}

function WrestlerChip({ wrestler }: { wrestler: RivalryWrestler }) {
  const initials = wrestler.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <Link
      to="/wrestlers/$wrestlerId"
      params={{ wrestlerId: wrestler.id }}
      search={{ tab: 'profile', page: 1 }}
      className="inline-flex items-center gap-2 rounded-md transition-colors hover:text-primary"
    >
      <Avatar size="lg">
        {wrestler.imageUrl && (
          <AvatarImage src={wrestler.imageUrl} alt={wrestler.name} />
        )}
        <AvatarFallback>{initials || '?'}</AvatarFallback>
      </Avatar>
      <span className="text-xl font-semibold tracking-tight sm:text-2xl">
        {wrestler.name}
      </span>
    </Link>
  )
}

function RivalryMatchRow({
  match,
  spoilers,
}: {
  match: RivalryMatch
  spoilers: boolean
}) {
  return (
    <TableRow>
      <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
        {formatEventDate(match.event.eventDate, match.event.date)}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground sm:hidden">
            {formatEventDate(match.event.eventDate, match.event.date)}
          </p>
          <Link
            to="/events/$eventId"
            params={{ eventId: match.event.id }}
            className="font-medium hover:underline"
          >
            {match.event.name ?? 'Untitled event'}
          </Link>
          {(match.event.promotionLabel || match.matchType) && (
            <p className="text-xs text-muted-foreground">
              {[match.event.promotionLabel, match.matchType]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {match.titleName &&
            (match.titleLinkable && match.titleId ? (
              <Link
                to="/titles/$titleId"
                params={{ titleId: match.titleId }}
                className="text-xs text-muted-foreground hover:underline"
              >
                {match.titleName}
                {match.titleChange ? ' (title change)' : ''}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                {match.titleName}
                {match.titleChange ? ' (title change)' : ''}
              </p>
            ))}
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <SpoilerWinner
          winners={match.winners}
          finishNote={match.finishNote}
          result={match.result}
          spoilers={spoilers}
        />
      </TableCell>
    </TableRow>
  )
}
