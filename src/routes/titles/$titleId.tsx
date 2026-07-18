import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Clock, MapPin, Trophy } from 'lucide-react'
import { titleQueryOptions } from '#/lib/titles'
import type {
  TitleChangeMatch,
  TitleDetail,
  TitleReign,
  TitleReignChampion,
} from '#/lib/titles'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { MatchSideNames } from '#/components/match-result-text'

export const Route = createFileRoute('/titles/$titleId')({
  loader: async ({ context, params }) => {
    const detail = await context.queryClient.ensureQueryData(
      titleQueryOptions(params.titleId),
    )
    if (!detail) throw notFound()
  },
  component: TitleDetailPage,
  pendingComponent: TitleDetailSkeleton,
  pendingMs: 100,
  notFoundComponent: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">Title not found.</p>
      <BackLink />
    </div>
  ),
})

const numberFmt = new Intl.NumberFormat('en-US')

function BackLink() {
  return (
    <Link
      to="/titles"
      search={{ q: '', page: 1, promotion: '', status: 'all' }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to titles
    </Link>
  )
}

function TitleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start gap-4">
        {/* SDH belt art is ~16:9; at h-28 that's ~199px wide. */}
        <Skeleton className="h-28 w-48 shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 pb-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function TitleDetailPage() {
  const { titleId } = Route.useParams()
  const { data } = useSuspenseQuery(titleQueryOptions(titleId))
  // Loader guarantees non-null (throws notFound otherwise).
  const detail = data as TitleDetail
  const { title, reigns } = detail

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start gap-4">
        {title.imageUrl ? (
          <img
            src={title.imageUrl}
            alt=""
            // SDH blocks hotlinking via Referer checks; omitting the
            // header entirely is allowed.
            referrerPolicy="no-referrer"
            className="h-28 w-auto shrink-0 object-contain"
          />
        ) : (
          <Trophy className="mt-1 size-7 shrink-0 text-amber-500" />
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title.name}</h1>
          {title.promotionLabel && (
            <p className="text-muted-foreground">{title.promotionLabel}</p>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Title history</h2>
          <span className="text-sm text-muted-foreground">
            {numberFmt.format(reigns.length)}{' '}
            {reigns.length === 1 ? 'reign' : 'reigns'}
          </span>
        </div>

        {reigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No title reigns on record.
          </p>
        ) : (
          <div className="space-y-3">
            {reigns.map((reign) => (
              <ReignCard key={reign.id} reign={reign} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ReignCard({ reign }: { reign: TitleReign }) {
  const dateRange = [reign.fromDate, reign.toDate ?? 'present']
    .filter(Boolean)
    .join(' – ')

  const meta: Array<{ icon: typeof MapPin; value: string | null }> = [
    { icon: CalendarDays, value: dateRange || null },
    {
      icon: Clock,
      value:
        reign.durationDays != null
          ? `${numberFmt.format(reign.durationDays)} ${
              reign.durationDays === 1 ? 'day' : 'days'
            }`
          : null,
    },
    { icon: MapPin, value: reign.location },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 pb-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {reign.reignNumber}
        </span>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-medium">
          {reign.champions.length === 0 ? (
            <span className="text-muted-foreground">Unknown champion</span>
          ) : (
            reign.champions.map((c, i) => (
              <span key={`${c.name}-${i}`} className="inline-flex items-center">
                {i > 0 && (
                  <span className="mr-1.5 text-muted-foreground">&amp;</span>
                )}
                <ChampionName champion={c} />
              </span>
            ))
          )}
        </div>
        {reign.teamName && <Badge variant="outline">{reign.teamName}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {reign.changeMatch && <ChangeMatchLine change={reign.changeMatch} />}
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
      </CardContent>
    </Card>
  )
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

// "July 8th, 2026" — prefers events.event_date, falls back to DD.MM.YYYY text.
function formatChangeDate(
  eventDate: string | null,
  dateText: string | null,
): string | null {
  let parsed: Date | null = null
  if (eventDate) {
    const d = new Date(`${eventDate}T00:00:00`)
    if (!Number.isNaN(d.getTime())) parsed = d
  }
  if (!parsed && dateText) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateText)
    if (m) {
      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`)
      if (!Number.isNaN(d.getTime())) parsed = d
    }
  }
  if (!parsed) return dateText
  const month = parsed.toLocaleDateString('en-US', { month: 'long' })
  return `${month} ${ordinal(parsed.getDate())}, ${parsed.getFullYear()}`
}

function ChangeMatchLine({ change }: { change: TitleChangeMatch }) {
  const date = formatChangeDate(change.eventDate, change.dateText)
  const hasWinners = change.winners.length > 0
  const hasLosers = change.losers.length > 0

  const eventLink = (
    <Link
      to="/events/$eventId"
      params={{ eventId: change.eventId }}
      className="font-medium text-foreground hover:underline"
    >
      {change.eventName}
    </Link>
  )

  return (
    <p className="text-sm text-muted-foreground">
      {hasWinners && hasLosers ? (
        <>
          <MatchSideNames names={change.winners} empty="" anchorFirst /> def.{' '}
          <MatchSideNames names={change.losers} empty="" /> at {eventLink}
        </>
      ) : hasWinners ? (
        <>
          <MatchSideNames names={change.winners} empty="" anchorFirst /> at{' '}
          {eventLink}
        </>
      ) : (
        <>at {eventLink}</>
      )}
      {date ? <> on {date}.</> : <>.</>}
    </p>
  )
}

function ChampionName({ champion }: { champion: TitleReignChampion }) {
  if (champion.linkable && champion.wrestlerId) {
    return (
      <Link
        to="/wrestlers/$wrestlerId"
        params={{ wrestlerId: champion.wrestlerId }}
        search={{ tab: 'profile', page: 1 }}
        className="hover:underline"
      >
        {champion.name}
      </Link>
    )
  }
  return <>{champion.name}</>
}
