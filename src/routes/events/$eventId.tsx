import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Fragment, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock,
  ExternalLink,
  MapPin,
  Moon,
  Pencil,
  Trophy,
  Tv,
} from 'lucide-react'
import { eventQueryOptions, updateEventTime } from '#/lib/events'
import type {
  EnrichedEvent,
  EventDetail,
  MatchCardItem,
  MatchParticipant,
  MatchSide,
} from '#/lib/events'
import { matchReviewSummariesQueryOptions } from '#/lib/reviews'
import type { MatchReviewSummaries } from '#/lib/reviews'
import { formatDeviceTime, formatVenueTime } from '#/lib/event-time'
import { StarRatingDisplay } from '#/components/star-rating-display'
import { formatEventDate } from '#/routes/events/index'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { cn } from '#/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'

export const Route = createFileRoute('/events/$eventId')({
  loader: async ({ context, params }) => {
    const detail = await context.queryClient.ensureQueryData(
      eventQueryOptions(params.eventId),
    )
    if (!detail) throw notFound()
    const matchIds = detail.matches.map((m) => m.id)
    await context.queryClient.ensureQueryData(
      matchReviewSummariesQueryOptions(matchIds),
    )
  },
  component: EventDetailPage,
  pendingComponent: EventDetailSkeleton,
  pendingMs: 100,
  notFoundComponent: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">Event not found.</p>
      <BackLink />
    </div>
  ),
})

function BackLink() {
  return (
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
  )
}

