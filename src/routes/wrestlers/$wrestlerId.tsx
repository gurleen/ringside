import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import {
  keepPreviousData,
  useQueryClient,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  wrestlerAdjacentMatchesQueryOptions,
  wrestlerMatchesQueryOptions,
  wrestlerQueryOptions,
  wrestlersQueryOptions,
} from '#/lib/wrestling'
import type {
  WrestlerDetail,
  WrestlerMatch,
  WrestlerMatchOutcome,
} from '#/lib/wrestling'
import {
  rivalryKeyFromIds,
  rivalryMatchesQueryOptions,
  rivalryQueryOptions,
} from '#/lib/rivalries'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
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
import { MatchResultText } from '#/components/match-result-text'
import { SpoilerWinner } from '#/components/spoiler-winner'

type WrestlerTab = 'profile' | 'history' | 'matches' | 'rivalries'

function parseWrestlerTab(value: unknown): WrestlerTab {
  if (
    value === 'matches' ||
    value === 'history' ||
    value === 'rivalries'
  ) {
    return value
  }
  return 'profile'
}

interface WrestlerSearch {
  tab: WrestlerTab
  page: number
  opponent?: string
}

export const Route = createFileRoute('/wrestlers/$wrestlerId')({
  validateSearch: (search: Record<string, unknown>): WrestlerSearch => ({
    tab: parseWrestlerTab(search.tab),
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
    opponent:
      typeof search.opponent === 'string' && search.opponent.trim()
        ? search.opponent.trim()
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    page: search.page,
    opponent: search.opponent,
  }),
  loader: async ({ context, params, deps, cause }) => {
    const detail = await context.queryClient.ensureQueryData(
      wrestlerQueryOptions(params.wrestlerId),
    )
    if (!detail) throw notFound()

    // Previous/next bouts power the Profile tab; cheap (≤2 matches) so load
    // with the detail on first paint and prefetch on same-route navigations.
    const adjacent = wrestlerAdjacentMatchesQueryOptions(params.wrestlerId)
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(adjacent)
    } else {
      await context.queryClient.ensureQueryData(adjacent)
    }

    if (deps.tab === 'matches') {
      const options = wrestlerMatchesQueryOptions(params.wrestlerId, deps.page)
      // Same-route navigations (tab switch, pagination) must not block, or
      // the router swaps in the full-page pending skeleton. keepPreviousData
      // in the component keeps the previous rows visible while loading.
      if (cause === 'stay') {
        void context.queryClient.prefetchQuery(options)
      } else {
        await context.queryClient.ensureQueryData(options)
      }
    }

    if (deps.tab === 'rivalries' && deps.opponent) {
      const ids = [params.wrestlerId, deps.opponent]
      const rivalry = rivalryQueryOptions(ids)
      const matches = rivalryMatchesQueryOptions(
        ids,
        deps.page,
        params.wrestlerId,
      )
      if (cause === 'stay') {
        void context.queryClient.prefetchQuery(rivalry)
        void context.queryClient.prefetchQuery(matches)
      } else {
        await context.queryClient.ensureQueryData(rivalry)
        await context.queryClient.ensureQueryData(matches)
      }
    }
  },
  component: WrestlerDetailPage,
  pendingComponent: WrestlerDetailSkeleton,
  pendingMs: 100,
  notFoundComponent: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">Wrestler not found.</p>
      <BackLink />
    </div>
  ),
})

const numberFmt = new Intl.NumberFormat('en-US')

