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
  EyeOff,
  MapPin,
  Moon,
  Pencil,
  Share2,
  Swords,
  Trophy,
  Tv,
} from 'lucide-react'
import { eventQueryOptions, updateEventTime } from '#/lib/events'
import {
  rivalryIdsFromMatchSides,
  rivalryKeyFromIds,
} from '#/lib/rivalries-shared'
import type {
  EnrichedEvent,
  EventDetail,
  MatchCardItem,
  MatchParticipant,
  MatchSide,
} from '#/lib/events'
import { matchReviewSummariesQueryOptions } from '#/lib/reviews'
import type { MatchReviewSummaries } from '#/lib/reviews'
import {
  eventPredictionsQueryOptions,
  type EventPredictionMap,
} from '#/lib/predictions'
import { eventAttendanceQueryOptions } from '#/lib/shows'
import { EventAttendanceControl } from '#/components/event-attendance-control'
import {
  hasCompletePredictionSlate,
  predictionShareEligibleMatches,
} from '#/lib/predictions-shared'
import { formatDeviceTime, formatVenueTime } from '#/lib/event-time'
import { isDarkMatch } from '#/lib/matches-shared'
import { StarRatingDisplay } from '#/components/star-rating-display'
import { PredictionSidePicker } from '#/components/prediction-side-picker'
import { PredictionShareDialog } from '#/components/prediction-share-dialog'
import { AdminMatchResultMenu } from '#/components/admin-match-result-menu'
import { useSpoilers } from '#/components/spoilers-provider'
import { formatEventDate } from '#/routes/events/index'
import { unspoiledMatchCard } from '#/lib/spoilers-shared'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export const Route = createFileRoute('/events/$eventId')({
  loader: async ({ context, params }) => {
    const detail = await context.queryClient.ensureQueryData(
      eventQueryOptions(params.eventId),
    )
    if (!detail) throw notFound()
    const matchIds = detail.matches.map((m) => m.id)
    await Promise.all([
      context.queryClient.ensureQueryData(
        matchReviewSummariesQueryOptions(matchIds),
      ),
      context.queryClient.ensureQueryData(
        eventPredictionsQueryOptions(params.eventId),
      ),
      context.queryClient.ensureQueryData(
        eventAttendanceQueryOptions(params.eventId),
      ),
    ])
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

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data } = useSuspenseQuery(eventQueryOptions(eventId))
  const detail = data as EventDetail
  const { event, matches, predictionsLocked } = detail
  const matchIds = matches.filter((m) => m.hasResult).map((m) => m.id)
  const { data: reviewSummaries } = useSuspenseQuery(
    matchReviewSummariesQueryOptions(matchIds),
  )
  const { data: predictions } = useSuspenseQuery(
    eventPredictionsQueryOptions(eventId),
  )
  const { data: attendance } = useSuspenseQuery(
    eventAttendanceQueryOptions(eventId),
  )
  const { spoilers } = useSpoilers()
  const [shareOpen, setShareOpen] = useState(false)

  const mainMatches = matches.filter((m) => !isDarkMatch(m.matchType))
  const darkMatches = matches.filter((m) => isDarkMatch(m.matchType))
  const resultsHidden =
    !spoilers && matches.some((m) => m.hasResult)
  const showPredictions =
    !predictionsLocked ||
    matches.some((m) => m.isPredictable) ||
    Object.keys(predictions).length > 0
  const shareMatches = predictionShareEligibleMatches(matches)
  const canSharePredictions =
    !!user && hasCompletePredictionSlate(matches, predictions)

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
          <EventAttendanceControl
            eventId={eventId}
            attendance={attendance}
            signedIn={!!user}
          />
          {showPredictions && (
            <p className="text-xs text-muted-foreground">
              {predictionsLocked
                ? 'Predictions are locked for this event.'
                : 'Predictions lock at event start — pick a winner on each match.'}
            </p>
          )}
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

      {canSharePredictions ? (
        <Card className="gap-3 py-4">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 px-4 py-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Share your predictions!</CardTitle>
              <CardDescription>
                You&apos;ve picked every match
                {shareMatches.length > 0
                  ? ` (${shareMatches.length})`
                  : ''}
                . Export a square image for socials.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-4" />
              Share
            </Button>
          </CardHeader>
          <PredictionShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            event={event}
            matches={shareMatches}
            predictions={predictions}
            username={user?.username ?? null}
          />
        </Card>
      ) : null}

      {user?.isAdmin && <EventTimeEditor event={event} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Match card</h2>
          <span className="text-sm text-muted-foreground">
            {mainMatches.length}{' '}
            {mainMatches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {resultsHidden && (
          <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Match results are hidden. Turn on Spoilers to reveal winners.
            </span>
          </p>
        )}

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
                predictions={predictions}
                predictionsLocked={predictionsLocked}
                eventId={event.id}
                signedIn={!!user}
                isAdmin={!!user?.isAdmin}
              />
            )}

            {mainMatches.length > 0 && (
              <div className="space-y-3">
                {mainMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    reviewSummary={reviewSummaries[match.id]}
                    prediction={predictions[match.id]}
                    predictionsLocked={predictionsLocked}
                    eventId={event.id}
                    signedIn={!!user}
                    isAdmin={!!user?.isAdmin}
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
              <Select
                value={timezone || undefined}
                disabled={mutation.isPending}
                onValueChange={setTimezone}
              >
                <SelectTrigger id="event-timezone" className="w-64">
                  <SelectValue placeholder="Select time zone…" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone.replaceAll('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
  predictions,
  predictionsLocked,
  eventId,
  signedIn,
  isAdmin,
}: {
  matches: Array<MatchCardItem>
  reviewSummaries: MatchReviewSummaries
  predictions: EventPredictionMap
  predictionsLocked: boolean
  eventId: string
  signedIn: boolean
  isAdmin: boolean
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
            prediction={predictions[match.id]}
            predictionsLocked={predictionsLocked}
            eventId={eventId}
            signedIn={signedIn}
            isAdmin={isAdmin}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// Tag team titles render the belt art twice, the top copy offset down-right.
function BeltImage({
  imageUrl,
  titleName,
}: {
  imageUrl: string
  titleName: string | null
}) {
  const belt = (
    <img
      src={imageUrl}
      alt=""
      // SDH blocks hotlinking via Referer checks; omitting the
      // header entirely is allowed.
      referrerPolicy="no-referrer"
      className="h-24 w-auto object-contain"
    />
  )
  if (!/\btag team\b/i.test(titleName ?? '')) return belt
  return (
    <span className="relative inline-block pr-4 pb-4">
      {belt}
      <span className="absolute top-4 left-4">{belt}</span>
    </span>
  )
}

function ordinal(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}

// Large AND NEW! / AND STILL! callout for resolved title matches, with the
// new champion's reign number or the running successful-defense count when
// that context is available.
function TitleResultCallout({ match }: { match: MatchCardItem }) {
  const tagline = match.titleChange
    ? match.winnerReignNumber != null
      ? match.winnerReignNumber === 1
        ? 'First reign'
        : `Begins ${ordinal(match.winnerReignNumber)} reign`
      : null
    : match.titleDefenseNumber != null
      ? `${ordinal(match.titleDefenseNumber)} successful title defense`
      : null

  return (
    <div className="space-y-0.5 text-center">
      <p
        className={cn(
          'text-2xl font-extrabold tracking-wide',
          match.titleChange ? 'text-amber-500' : 'text-emerald-600',
        )}
      >
        {match.titleChange ? 'AND NEW!' : 'AND STILL!'}
      </p>
      {tagline && (
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {tagline}
        </p>
      )}
    </div>
  )
}

// Centered marquee above the competitors: belt art + title name when the
// match is for a title (linked to the title page when the id resolves),
// plus the match type.
function MatchMarquee({ match }: { match: MatchCardItem }) {
  const title = match.titleName ? (
    <span className="inline-flex flex-col items-center gap-1">
      {match.titleImageUrl ? (
        <BeltImage
          imageUrl={match.titleImageUrl}
          titleName={match.titleName}
        />
      ) : (
        <Trophy className="size-8 text-amber-500" />
      )}
      <span className="text-sm font-semibold">
        {match.titleName}
        {match.isTitleOutcome && match.titleChange ? (
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
            search={{ tab: 'reigns', page: 1 }}
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
  match: rawMatch,
  reviewSummary,
  prediction,
  predictionsLocked,
  eventId,
  signedIn,
  isAdmin,
}: {
  match: MatchCardItem
  reviewSummary?: { average: number | null; count: number }
  prediction?: EventPredictionMap[string]
  predictionsLocked: boolean
  eventId: string
  signedIn: boolean
  isAdmin: boolean
}) {
  const { spoilers } = useSpoilers()
  // Display copy only — admin menu / prediction lock still use the real card.
  const match =
    spoilers || !rawMatch.hasResult
      ? rawMatch
      : unspoiledMatchCard(rawMatch)
  const hasWinner = match.sides.some((s) => s.role === 'winner')
  const connector = hasWinner ? 'def.' : 'vs'
  const reviewCount = reviewSummary?.count ?? 0
  // Keep an existing pick visible after this match resolves, even when the
  // event-level lock instant has not passed yet.
  const showPrediction = rawMatch.isPredictable || !!prediction
  const showAdminMenu = isAdmin && rawMatch.sides.length >= 2
  const rivalryIds = rivalryIdsFromMatchSides(rawMatch.sides)

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
          {rivalryIds && (
            <Link
              to="/rivalries/$rivalryKey"
              params={{ rivalryKey: rivalryKeyFromIds(rivalryIds) }}
              search={{ page: 1 }}
              className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Swords className="size-3.5" />
              Rivalry
            </Link>
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
          {showAdminMenu && (
            <AdminMatchResultMenu
              eventId={eventId}
              matchId={rawMatch.id}
              sides={rawMatch.sides}
              isTitleMatch={rawMatch.isTitleOutcome}
              titleChange={!!rawMatch.titleChange}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(match.titleName || match.matchType) && <MatchMarquee match={match} />}

        {match.isTitleOutcome && match.hasResult && (
          <TitleResultCallout match={match} />
        )}

        {/* Stacked with a centered connector below `sm`; horizontal above. */}
        <div className="flex flex-col items-center justify-center gap-x-4 gap-y-3 sm:flex-row sm:flex-wrap sm:items-start">
          {match.sides.map((side, i) => (
            <Fragment key={side.id}>
              {i > 0 && (
                <div className="flex flex-col items-center gap-1.5">
                  {/* Spacers align the connector with avatar rows on sm+. */}
                  <div className="hidden h-5 sm:block" />
                  <div className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:h-14">
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

        {showPrediction && (
          <>
            <Separator />
            <PredictionSidePicker
              eventId={eventId}
              matchId={rawMatch.id}
              sides={rawMatch.sides}
              prediction={prediction}
              locked={predictionsLocked || rawMatch.hasResult}
              signedIn={signedIn}
            />
          </>
        )}

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