function EventDetailSkeleton() {
  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-40" />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="ml-auto h-8 w-20" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Match card</h2>
          <Skeleton className="h-5 w-20" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="gap-3 py-4">
              <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <Skeleton className="ml-auto h-5 w-12" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-24 w-44" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="mx-auto h-5 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

// Matches whose type starts with the word "Dark" (e.g. "Dark Match",
// "Dark Tag Team Match", "Dark  Match"). Excludes unrelated types that merely
// contain the substring, like "World Of Darkness Match".
function isDarkMatch(matchType: string | null): boolean {
  return matchType != null && /^dark\b/i.test(matchType.trim())
}

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data } = useSuspenseQuery(eventQueryOptions(eventId))
  const detail = data as EventDetail
  const { event, matches } = detail
  const matchIds = matches.filter((m) => m.hasResult).map((m) => m.id)
  const { data: reviewSummaries } = useSuspenseQuery(
    matchReviewSummariesQueryOptions(matchIds),
  )

  const mainMatches = matches.filter((m) => !isDarkMatch(m.matchType))
  const darkMatches = matches.filter((m) => isDarkMatch(m.matchType))

  const venueTime = formatVenueTime(
    event.event_date,
    event.event_time,
    event.event_timezone,
  )

  const meta: Array<{ icon: typeof MapPin; value: string | null }> = [
    {
      icon: CalendarDays,
      value: formatEventDate(event.event_date, event.date),
    },
    { icon: Clock, value: venueTime },
    { icon: MapPin, value: event.arena ?? event.location },
    { icon: Tv, value: event.tv_network },
  ]

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {event.name ?? 'Untitled event'}
          </h1>
          {event.promotionLabel && (
            <p className="text-muted-foreground">{event.promotionLabel}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {meta
              .filter((m) => m.value)
              .map(({ icon: Icon, value }, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <Icon className="size-3.5" />
                  {value}
                </span>
              ))}
          </div>
          <DeviceTimeNote event={event} />
        </div>
        {event.profile_url && (
          <a
            href={event.profile_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Profile <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {user?.isAdmin && <EventTimeEditor event={event} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Match card</h2>
          <span className="text-sm text-muted-foreground">
            {mainMatches.length}{' '}
            {mainMatches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches on record for this event.
          </p>
        ) : (
          <>
            {darkMatches.length > 0 && (
              <DarkMatches
                matches={darkMatches}
                reviewSummaries={reviewSummaries}
              />
            )}

            {mainMatches.length > 0 && (
              <div className="space-y-3">
                {mainMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    reviewSummary={reviewSummaries[match.id]}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

// Device-local time, computed only in the browser to avoid an SSR/client
// hydration mismatch (the server doesn't know the viewer's time zone).
function DeviceTimeNote({ event }: { event: EnrichedEvent }) {
  const [deviceTime, setDeviceTime] = useState<string | null>(null)
  useEffect(() => {
    setDeviceTime(
      formatDeviceTime(
        event.event_date,
        event.event_time,
        event.event_timezone,
      ),
    )
  }, [event.event_date, event.event_time, event.event_timezone])

  if (!deviceTime) return null
  return (
    <p className="text-xs text-muted-foreground">
      {deviceTime} your time
    </p>
  )
}

function toTimeInputValue(value: string | null): string {
  if (!value) return ''
  const m = /^(\d{2}):(\d{2})/.exec(value)
  return m ? `${m[1]}:${m[2]}` : ''
}

// Admin-only control to set/clear the event's local venue start time. Cagematch
// doesn't provide times, so they're entered here.
function EventTimeEditor({ event }: { event: EnrichedEvent }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState(() => toTimeInputValue(event.event_time))
  const [timezone, setTimezone] = useState(() => event.event_timezone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [zones] = useState<Array<string>>(() =>
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [],
  )

  // Default the zone to the admin's own zone once mounted (browser-only, so it
  // doesn't cause a hydration mismatch on the controlled input).
  useEffect(() => {
    if (!timezone) {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (deviceTz) setTimezone(deviceTz)
    }
  }, [timezone])

  const mutation = useMutation({
    mutationFn: (vars: {
      eventTime: string | null
      eventTimezone: string | null
    }) => updateEventTime({ data: { eventId: event.id, ...vars } }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['event', event.id] })
      setOpen(false)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not save time.')
    },
  })

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="size-3.5" />
          {event.event_time ? 'Edit start time' : 'Add start time'}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <form
          className="max-w-md space-y-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            mutation.mutate({
              eventTime: time || null,
              eventTimezone: timezone || null,
            })
          }}
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Event start time</h3>
            <p className="text-xs text-muted-foreground">
              Local venue time. Not scraped from Cagematch.
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

          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-time">Start time</Label>
              <Input
                id="event-time"
                type="time"
                className="w-auto"
                value={time}
                disabled={mutation.isPending}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-timezone">Time zone</Label>
              <Input
                id="event-timezone"
                list="event-timezone-options"
                className="w-64"
                placeholder="e.g. America/New_York"
                value={timezone}
                disabled={mutation.isPending}
                onChange={(e) => setTimezone(e.target.value)}
              />
              <datalist id="event-timezone-options">
                {zones.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save time'}
            </Button>
            {event.event_time && (
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => {
                  setTime('')
                  setTimezone('')
                  mutation.mutate({ eventTime: null, eventTimezone: null })
                }}
              >
                Clear time
              </Button>
            )}
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}

function DarkMatches({
  matches,
  reviewSummaries,
}: {
  matches: Array<MatchCardItem>
  reviewSummaries: MatchReviewSummaries
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Moon className="size-4" />
        <span>
          {matches.length} dark {matches.length === 1 ? 'match' : 'matches'}
        </span>
        <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            reviewSummary={reviewSummaries[match.id]}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// Centered marquee above the competitors: belt art + title name when the
// match is for a title (linked to the title page when the id resolves),
// plus the match type.
function MatchMarquee({ match }: { match: MatchCardItem }) {
  const title = match.titleName ? (
    <span className="inline-flex flex-col items-center gap-1">
      {match.titleImageUrl ? (
        <img
          src={match.titleImageUrl}
          alt=""
          // SDH blocks hotlinking via Referer checks; omitting the
          // header entirely is allowed.
          referrerPolicy="no-referrer"
          className="h-24 w-auto object-contain"
        />
      ) : (
        <Trophy className="size-8 text-amber-500" />
      )}
      <span className="text-sm font-semibold">
        {match.titleName}
        {match.titleChange ? (
          <span className="font-normal text-muted-foreground">
            {' '}
            (title change)
          </span>
        ) : null}
      </span>
    </span>
  ) : null

  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      {title &&
        (match.titleLinkable && match.titleId ? (
          <Link
            to="/titles/$titleId"
            params={{ titleId: match.titleId }}
            className="transition-opacity hover:opacity-80"
          >
            {title}
          </Link>
        ) : (
          title
        ))}
      {match.matchType && (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {match.matchType}
        </span>
      )}
    </div>
  )
}

function MatchCard({
  match,
  reviewSummary,
}: {
  match: MatchCardItem
  reviewSummary?: { average: number | null; count: number }
}) {
  const hasWinner = match.sides.some((s) => s.role === 'winner')
  const connector = hasWinner ? 'def.' : 'vs'
  const reviewCount = reviewSummary?.count ?? 0

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {match.index}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
          {match.duration && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3.5" />
              {match.duration}
            </span>
          )}
          {match.hasResult && (
            <Link
              to="/matches/$matchId"
              params={{ matchId: match.id }}
              search={{ page: 1 }}
              className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
            >
              {reviewCount > 0 ? (
                <StarRatingDisplay
                  rating={reviewSummary?.average ?? null}
                  count={reviewCount}
                  mode="compact"
                />
              ) : (
                <span className="text-muted-foreground hover:text-foreground">
                  Reviews
                </span>
              )}
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(match.titleName || match.matchType) && <MatchMarquee match={match} />}

        <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
          {match.sides.map((side, i) => (
            <Fragment key={side.id}>
              {i > 0 && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-5" />
                  <div className="flex h-14 items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {connector}
                  </div>
                </div>
              )}
              <MatchSideGroup
                side={side}
                dimmed={hasWinner && side.role === 'loser'}
              />
            </Fragment>
          ))}
        </div>

        {(match.finishNote || match.notes.length > 0) && (
          <>
            <Separator />
            <div className="space-y-1 text-sm text-muted-foreground">
              {match.finishNote && <p>{match.finishNote}</p>}
              {match.notes.map((note, i) => (
                <p key={i}>{note}</p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MatchSideGroup({
  side,
  dimmed,
}: {
  side: MatchSide
  dimmed: boolean
}) {
  const wrestlers = side.participants.filter((p) => p.role === 'wrestler')
  const teams = side.participants.filter((p) => p.role === 'team')
  const valets = side.participants.filter((p) => p.role === 'valet')
  const primary = wrestlers.length > 0 ? wrestlers : teams
  const teamLabel =
    wrestlers.length > 0 && teams.length > 0
      ? teams.map((t) => t.name).join(', ')
      : null

  // Tag teams (multiple workers on one side) get a surrounding box.
  const isTeam = primary.length > 1

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5',
        dimmed && 'opacity-70',
      )}
    >
      <div className="flex h-5 items-center gap-1">
        {side.role === 'winner' && (
          <Trophy className="size-3.5 text-amber-500" />
        )}
        {side.isChampion && (
          <Badge variant="outline" className="text-[10px]">
            C
          </Badge>
        )}
      </div>
      <div
        className={cn(
          'flex flex-col items-center gap-1.5',
          isTeam && 'rounded-lg border bg-muted/30 px-3 py-2',
        )}
      >
        <div className="flex flex-wrap items-start justify-center gap-3">
          {primary.map((p, i) => (
            <Worker key={`${p.name}-${i}`} participant={p} />
          ))}
        </div>
        {teamLabel && (
          <span className="text-xs text-muted-foreground">({teamLabel})</span>
        )}
      </div>
      {valets.length > 0 && (
        <span className="text-xs text-muted-foreground">
          w/ {valets.map((v) => v.name).join(', ')}
        </span>
      )}
    </div>
  )
}

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = (parts[0][0] ?? '') + (parts.length > 1 ? parts[1][0] : '')
  return letters.toUpperCase() || '?'
}

// A single worker: SDH headshot avatar (via wrestler_crosswalk) with the
// name beneath. Falls back to initials when there's no matched image.
function Worker({ participant }: { participant: MatchParticipant }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1.5 text-center">
      <Avatar className="size-14">
        {participant.imageUrl && (
          <AvatarImage
            src={participant.imageUrl}
            alt={participant.name ?? ''}
            // SDH blocks hotlinking via Referer checks; omitting the
            // header entirely is allowed.
            referrerPolicy="no-referrer"
          />
        )}
        <AvatarFallback className="text-xs font-medium">
          {initials(participant.name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium leading-tight">
        <ParticipantName participant={participant} />
      </span>
    </div>
  )
}

function ParticipantName({ participant }: { participant: MatchParticipant }) {
  if (participant.linkable && participant.id) {
    return (
      <Link
        to="/wrestlers/$wrestlerId"
        params={{ wrestlerId: participant.id }}
        search={{ tab: 'profile', page: 1 }}
        className="hover:underline"
      >
        {participant.name}
      </Link>
    )
  }
  return <>{participant.name}</>
}
