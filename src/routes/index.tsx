import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { CalendarDays, Trophy } from 'lucide-react'
import { Fragment } from 'react'
import { recentEventsQueryOptions } from '#/lib/events'
import type { EnrichedEvent } from '#/lib/events'
import { worldChampionsQueryOptions } from '#/lib/titles'
import type { TopChampionsRow, WorldChampionEntry } from '#/lib/titles'
import { formatEventDate } from '#/routes/events/index'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { cn } from '#/lib/utils'

type HomeTab = 'champions' | 'events'

function parseHomeTab(value: unknown): HomeTab {
  return value === 'events' ? 'events' : 'champions'
}

interface HomeSearch {
  tab: HomeTab
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    tab: parseHomeTab(search.tab),
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(worldChampionsQueryOptions()),
      context.queryClient.ensureQueryData(recentEventsQueryOptions()),
    ])
  },
  component: Home,
  pendingComponent: HomeSkeleton,
  pendingMs: 100,
})

const numberFmt = new Intl.NumberFormat('en-US')

// title_reigns.from_date is DD.MM.YYYY text; render as "Jul 8, 2026".
function formatReignDate(fromDate: string | null): string | null {
  if (!fromDate) return null
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(fromDate)
  if (!m) return fromDate
  const parsed = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return fromDate
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const letters =
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '')
  return letters.toUpperCase() || '?'
}

/** Compact labels for the curated home titles — full name stays on the title page. */
const SHORT_TITLE_LABELS: Record<string, string> = {
  '4331': 'World Championship',
  '4370': "Women's World Championship",
  '145': 'IWGP Heavyweight Championship',
  '1577': 'World of Stardom Championship',
  '6069': 'World Heavyweight Championship',
  '3116': "Women's World Championship",
  '20': 'Undisputed Championship',
  '2906': "Women's Championship",
}

function shortTitleLabel(titleId: string, titleName: string): string {
  return SHORT_TITLE_LABELS[titleId] ?? titleName
}

function Hero() {
  return (
    <section className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Pro Wrestling Database
      </h1>
      <p className="max-w-2xl text-muted-foreground">
        Explore wrestlers, events, championships, and complete match
        histories.
      </p>
    </section>
  )
}

