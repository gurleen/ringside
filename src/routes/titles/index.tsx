import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Trophy } from 'lucide-react'
import { titlePromotionsQueryOptions, titlesQueryOptions } from '#/lib/titles'
import type { EnrichedTitle, TitleStatus } from '#/lib/titles'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { Card, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

interface TitleSearch {
  q: string
  page: number
  promotion: string
  status: TitleStatus
}

const ALL_PROMOTIONS = 'all'
const ALL_STATUS = 'all'

export const Route = createFileRoute('/titles/')({
  validateSearch: (search: Record<string, unknown>): TitleSearch => ({
    q: typeof search.q === 'string' ? search.q : '',
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
    promotion: typeof search.promotion === 'string' ? search.promotion : '',
    status:
      search.status === 'active' || search.status === 'inactive'
        ? search.status
        : 'all',
  }),
  loaderDeps: ({ search }) => ({
    q: search.q,
    page: search.page,
    promotion: search.promotion,
    status: search.status,
  }),
  loader: async ({ context, deps, cause }) => {
    const options = titlesQueryOptions(
      deps.q,
      deps.page,
      deps.promotion,
      deps.status,
    )
    // Same-route navigations (pagination, search, filters) must not block,
    // or the router swaps in the full-page pending skeleton. keepPreviousData
    // in the component keeps the previous cards visible while loading.
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
      return
    }
    await Promise.all([
      context.queryClient.ensureQueryData(options),
      context.queryClient.ensureQueryData(titlePromotionsQueryOptions()),
    ])
  },
  component: TitlesPage,
  pendingComponent: TitlesPageSkeleton,
  pendingMs: 100,
})

const numberFmt = new Intl.NumberFormat('en-US')

function TitlesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Titles</h1>
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full max-w-md gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[140px]" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="overflow-hidden py-0 gap-0">
            <Skeleton className="aspect-[2/1] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </Card>
        ))}
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

function TitlesPage() {
  const { q, page, promotion, status } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [input, setInput] = useState(q)

  const { data, isPlaceholderData } = useQuery({
    ...titlesQueryOptions(q, page, promotion, status),
    placeholderData: keepPreviousData,
  })
  const { data: promotions } = useSuspenseQuery(titlePromotionsQueryOptions())
  // The loader awaits on first entry, and keepPreviousData covers
  // subsequent same-route navigations, so data is always available.
  if (!data) return <TitlesPageSkeleton />
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ search: (prev) => ({ ...prev, q: input, page: 1 }) })
  }

  function goToPage(next: number) {
    navigate({ search: (prev) => ({ ...prev, page: next }) })
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

  function selectStatus(next: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        status: (next === ALL_STATUS ? 'all' : next) as TitleStatus,
        page: 1,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Titles</h1>
        <p className="text-muted-foreground">
          {numberFmt.format(data.total)} titles
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
              placeholder="Search by name…"
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

          <Select value={status} onValueChange={selectStatus}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />

      {data.titles.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          No titles found.
        </p>
      ) : (
        <div
          className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          {data.titles.map((t) => (
            <TitleCard key={t.id} title={t} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
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
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function TitleCard({ title }: { title: EnrichedTitle }) {
  return (
    <Link
      to="/titles/$titleId"
      params={{ titleId: title.id }}
      className="group block"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-colors group-hover:border-foreground/20">
        <div className="flex aspect-[2/1] items-center justify-center bg-muted">
          {title.imageUrl ? (
            <img
              src={title.imageUrl}
              alt=""
              // SDH blocks hotlinking via Referer checks; omitting the
              // header entirely is allowed.
              referrerPolicy="no-referrer"
              className="size-full object-contain"
            />
          ) : (
            <>
              <Trophy
                className="size-12 text-muted-foreground/40"
                aria-hidden
              />
              <span className="sr-only">Title image placeholder</span>
            </>
          )}
        </div>
        <CardHeader className="gap-3 px-4 py-4">
          <CardTitle className="line-clamp-2 text-base leading-snug group-hover:underline">
            {title.name}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {title.promotionLabel && (
              <Badge variant="secondary">{title.promotionLabel}</Badge>
            )}
            <Badge variant={title.active ? 'default' : 'outline'}>
              {title.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}