function BackLink() {
  return (
    <Link
      to="/wrestlers"
      search={{ q: '', page: 1 }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to wrestlers
    </Link>
  )
}

function WrestlerDetailSkeleton() {
  return (
    <div className="space-y-6">
      <BackLink />

      <Card className="gap-0 py-4">
        <CardContent className="space-y-4 px-4">
          {/* Mirrors the header: stacked and centered on mobile, row on sm+. */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-1 sm:flex-row sm:items-start">
              {/* Gallery headshots are square; carousel is fixed at h-40 w-40. */}
              <Skeleton className="h-40 w-40 shrink-0" />
              <div className="flex flex-col items-center space-y-2 sm:items-start">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tab bar is full-width on mobile, fit-content on sm+. */}
      <Skeleton className="h-9 w-full sm:w-48" />

      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function WrestlerDetailPage() {
  const { wrestlerId } = Route.useParams()
  const { tab, page, opponent } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<WrestlerTab>(tab)
  const { data } = useSuspenseQuery(wrestlerQueryOptions(wrestlerId))
  // Loader guarantees non-null (throws notFound otherwise).
  const detail = data as WrestlerDetail
  const { wrestler, sdh, attributes, roles } = detail
  const sdhWrestler = sdh?.wrestler

  const facts: Array<[string, string | null]> = [
    ['Real name', sdhWrestler?.real_name ?? null],
    ['Nationality', sdhWrestler?.nationality ?? null],
    ['Billed from', sdhWrestler?.billed_from ?? null],
    ['Gender', wrestler.gender ?? sdhWrestler?.gender ?? null],
    [
      'Age',
      wrestler.age != null
        ? String(wrestler.age)
        : sdhWrestler?.age != null
          ? String(sdhWrestler.age)
          : null,
    ],
    ['Birthday', wrestler.birthday ?? sdhWrestler?.birthday ?? null],
    ['Birthplace', wrestler.birthplace ?? sdhWrestler?.birthplace ?? null],
    [
      'Height',
      wrestler.height_cm != null
        ? `${wrestler.height_cm} cm`
        : sdhWrestler?.height_cm != null
          ? `${sdhWrestler.height_cm} cm`
          : null,
    ],
    [
      'Weight',
      wrestler.weight_kg != null
        ? `${wrestler.weight_kg} kg`
        : sdhWrestler?.weight_kg != null
          ? `${sdhWrestler.weight_kg} kg`
          : null,
    ],
    ['Career start', wrestler.career_start],
    ['Career end', wrestler.career_end],
    [
      'Experience',
      wrestler.career_experience_years != null
        ? `${wrestler.career_experience_years} yrs`
        : null,
    ],
    ['Current brand', wrestler.current_brand],
    [
      'Career shows',
      wrestler.career_shows != null ? String(wrestler.career_shows) : null,
    ],
  ]

  const currentSdhPromotions =
    sdh?.promotions.filter((item) => item.to_date == null) ?? []
  const currentSdhRoles =
    sdh?.roles.filter((item) => item.to_date == null) ?? []
  const currentAlignment =
    sdh?.alignments.find((item) => item.to_date == null) ?? null
  const roleNames = Array.from(
    new Set(
      roles.length > 0
        ? roles.map((role) => role.role)
        : currentSdhRoles.map((role) => role.role),
    ),
  )
  // Prefer the SDH string because it carries brand info (e.g. "WWE · Raw").
  const currentPromotionLabel =
    currentSdhPromotions.length > 0
      ? currentSdhPromotions
          .map((item) =>
            item.brand ? `${item.promotion} · ${item.brand}` : item.promotion,
          )
          .join(', ')
      : wrestler.current_promotion
  const currentRolesLabel = Array.from(
    new Set(currentSdhRoles.map((item) => item.role)),
  ).join(', ')
  const nicknames = resolveNicknames(sdh?.attributes ?? [], attributes)
  const visibleFacts = facts.filter(([, value]) => value)

  // Keep URL/back-forward navigation authoritative while allowing tab clicks
  // to update immediately instead of waiting for the router transition.
  useEffect(() => {
    setActiveTab(tab)
  }, [tab])

  // Match history is the only tab that needs an additional request. Warm its
  // first page after the detail renders so the first click usually has data.
  useEffect(() => {
    void queryClient.prefetchQuery(wrestlerMatchesQueryOptions(wrestlerId, 1))
  }, [queryClient, wrestlerId])

  return (
    <div className="space-y-6">
      <BackLink />

      <Card className="gap-0 py-4">
        <CardContent className="space-y-4 px-4">
          {/* Mobile: stacked and centered. sm+: unchanged side-by-side row. */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-1 sm:basis-64 sm:flex-row sm:items-start">
              <HeadshotCarousel
                images={sdh?.images ?? []}
                fallbackUrl={sdhWrestler?.image_url ?? null}
                wrestlerName={wrestler.name}
              />
              <div className="min-w-0 space-y-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {wrestler.name}
                  </h1>
                  {currentAlignment && (
                    <Badge variant="secondary">
                      {currentAlignment.alignment}
                    </Badge>
                  )}
                </div>
                {nicknames.length > 0 && (
                  <CyclingNickname nicknames={nicknames} />
                )}
                {currentRolesLabel && (
                  <p className="text-sm text-muted-foreground">
                    {currentRolesLabel}
                  </p>
                )}
                {roleNames.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
                    {roleNames.map((r) => (
                      <Badge key={r} variant="outline">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Badge>{currentPromotionLabel || 'Free agent'}</Badge>
          </div>

          {visibleFacts.length > 0 && (
            <>
              <Separator />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                {visibleFacts.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd
                      className="truncate text-sm font-medium"
                      title={value ?? undefined}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = parseWrestlerTab(value)
          setActiveTab(nextTab)
          void navigate({
            search: {
              tab: nextTab,
              page: 1,
              opponent: nextTab === 'rivalries' ? opponent : undefined,
            },
            // Same-page tab change; don't let scrollRestoration jump to top.
            resetScroll: false,
          })
        }}
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="rivalries">Rivalries</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <AttributesCard
            sdhAttributes={sdh?.attributes ?? []}
            cagematchAttributes={attributes}
          />
          <AdjacentMatches wrestlerId={wrestlerId} />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <SdhHistories sdh={sdh} />
        </TabsContent>

        <TabsContent value="matches" className="pt-4">
          <WrestlerMatchesTab wrestlerId={wrestlerId} page={page} />
        </TabsContent>

        <TabsContent value="rivalries" className="pt-4">
          <WrestlerRivalriesTab
            wrestlerId={wrestlerId}
            wrestlerName={wrestler.name}
            opponentId={opponent}
            page={page}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type SdhProfile = NonNullable<WrestlerDetail['sdh']>

/** SDH nicknames win; otherwise fall back to Cagematch `nickname` attributes. */
function resolveNicknames(
  sdhAttributes: SdhProfile['attributes'],
  cagematchAttributes: WrestlerDetail['attributes'],
): Array<string> {
  const sdhNicknames = sdhAttributes
    .filter((item) => item.attr_type === 'nickname')
    .map((item) => item.value)
  if (sdhNicknames.length > 0) return sdhNicknames
  return cagematchAttributes
    .filter((item) => item.attr_type === 'nickname')
    .map((item) => item.value)
}

function CyclingNickname({ nicknames }: { nicknames: Array<string> }) {
  const [{ index, prevIndex }, setState] = useState<{
    index: number
    prevIndex: number | null
  }>({ index: 0, prevIndex: null })
  // Join so the effect only restarts when the nickname list contents change,
  // not on every parent re-render that allocates a fresh array.
  const nicknameKey = nicknames.join('\0')

  useEffect(() => {
    setState({ index: 0, prevIndex: null })
    const list = nicknameKey === '' ? [] : nicknameKey.split('\0')
    if (list.length <= 1) return
    const id = window.setInterval(() => {
      setState((s) => ({
        index: (s.index + 1) % list.length,
        prevIndex: s.index,
      }))
    }, 5000)
    return () => window.clearInterval(id)
  }, [nicknameKey])

  const nickname = nicknames[index] ?? nicknames[0]
  if (!nickname) return null
  const previousNickname = prevIndex != null ? nicknames[prevIndex] : null

  return (
    <p
      className="relative text-sm italic text-muted-foreground"
      aria-live="polite"
    >
      {/* Keyed spans restart their animations on every cycle: the new
          nickname fades in while the old one fades out on top of it. */}
      <span key={`in-${index}`} className="animate-in fade-in duration-700">
        &ldquo;{nickname}&rdquo;
      </span>
      {previousNickname && (
        <span
          key={`out-${prevIndex}`}
          aria-hidden
          className="absolute inset-y-0 left-0 animate-out fade-out fill-mode-forwards duration-700"
        >
          &ldquo;{previousNickname}&rdquo;
        </span>
      )}
    </p>
  )
}

/**
 * Merged SDH + Cagematch attribute card. Finishers prefer SDH (falling back
 * to Cagematch `signature_move`); remaining Cagematch-only groups follow.
 * Nicknames and active role are omitted — they already appear in the header.
 */
function AttributesCard({
  sdhAttributes,
  cagematchAttributes,
}: {
  sdhAttributes: SdhProfile['attributes']
  cagematchAttributes: WrestlerDetail['attributes']
}) {
  const cagematchGroups = new Map<string, Array<string>>()
  for (const attr of cagematchAttributes) {
    const values = cagematchGroups.get(attr.attr_type)
    if (values) values.push(attr.value)
    else cagematchGroups.set(attr.attr_type, [attr.value])
  }

  const sdhFinishers = sdhAttributes
    .filter((item) => item.attr_type === 'finisher')
    .map((item) => item.value)
  const finishers =
    sdhFinishers.length > 0
      ? sdhFinishers
      : (cagematchGroups.get('signature_move') ?? [])

  const omittedTypes = new Set(['nickname', 'signature_move', 'active_role'])
  const sections: Array<[string, Array<string>]> = [
    ['Finishers', finishers] as [string, Array<string>],
    ...Array.from(cagematchGroups.entries())
      .filter(([type]) => !omittedTypes.has(type))
      .map(([type, values]): [string, Array<string>] => [
        type.replace(/_/g, ' '),
        values,
      ]),
  ].filter(([, values]) => values.length > 0)

  if (sections.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Attributes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {sections.map(([label, values]) => (
          <AttributeBadges key={label} label={label} values={values} />
        ))}
      </CardContent>
    </Card>
  )
}

function AttributeBadges({
  label,
  values,
}: {
  label: string
  values: Array<string>
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium capitalize">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value, index) => (
          <Badge key={`${value}-${index}`} variant="outline">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function AdjacentMatches({ wrestlerId }: { wrestlerId: string }) {
  const { data } = useSuspenseQuery(
    wrestlerAdjacentMatchesQueryOptions(wrestlerId),
  )
  if (!data.previous && !data.next) return null

  return (
    <div
      className={cn(
        'grid gap-4',
        data.previous && data.next ? 'sm:grid-cols-2' : 'grid-cols-1',
      )}
    >
      {data.previous && (
        <AdjacentMatchCard label="Previous match" match={data.previous} />
      )}
      {data.next && <AdjacentMatchCard label="Next match" match={data.next} />}
    </div>
  )
}

function AdjacentMatchCard({
  label,
  match,
}: {
  label: string
  match: WrestlerMatch
}) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{label}</CardTitle>
          <OutcomeBadge outcome={match.outcome} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          {formatEventDate(match.event.eventDate, match.event.date)}
          {(match.event.promotionLabel || match.matchType) && (
            <>
              {' · '}
              {[match.event.promotionLabel, match.matchType]
                .filter(Boolean)
                .join(' · ')}
            </>
          )}
        </p>
        <Link
          to="/events/$eventId"
          params={{ eventId: match.event.id }}
          className="font-medium hover:underline"
        >
          {match.event.name ?? 'Untitled event'}
        </Link>
        <MatchSummary match={match} />
      </CardContent>
    </Card>
  )
}

function SdhHistories({ sdh }: { sdh: SdhProfile | null }) {
  const sections = sdh
    ? [
        {
          title: 'Ring-name history',
          rows: sdh.nameHistory.map((item) => ({
            primary: item.name,
            secondary: displayDateRange(item.from_date, item.to_date),
          })),
        },
        {
          title: 'Promotion & brand history',
          rows: sdh.promotions.map((item) => ({
            primary: item.brand
              ? `${item.promotion} · ${item.brand}`
              : item.promotion,
            secondary: displayDateRange(item.from_date, item.to_date),
          })),
        },
        {
          title: 'Role history',
          rows: sdh.roles.map((item) => ({
            primary: item.role,
            secondary: displayDateRange(item.from_date, item.to_date),
          })),
        },
        {
          title: 'Face / heel history',
          rows: sdh.alignments.map((item) => ({
            primary: item.alignment,
            secondary: displayDateRange(item.from_date, item.to_date),
            details: item.details,
          })),
        },
      ].filter((section) => section.rows.length > 0)
    : []

  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No career history on record.
      </p>
    )
  }

  return (
    // CSS columns (not grid) so cards pack masonry-style without the
    // row-height gaps a grid leaves next to tall cards.
    <div className="md:columns-2 md:gap-4">
      {sections.map((section) => (
        <HistorySection
          key={section.title}
          title={section.title}
          rows={section.rows}
        />
      ))}
    </div>
  )
}

function HistorySection({
  title,
  rows,
}: {
  title: string
  rows: Array<{
    primary: string
    secondary: string
    details?: string | null
  }>
}) {
  return (
    <Card className="mb-4 break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="ml-1 border-l pl-4">
          {rows.map((row, index) => (
            <li
              key={`${row.primary}-${row.secondary}-${index}`}
              className="relative py-2 text-sm before:absolute before:top-4 before:left-[-1.18rem] before:size-2 before:rounded-full before:bg-border"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-medium">{row.primary}</span>
                <span className="text-xs text-muted-foreground">
                  {row.secondary}
                </span>
              </div>
              {row.details && (
                <p className="mt-1 text-muted-foreground">{row.details}</p>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function displayDateRange(from: string | null, to: string | null) {
  if (from && to) return `${from} – ${to}`
  if (from) return `${from} – Present`
  if (to) return `Until ${to}`
  return 'Date unknown'
}

function HeadshotCarousel({
  images,
  fallbackUrl,
  wrestlerName,
}: {
  images: SdhProfile['images']
  fallbackUrl: string | null
  wrestlerName: string
}) {
  const slides =
    images.length > 0
      ? images
      : fallbackUrl
        ? [
            {
              image_url: fallbackUrl,
              label: null,
              seq: 0,
              wrestler_id: '',
            },
          ]
        : []
  const [index, setIndex] = useState(0)
  const slideKey = slides.map((s) => s.image_url).join('\0')

  useEffect(() => {
    setIndex(0)
  }, [slideKey])

  if (slides.length === 0) return null

  const safeIndex = Math.min(index, slides.length - 1)
  const slide = slides[safeIndex]
  const isOlder = safeIndex > 0
  const canCycle = slides.length > 1

  const caption = isOlder
    ? slide.label
    : slide.label
      ? `Current · ${slide.label}`
      : 'Current'

  return (
    <div className="w-40 shrink-0 space-y-1.5">
      <div className="group relative">
        <img
          src={slide.image_url}
          alt={slide.label ? `${wrestlerName}, ${slide.label}` : wrestlerName}
          // SDH blocks hotlinking via Referer checks; omitting the
          // header entirely is allowed.
          referrerPolicy="no-referrer"
          className="h-40 w-40 object-cover object-top"
        />
        {canCycle && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-1/2 left-2 size-7 -translate-y-1/2 opacity-15 transition-opacity group-hover:opacity-90"
              aria-label="Previous headshot"
              onClick={() =>
                setIndex((i) => (i - 1 + slides.length) % slides.length)
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-1/2 right-2 size-7 -translate-y-1/2 opacity-15 transition-opacity group-hover:opacity-90"
              aria-label="Next headshot"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        )}
      </div>
      {caption && (
        <p className="text-center text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  )
}

function WrestlerRivalriesTab({
  wrestlerId,
  wrestlerName,
  opponentId,
  page,
}: {
  wrestlerId: string
  wrestlerName: string
  opponentId?: string
  page: number
}) {
  const navigate = useNavigate({ from: Route.fullPath })
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [spoilers, setSpoilers] = useState(false)
  const [includeOthers, setIncludeOthers] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(id)
  }, [query])

  const { data: suggestions, isFetching: suggestionsLoading } = useQuery({
    ...wrestlersQueryOptions(debounced, 1),
    enabled: debounced.length >= 2,
  })

  const rivalryIds = opponentId ? [wrestlerId, opponentId] : []
  const { data: rivalry } = useQuery({
    ...rivalryQueryOptions(rivalryIds),
    enabled: !!opponentId,
  })
  const { data, isPlaceholderData, isFetching } = useQuery({
    ...rivalryMatchesQueryOptions(
      rivalryIds,
      page,
      wrestlerId,
      includeOthers,
    ),
    enabled: !!opponentId,
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

  const opponent = rivalry?.wrestlers.find((w) => w.id === opponentId)
  const filteredSuggestions =
    suggestions?.wrestlers.filter((w) => w.id !== wrestlerId) ?? []
  // No data yet (including after an includeOthers toggle with no cache).
  const showTableSkeleton = !data
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1
  const showSuggestions =
    debounced.length >= 2 && !opponentId && (suggestionsLoading || !!suggestions)

  function selectOpponent(id: string) {
    setQuery('')
    setDebounced('')
    void navigate({
      search: { tab: 'rivalries', opponent: id, page: 1 },
      resetScroll: false,
    })
  }

  function clearOpponent() {
    setQuery('')
    setDebounced('')
    void navigate({
      search: { tab: 'rivalries', page: 1, opponent: undefined },
      resetScroll: false,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Rivalries</h2>
        <p className="text-sm text-muted-foreground">
          Search for a wrestler to see every match between them and{' '}
          {wrestlerName}.
        </p>
      </div>

      {opponentId && rivalry === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Opponent not found.
          </p>
          <Button variant="ghost" size="sm" onClick={clearOpponent}>
            Change
          </Button>
        </div>
      ) : opponentId && opponent ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">
              {wrestlerName}{' '}
              <span className="text-muted-foreground">vs</span> {opponent.name}
            </p>
            {data ? (
              <p className="text-xs text-muted-foreground">
                {numberFmt.format(data.total)}{' '}
                {data.total === 1 ? 'match' : 'matches'}
              </p>
            ) : (
              <Skeleton className="h-4 w-20" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/rivalries/$rivalryKey"
                params={{ rivalryKey: rivalryKeyFromIds(rivalryIds) }}
                search={{ page: 1 }}
              >
                Open rivalry page
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={clearOpponent}>
              Change
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative max-w-md space-y-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a wrestler name…"
            autoComplete="off"
            aria-label="Search opponent"
          />
          {showSuggestions && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
              {filteredSuggestions.length === 0 && !suggestionsLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No wrestlers found.
                </p>
              ) : (
                <ul>
                  {filteredSuggestions.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => selectOpponent(w.id)}
                      >
                        {w.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!opponentId && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Type at least two characters to search for an opponent.
        </p>
      )}

      {opponentId && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="rivalries-include-others"
                checked={includeOthers}
                disabled={isFetching}
                onCheckedChange={(checked) => {
                  setIncludeOthers(checked)
                  if (page !== 1) {
                    void navigate({
                      search: {
                        tab: 'rivalries',
                        opponent: opponentId,
                        page: 1,
                      },
                    })
                  }
                }}
              />
              <Label htmlFor="rivalries-include-others" className="text-sm">
                Include matches with others
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="rivalries-spoilers"
                checked={spoilers}
                onCheckedChange={setSpoilers}
              />
              <Label htmlFor="rivalries-spoilers" className="text-sm">
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
                  <TableHead>Winner</TableHead>
                  <TableHead className="hidden w-32 sm:table-cell">
                    Date
                  </TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="hidden md:table-cell">Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showTableSkeleton || !data ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-28" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-48 max-w-full" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-5 w-56" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data.matches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No matches between these wrestlers.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.matches.map((match) => (
                    <RivalryMatchRow
                      key={match.id}
                      match={{
                        ...match,
                        outcome: match.outcome ?? 'draw',
                      }}
                      spoilers={spoilers}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {opponentId && data && data.total > data.pageSize && (
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
                  search: (prev) => ({
                    ...prev,
                    tab: 'rivalries',
                    opponent: opponentId,
                    page: page - 1,
                  }),
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
                  search: (prev) => ({
                    ...prev,
                    tab: 'rivalries',
                    opponent: opponentId,
                    page: page + 1,
                  }),
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

function WrestlerMatchesTab({
  wrestlerId,
  page,
}: {
  wrestlerId: string
  page: number
}) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { data, isPlaceholderData } = useQuery({
    ...wrestlerMatchesQueryOptions(wrestlerId, page),
    placeholderData: keepPreviousData,
  })
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Match history</h2>
        {data && (
          <span className="text-sm text-muted-foreground">
            {numberFmt.format(data.total)}{' '}
            {data.total === 1 ? 'match' : 'matches'}
          </span>
        )}
      </div>

      <div
        className={cn(
          'rounded-lg border transition-opacity',
          isPlaceholderData && 'opacity-60',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Result</TableHead>
              <TableHead className="hidden w-32 sm:table-cell">Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="hidden md:table-cell">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    {/* Match the real cell: date line below sm, result line
                        below md, event + promotion lines at every size. */}
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20 sm:hidden" />
                      <Skeleton className="h-5 w-48 max-w-full" />
                      <Skeleton className="h-4 w-40 max-w-full md:hidden" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-5 w-56" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell" />
                </TableRow>
              ))
            ) : data.matches.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No matches on record.
                </TableCell>
              </TableRow>
            ) : (
              data.matches.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))
            )}
          </TableBody>
        </Table>
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
                  search: (prev) => ({
                    ...prev,
                    tab: 'matches',
                    page: page - 1,
                  }),
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
                  search: (prev) => ({
                    ...prev,
                    tab: 'matches',
                    page: page + 1,
                  }),
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

function RivalryMatchRow({
  match,
  spoilers,
}: {
  match: WrestlerMatch
  spoilers: boolean
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <SpoilerWinner
          winners={match.winners}
          finishNote={match.finishNote}
          result={match.result}
          spoilers={spoilers}
        />
      </TableCell>
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
          <div className="flex flex-wrap items-center gap-1.5 md:hidden">
            <MatchSummary match={match} showResult={false} />
          </div>
          {(match.event.promotionLabel || match.matchType) && (
            <p className="text-xs text-muted-foreground">
              {[match.event.promotionLabel, match.matchType]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden whitespace-normal md:table-cell">
        <MatchSummary match={match} showResult={false} />
      </TableCell>
    </TableRow>
  )
}

function MatchRow({ match }: { match: WrestlerMatch }) {
  return (
    <TableRow>
      <TableCell>
        <OutcomeBadge outcome={match.outcome} />
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
        {formatEventDate(match.event.eventDate, match.event.date)}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="space-y-0.5">
          {/* Date column is hidden on mobile, so surface it here instead. */}
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
          <div className="flex flex-wrap items-center gap-1.5 md:hidden">
            <MatchSummary match={match} />
          </div>
          {(match.event.promotionLabel || match.matchType) && (
            <p className="text-xs text-muted-foreground">
              {[match.event.promotionLabel, match.matchType]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden whitespace-normal md:table-cell">
        <MatchSummary match={match} />
      </TableCell>
    </TableRow>
  )
}

function MatchSummary({
  match,
  showResult = true,
}: {
  match: WrestlerMatch
  showResult?: boolean
}) {
  const hasResult =
    match.winners.length > 0 ||
    match.losers.length > 0 ||
    match.sides.length > 0

  return (
    <div className="space-y-1">
      {showResult && hasResult && (
        <p className="text-sm">
          <MatchResultText
            winners={match.winners}
            losers={match.losers}
            sides={match.sides}
          />
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
  )
}

function OutcomeBadge({ outcome }: { outcome: WrestlerMatchOutcome }) {
  const label = outcome === 'win' ? 'Win' : outcome === 'loss' ? 'Loss' : '—'
  const variant =
    outcome === 'win' ? 'default' : outcome === 'loss' ? 'secondary' : 'outline'
  return (
    <Badge variant={variant} className="tabular-nums">
      {label}
    </Badge>
  )
}
