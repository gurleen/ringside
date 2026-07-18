import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import { eventPromotionsQueryOptions, eventsQueryOptions } from '#/lib/events'
import type { EventSort } from '#/lib/events'
import { formatVenueTime } from '#/lib/event-time'
import { cn } from '#/lib/utils'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

interface EventSearch {
  q: string
  page: number
  future: boolean
  promotion: string
  sort: EventSort
}

const ALL_PROMOTIONS = 'all'

export const Route = createFileRoute('/events/')({
  validateSearch: (search: Record<string, unknown>): EventSearch => ({
    q: typeof search.q === 'string' ? search.q : '',
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
    future: search.future === true || search.future === 'true',
    promotion: typeof search.promotion === 'string' ? search.promotion : '',
    sort: search.sort === 'date_asc' ? 'date_asc' : 'date_desc',
  }),
  loaderDeps: ({ search }) => ({
    q: search.q,
    page: search.page,
    future: search.future,
    promotion: search.promotion,
    sort: search.sort,
  }),
  loader: async ({ context, deps, cause }) => {
    const options = eventsQueryOptions(
      deps.q,
      deps.page,
      deps.future,
      deps.promotion,
      deps.sort,
    )
    // Same-route navigations (pagination, search, filters) must not block,
    // or the router swaps in the full-page pending skeleton. keepPreviousData
    // in the component keeps the previous rows visible while loading.
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
      return
    }
    await Promise.all([
      context.queryClient.ensureQueryData(options),
      context.queryClient.ensureQueryData(eventPromotionsQueryOptions()),
    ])
  },
  component: EventsPage,
  pendingComponent: EventsPageSkeleton,
  pendingMs: 100,
})

const numberFmt = new Intl.NumberFormat('en-US')

function EventsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Events</h1>
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full max-w-md gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="hidden md:table-cell">Promotion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-48" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-5 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  )
}

export function formatEventDate(
  eventDate: string | null,
  fallback: string | null,
): string {
  if (eventDate) {
    const parsed = new Date(`${eventDate}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    }
  }
  return fallback ?? '—'
}

function EventStatusDot({ hasOccurred }: { hasOccurred: boolean | null }) {
  const label =
    hasOccurred === true
      ? 'Has happened'
      : hasOccurred === false
        ? 'Upcoming'
        : 'Status unknown'
  return (
    <span
      className={cn(
        'mt-1.5 size-2 shrink-0 rounded-full',
        hasOccurred === true && 'bg-emerald-500',
        hasOccurred === false && 'bg-amber-500',
        hasOccurred === null && 'bg-muted-foreground/25',
      )}
      title={label}
      role="img"
      aria-label={label}
    />
  )
}

function EventsPage() {
  const { q, page, future, promotion, sort } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [input, setInput] = useState(q)

  const { data, isPlaceholderData } = useQuery({
    ...eventsQueryOptions(q, page, future, promotion, sort),
    placeholderData: keepPreviousData,
  })
  const { data: promotions } = useSuspenseQuery(eventPromotionsQueryOptions())
  // The loader awaits on first entry, and keepPreviousData covers
  // subsequent same-route navigations, so data is always available.
  if (!data) return <EventsPageSkeleton />
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ search: (prev) => ({ ...prev, q: input, page: 1 }) })
  }

  function goToPage(next: number) {
    navigate({ search: (prev) => ({ ...prev, page: next }) })
  }

  function toggleFuture(next: boolean) {
    navigate({ search: (prev) => ({ ...prev, future: next, page: 1 }) })
  }

  function selectPromotion(next: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        promotion: next === ALL_PROMOTIONS ? '' : next,
        page: 1,
      }),
    })
  }

  function toggleSort() {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: prev.sort === 'date_desc' ? 'date_asc' : 'date_desc',
        page: 1,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground">
          {numberFmt.format(data.total)} events
          {q ? ` matching “${q}”` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={submitSearch} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search by event name…"
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={promotion || ALL_PROMOTIONS}
            onValueChange={selectPromotion}
          >
            <SelectTrigger
              className="w-[180px]"
              aria-label="Filter by promotion"
            >
              <SelectValue placeholder="All promotions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROMOTIONS}>All promotions</SelectItem>
              {promotions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="show-future"
              checked={future}
              onCheckedChange={toggleFuture}
            />
            <Label htmlFor="show-future" className="text-sm">
              Show future events
            </Label>
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="hidden sm:table-cell">
                <button
                  type="button"
                  onClick={toggleSort}
                  aria-label={`Sort by date (${
                    sort === 'date_desc' ? 'newest first' : 'oldest first'
                  })`}
                  className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                >
                  Date
                  {sort === 'date_desc' ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )}
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Promotion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-muted-foreground"
                >
                  No events found.
                </TableCell>
              </TableRow>
            ) : (
              data.events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-start gap-2">
                      <EventStatusDot hasOccurred={ev.hasOccurred} />
                      <div>
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: ev.id }}
                          className="hover:underline"
                        >
                          {ev.name ?? 'Untitled event'}
                        </Link>
                        {ev.location && (
                          <div className="text-xs text-muted-foreground">
                            {ev.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatEventDate(ev.event_date, ev.date)}
                    {(() => {
                      const time = formatVenueTime(
                        ev.event_date,
                        ev.event_time,
                        ev.event_timezone,
                      )
                      return time ? (
                        <div className="text-xs tabular-nums">{time}</div>
                      ) : null
                    })()}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {ev.promotionLabel ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page} of {numberFmt.format(totalPages)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
