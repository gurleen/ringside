import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Shield,
  Trophy,
} from 'lucide-react'
import {
  titleQueryOptions,
  titleReignDefensesQueryOptions,
  titleReignsQueryOptions,
  titleStatsQueryOptions,
} from '#/lib/titles'
import type { SdhTitleProfile } from '#/lib/sdh'
import type {
  TitleChangeMatch,
  TitleDetail,
  TitleReign,
  TitleReignDefense,
  TitleStatsChampion,
  TitleStatsHolderRecord,
  TitleStatsReignRecord,
} from '#/lib/titles'
import {
  formatChampionReignLabel,
} from '#/lib/titles-shared'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { MatchSideNames } from '#/components/match-result-text'

type TitleTab = 'reigns' | 'details' | 'history'

function parseTitleTab(value: unknown): TitleTab {
  if (value === 'details') return 'details'
  if (value === 'history') return 'history'
  return 'reigns'
}

interface TitleSearch {
  tab: TitleTab
  page: number
}

export const Route = createFileRoute('/titles/$titleId')({
  validateSearch: (search: Record<string, unknown>): TitleSearch => ({
    tab: parseTitleTab(search.tab),
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab, page: search.page }),
  loader: async ({ context, params, deps, cause }) => {
    const detail = await context.queryClient.ensureQueryData(
      titleQueryOptions(params.titleId),
    )
    if (!detail) throw notFound()

    if (deps.tab === 'reigns') {
      const options = titleReignsQueryOptions(params.titleId, deps.page)
      if (cause === 'stay') {
        void context.queryClient.prefetchQuery(options)
      } else {
        await context.queryClient.ensureQueryData(options)
      }
    }

    if (deps.tab === 'details') {
      const options = titleStatsQueryOptions(params.titleId)
      if (cause === 'stay') {
        void context.queryClient.prefetchQuery(options)
      } else {
        await context.queryClient.ensureQueryData(options)
      }
    }
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
/** Fits exactly three defense match cards (see `.defense-match-card` min-height). */
const DEFENSE_LIST_MAX_HEIGHT = 'calc(9rem * 3 + 0.5rem * 2)'

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

      <Skeleton className="h-9 w-48" />

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
  const { tab, page } = Route.useSearch()
  const navigate = useNavigate({ from: '/titles/$titleId' })
  const [activeTab, setActiveTab] = useState(parseTitleTab(tab))
  const { data } = useSuspenseQuery(titleQueryOptions(titleId))
  // Loader guarantees non-null (throws notFound otherwise).
  const detail = data as TitleDetail
  const { title, sdh } = detail

  useEffect(() => {
    setActiveTab(parseTitleTab(tab))
  }, [tab])

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

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = parseTitleTab(value)
          setActiveTab(nextTab)
          void navigate({
            search: (prev) => ({
              ...prev,
              tab: nextTab,
              page: 1,
            }),
            resetScroll: false,
          })
        }}
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="reigns">Reigns</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">Title history</TabsTrigger>
        </TabsList>

        <TabsContent value="reigns" className="pt-4">
          <TitleReignsTab titleId={titleId} page={page} reignCount={title.reignCount} />
        </TabsContent>

        <TabsContent value="details" className="pt-4">
          <TitleDetailsTab titleId={titleId} reignCount={title.reignCount} />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <TitleSdhHistoryTab sdh={sdh} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TitleReignsTab({
  titleId,
  page,
  reignCount,
}: {
  titleId: string
  page: number
  reignCount: number
}) {
  const navigate = useNavigate({ from: '/titles/$titleId' })
  const { data, isPlaceholderData } = useQuery({
    ...titleReignsQueryOptions(titleId, page),
    placeholderData: keepPreviousData,
  })
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1
  const showPagination = !!data && data.total > data.pageSize

  const pagination = showPagination ? (
    <ReignPagination
      page={page}
      totalPages={totalPages}
      onPrevious={() =>
        void navigate({
          search: (prev) => ({
            ...prev,
            tab: 'reigns',
            page: page - 1,
          }),
        })
      }
      onNext={() =>
        void navigate({
          search: (prev) => ({
            ...prev,
            tab: 'reigns',
            page: page + 1,
          }),
        })
      }
    />
  ) : null

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Title reigns</h2>
        <span className="text-sm text-muted-foreground">
          {numberFmt.format(reignCount)}{' '}
          {reignCount === 1 ? 'reign' : 'reigns'}
        </span>
      </div>

      {pagination}

      <div
        className={cn(
          'space-y-3 transition-opacity',
          isPlaceholderData && 'opacity-60',
        )}
      >
        {!data ? (
          Array.from({ length: 3 }).map((_, i) => (
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
          ))
        ) : data.reigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No title reigns on record.
          </p>
        ) : (
          data.reigns.map((reign) => (
            <ReignCard key={reign.id} titleId={titleId} reign={reign} />
          ))
        )}
      </div>

      {pagination}
    </section>
  )
}

function ReignPagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        Page {page} of {numberFmt.format(totalPages)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={onPrevious}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function formatDays(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${numberFmt.format(value)} ${value === 1 ? 'day' : 'days'}`
}

function formatAvgDays(value: number | null | undefined): string {
  if (value == null) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${numberFmt.format(rounded)} ${rounded === 1 ? 'day' : 'days'}`
}

function StatsChampionNames({
  champions,
}: {
  champions: Array<TitleStatsChampion>
}) {
  if (champions.length === 0) {
    return <span className="text-muted-foreground">Unknown champion</span>
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {champions.map((champion, index) => (
        <span key={`${champion.wrestlerId ?? champion.name ?? index}-${index}`}>
          {index > 0 ? ', ' : null}
          {champion.linkable && champion.wrestlerId ? (
            <Link
              to="/wrestlers/$wrestlerId"
              params={{ wrestlerId: champion.wrestlerId }}
              search={{ tab: 'profile', page: 1 }}
              className="font-medium hover:underline"
            >
              {champion.name}
            </Link>
          ) : (
            champion.name
          )}
        </span>
      ))}
    </span>
  )
}

function HolderName({ holder }: { holder: TitleStatsHolderRecord }) {
  if (holder.linkable && holder.wrestlerId) {
    return (
      <Link
        to="/wrestlers/$wrestlerId"
        params={{ wrestlerId: holder.wrestlerId }}
        search={{ tab: 'profile', page: 1 }}
        className="font-medium hover:underline"
      >
        {holder.name}
      </Link>
    )
  }
  return <>{holder.name ?? 'Unknown'}</>
}

function TitleDetailsTab({
  titleId,
  reignCount,
}: {
  titleId: string
  reignCount: number
}) {
  const { data, isLoading } = useQuery(titleStatsQueryOptions(titleId))

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {reignCount === 0
          ? 'No title reigns on record.'
          : 'Title statistics are not available yet.'}
      </p>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Title statistics</h2>
        <p className="text-sm text-muted-foreground">
          Aggregated from {numberFmt.format(data.reignCount)}{' '}
          {data.reignCount === 1 ? 'reign' : 'reigns'}. Refreshed every 10
          minutes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatSummaryCard label="Total reigns" value={numberFmt.format(data.reignCount)} />
        <StatSummaryCard
          label="Total defenses"
          value={numberFmt.format(data.totalDefenses)}
        />
        <StatSummaryCard
          label="Unique champions"
          value={numberFmt.format(data.uniqueChampions)}
        />
        <StatSummaryCard
          label="Average reign"
          value={formatAvgDays(data.avgReignDays)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ReignRecordCard
          title="Longest reign"
          record={data.longestReign}
          valueLabel={(value) => formatDays(value)}
        />
        <ReignRecordCard
          title="Shortest reign"
          record={data.shortestReign}
          valueLabel={(value) => formatDays(value)}
        />
        <ReignRecordCard
          title="Most defenses (single reign)"
          record={data.mostDefenses}
          valueLabel={(value) =>
            `${numberFmt.format(value)} ${value === 1 ? 'defense' : 'defenses'}`
          }
        />
        {data.mostTimesHeld && (
          <HolderRecordCard
            title="Most times held"
            holder={data.mostTimesHeld}
            highlight={`${numberFmt.format(data.mostTimesHeld.reignsHeld)} ${
              data.mostTimesHeld.reignsHeld === 1 ? 'reign' : 'reigns'
            }`}
          />
        )}
        {data.mostDaysHeld && (
          <HolderRecordCard
            title="Most combined days held"
            holder={data.mostDaysHeld}
            highlight={formatDays(data.mostDaysHeld.totalDays)}
          />
        )}
      </div>

      {data.topHolders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Most reigns held</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Champion</TableHead>
                  <TableHead className="w-24 text-right">Reigns</TableHead>
                  <TableHead className="hidden w-32 text-right sm:table-cell">
                    Days
                  </TableHead>
                  <TableHead className="hidden w-32 text-right md:table-cell">
                    Defenses
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topHolders.map((holder, index) => (
                  <TableRow key={`${holder.wrestlerId ?? holder.name ?? index}-${index}`}>
                    <TableCell>
                      <HolderName holder={holder} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(holder.reignsHeld)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {numberFmt.format(holder.totalDays)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {numberFmt.format(holder.totalDefenses)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  )
}

function StatSummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function ReignRecordCard({
  title,
  record,
  valueLabel,
}: {
  title: string
  record: TitleStatsReignRecord | null
  valueLabel: (value: number) => string
}) {
  if (!record) return null

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pt-0">
        <p className="text-2xl font-semibold tabular-nums">
          {valueLabel(record.value)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary" className="tabular-nums">
            Reign {record.reignNumber}
          </Badge>
          <StatsChampionNames champions={record.champions} />
        </div>
      </CardContent>
    </Card>
  )
}

function HolderRecordCard({
  title,
  holder,
  highlight,
}: {
  title: string
  holder: TitleStatsHolderRecord
  highlight: string
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pt-0">
        <p className="text-2xl font-semibold tabular-nums">{highlight}</p>
        <p className="text-sm">
          <HolderName holder={holder} />
          <span className="text-muted-foreground">
            {' '}
            · {formatDays(holder.totalDays)} ·{' '}
            {numberFmt.format(holder.totalDefenses)}{' '}
            {holder.totalDefenses === 1 ? 'defense' : 'defenses'}
          </span>
        </p>
      </CardContent>
    </Card>
  )
}

function TitleSdhHistoryTab({ sdh }: { sdh: SdhTitleProfile | null }) {
  const entries = sdh?.nameHistory ?? []

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No name or belt design history on record.
      </p>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Name &amp; belt history</h2>
        <span className="text-sm text-muted-foreground">
          {numberFmt.format(entries.length)}{' '}
          {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={`${entry.seq}-${entry.name}`} className="gap-0 py-4">
            <CardContent className="flex items-center gap-4 px-4">
              {entry.image_url ? (
                <img
                  src={entry.image_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-24 w-auto max-w-36 shrink-0 object-contain"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Trophy className="size-8 text-amber-500/70" />
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <p className="font-semibold leading-tight">{entry.name}</p>
                <p className="text-sm text-muted-foreground">
                  {displayDateRange(entry.from_date, entry.to_date)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function displayDateRange(from: string | null, to: string | null) {
  if (from && to) return `${from} – ${to}`
  if (from) return `${from} – Present`
  if (to) return `Until ${to}`
  return 'Date unknown'
}

function ReignCard({ titleId, reign }: { titleId: string; reign: TitleReign }) {
  const dateRange = [reign.fromDate, reign.toDate ?? 'present']
    .filter(Boolean)
    .join(' – ')

  const reignLabel = [
    ...new Set(
      reign.champions
        .map((c) => formatChampionReignLabel(c.resolvedReignNumber))
        .filter((label): label is string => !!label),
    ),
  ].join(' · ')

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
    { icon: Trophy, value: reignLabel || null },
  ]

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 px-4 pb-0">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {reign.reignNumber}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          {reign.champions.length === 0 ? (
            <span className="text-muted-foreground">Unknown champion</span>
          ) : (
            reign.champions.map((c, i) => (
              <WrestlerPortrait
                key={`${c.wrestlerId ?? c.name}-${i}`}
                wrestlerId={c.wrestlerId}
                name={c.name}
                linkable={c.linkable}
                imageUrl={c.imageUrl}
                size="md"
              />
            ))
          )}
        </div>
        {reign.teamName && (
          <Badge variant="outline" className="ml-auto">
            {reign.teamName}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2 px-4 pt-0">
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
        <ReignDefensesCollapsible titleId={titleId} reign={reign} />
      </CardContent>
    </Card>
  )
}

function ReignDefensesCollapsible({
  titleId,
  reign,
}: {
  titleId: string
  reign: TitleReign
}) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, isFetching } = useQuery({
    ...titleReignDefensesQueryOptions(titleId, reign.id),
    enabled: open,
  })

  if (reign.defenseCount === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Shield className="size-4" />
        <span>
          {reign.defenseCount}{' '}
          {reign.defenseCount === 1 ? 'title defense' : 'title defenses'}
        </span>
        <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {isLoading || isFetching ? (
          <div
            className="space-y-2 overflow-y-auto overscroll-y-contain pr-1"
            style={{ maxHeight: DEFENSE_LIST_MAX_HEIGHT }}
          >
            {Array.from({ length: Math.min(reign.defenseCount, 3) }).map(
              (_, i) => (
                <Skeleton key={i} className="defense-match-card h-36 w-full" />
              ),
            )}
          </div>
        ) : (
          <div
            className="space-y-2 overflow-y-auto overscroll-y-contain pr-1"
            style={{ maxHeight: DEFENSE_LIST_MAX_HEIGHT }}
          >
            {(data ?? []).map((defense) => (
              <DefenseRow key={defense.matchId} defense={defense} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function DefenseRow({ defense }: { defense: TitleReignDefense }) {
  const date = formatChangeDate(defense.eventDate, defense.dateText)
  const winners = defense.participants.filter((p) => p.sideRole === 'winner')
  const losers = defense.participants.filter((p) => p.sideRole === 'loser')
  const hasWinner = winners.length > 0
  const hasLoser = losers.length > 0
  const connector = hasWinner && hasLoser ? 'def.' : 'vs'

  return (
    <div className="defense-match-card min-h-36 rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {defense.defenseNumber}
          {ordinalSuffix(defense.defenseNumber)} defense
        </Badge>
        {defense.matchType && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {defense.matchType}
          </span>
        )}
      </div>

      {defense.participants.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          {hasWinner && (
            <div className="flex flex-wrap items-center gap-3">
              {winners.map((p, i) => (
                <WrestlerPortrait
                  key={`w-${p.wrestlerId ?? p.name}-${i}`}
                  wrestlerId={p.wrestlerId}
                  name={p.name}
                  linkable={p.linkable}
                  imageUrl={p.imageUrl}
                  size="sm"
                />
              ))}
            </div>
          )}
          {(hasWinner || hasLoser) && (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {connector}
            </span>
          )}
          {hasLoser && (
            <div className="flex flex-wrap items-center gap-3 opacity-80">
              {losers.map((p, i) => (
                <WrestlerPortrait
                  key={`l-${p.wrestlerId ?? p.name}-${i}`}
                  wrestlerId={p.wrestlerId}
                  name={p.name}
                  linkable={p.linkable}
                  imageUrl={p.imageUrl}
                  size="sm"
                />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-muted-foreground">
        <Link
          to="/events/$eventId"
          params={{ eventId: defense.eventId }}
          className="font-medium text-foreground hover:underline"
        >
          {defense.eventName}
        </Link>
        {date ? <> · {date}</> : null}
      </p>
    </div>
  )
}

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '')
  return letters.toUpperCase() || '?'
}

function WrestlerPortrait({
  wrestlerId,
  name,
  linkable,
  imageUrl,
  size,
}: {
  wrestlerId: string | null
  name: string | null
  linkable: boolean
  imageUrl: string | null
  size: 'sm' | 'md'
}) {
  const label =
    linkable && wrestlerId ? (
      <Link
        to="/wrestlers/$wrestlerId"
        params={{ wrestlerId }}
        search={{ tab: 'profile', page: 1 }}
        className="hover:underline"
      >
        {name}
      </Link>
    ) : (
      name
    )

  const imageHeight = size === 'md' ? 'h-28' : 'h-20'
  const maxWidth = size === 'md' ? 'max-w-40' : 'max-w-32'
  const nameClass = size === 'md' ? 'text-base font-semibold' : 'text-sm font-medium'

  return (
    <div className="flex items-center gap-3">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name ?? ''}
          referrerPolicy="no-referrer"
          className={`${imageHeight} w-auto ${maxWidth} shrink-0 object-contain object-bottom`}
        />
      ) : (
        <div
          className={`flex ${imageHeight} w-16 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium`}
        >
          {initials(name)}
        </div>
      )}
      <span className={`${nameClass} leading-tight`}>{label}</span>
    </div>
  )
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  switch (n % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
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