function Home() {
  const navigate = Route.useNavigate()
  const { tab } = Route.useSearch()
  const { data: championRows } = useSuspenseQuery(worldChampionsQueryOptions())
  const { data: events } = useSuspenseQuery(recentEventsQueryOptions())

  const hasChampions = championRows.some((row) => row.men ?? row.women)

  return (
    <div className="space-y-10">
      <Hero />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          void navigate({
            search: (prev) => ({ ...prev, tab: parseHomeTab(value) }),
            resetScroll: false,
          })
        }}
        className="gap-4"
      >
        <TabsList className="grid h-10 w-full grid-cols-2 lg:hidden">
          <TabsTrigger value="champions" className="gap-1.5">
            <Trophy className="size-4 text-amber-500" />
            Champions
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <CalendarDays className="size-4" />
            Events
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-8 lg:grid-cols-2">
          <section
            className={cn(
              'space-y-4',
              tab !== 'champions' && 'hidden lg:block',
            )}
          >
            <div className="hidden items-center gap-2 lg:flex">
              <Trophy className="size-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Current champions</h2>
            </div>
            {!hasChampions ? (
              <p className="text-sm text-muted-foreground">
                No active title reigns on record.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {championRows.map((row) => (
                  <ChampionGridRow key={row.label} row={row} />
                ))}
              </div>
            )}
          </section>

          <section
            className={cn('space-y-4', tab !== 'events' && 'hidden lg:block')}
          >
            <div className="hidden items-center gap-2 lg:flex">
              <CalendarDays className="size-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Recent events</h2>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent events on record.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {events.map((event) => (
                  <RecentEventRow key={event.id} event={event} />
                ))}
              </div>
            )}
            <Link
              to="/events"
              search={{
                q: '',
                page: 1,
                future: false,
                promotion: '',
                sort: 'date_desc',
              }}
              className="inline-block text-sm text-primary hover:underline"
            >
              Browse all events
            </Link>
          </section>
        </div>
      </Tabs>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-10">
      <Hero />

      <div className="space-y-4">
        <Skeleton className="h-10 w-full lg:hidden" />
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-4">
            <div className="hidden items-center gap-2 lg:flex">
              <Trophy className="size-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Current champions</h2>
            </div>
            <div className="divide-y rounded-lg border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3 p-3">
                  <Skeleton className="h-4 w-20" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="hidden space-y-4 lg:block">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Recent events</h2>
            </div>
            <div className="divide-y rounded-lg border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 p-3"
                >
                  <Skeleton className="h-5 w-52" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ChampionGridRow({ row }: { row: TopChampionsRow }) {
  return (
    <div className="space-y-3 p-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {row.label}
      </p>
      {/* Stack on phones — side-by-side only when there is room for both names. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChampionCell entry={row.men} />
        <ChampionCell entry={row.women} />
      </div>
    </div>
  )
}

function ChampionCell({ entry }: { entry: WorldChampionEntry | null }) {
  if (!entry) {
    return (
      <div className="flex min-h-14 items-center justify-center rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
        Vacant
      </div>
    )
  }

  const since = formatReignDate(entry.fromDate)
  const primaryChampion = entry.champions[0]
  const titleLabel = shortTitleLabel(entry.titleId, entry.titleName)

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5">
      <ChampionAvatar champion={primaryChampion} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium">
          {entry.champions.map((champion, i) => (
            <Fragment key={`${champion.wrestlerId ?? champion.name}-${i}`}>
              {i > 0 && ' & '}
              {champion.linkable && champion.wrestlerId ? (
                <Link
                  to="/wrestlers/$wrestlerId"
                  params={{ wrestlerId: champion.wrestlerId }}
                  search={{ tab: 'profile', page: 1 }}
                  className="hover:underline"
                >
                  {champion.name}
                </Link>
              ) : (
                champion.name
              )}
            </Fragment>
          ))}
        </p>
        <Link
          to="/titles/$titleId"
          params={{ titleId: entry.titleId }}
          search={{ tab: 'reigns', page: 1 }}
          className="mt-0.5 block text-xs leading-snug text-muted-foreground hover:underline"
        >
          {titleLabel}
        </Link>
        {since && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            since {since}
            {entry.daysHeld != null &&
              ` · ${numberFmt.format(entry.daysHeld)} days`}
          </p>
        )}
      </div>
      {entry.titleImageUrl ? (
        <img
          src={entry.titleImageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-10 w-auto shrink-0 object-contain sm:h-11"
        />
      ) : (
        <Trophy className="size-5 shrink-0 text-amber-500" />
      )}
    </div>
  )
}

function ChampionAvatar({
  champion,
}: {
  champion: WorldChampionEntry['champions'][number] | undefined
}) {
  if (!champion) {
    return (
      <Avatar className="size-11 shrink-0 sm:size-12">
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    )
  }

  return (
    <Avatar className="size-11 shrink-0 sm:size-12">
      {champion.imageUrl ? (
        <AvatarImage
          src={champion.imageUrl}
          alt={champion.name ?? ''}
          referrerPolicy="no-referrer"
          className="object-cover object-top"
        />
      ) : null}
      <AvatarFallback>{initials(champion.name)}</AvatarFallback>
    </Avatar>
  )
}

function RecentEventRow({ event }: { event: EnrichedEvent }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3">
      <div className="min-w-0">
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="font-medium hover:underline"
        >
          {event.name ?? 'Untitled event'}
        </Link>
        {event.location && (
          <p className="truncate text-xs text-muted-foreground">
            {event.location}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {event.promotionLabel && (
          <Badge variant="outline">{event.promotionLabel}</Badge>
        )}
        <span className="tabular-nums">
          {formatEventDate(event.event_date, event.date)}
        </span>
      </div>
    </div>
  )
}
