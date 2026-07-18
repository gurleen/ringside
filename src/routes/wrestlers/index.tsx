import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { wrestlersQueryOptions } from '#/lib/wrestling'
import { Input } from '#/components/ui/input'
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

interface WrestlerSearch {
  q: string
  page: number
}

export const Route = createFileRoute('/wrestlers/')({
  validateSearch: (search: Record<string, unknown>): WrestlerSearch => ({
    q: typeof search.q === 'string' ? search.q : '',
    page:
      typeof search.page === 'number' && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, page: search.page }),
  loader: async ({ context, deps, cause }) => {
    const options = wrestlersQueryOptions(deps.q, deps.page)
    // Same-route navigations (pagination, search) must not block, or the
    // router swaps in the full-page pending skeleton. keepPreviousData in
    // the component keeps the previous rows visible while loading.
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(options)
    } else {
      await context.queryClient.ensureQueryData(options)
    }
  },
  component: WrestlersPage,
  pendingComponent: WrestlersPageSkeleton,
  pendingMs: 100,
})

const numberFmt = new Intl.NumberFormat('en-US')

function WrestlersPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Wrestlers</h1>
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="flex max-w-md gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-20" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Promotion</TableHead>
              <TableHead className="hidden sm:table-cell">Gender</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
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

function WrestlersPage() {
  const { q, page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [input, setInput] = useState(q)

  const { data, isPlaceholderData } = useQuery({
    ...wrestlersQueryOptions(q, page),
    placeholderData: keepPreviousData,
  })
  // The loader awaits on first entry, and keepPreviousData covers
  // subsequent same-route navigations, so data is always available.
  if (!data) return <WrestlersPageSkeleton />
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ search: { q: input, page: 1 } })
  }

  function goToPage(next: number) {
    navigate({ search: (prev) => ({ ...prev, page: next }) })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Wrestlers</h1>
        <p className="text-muted-foreground">
          {numberFmt.format(data.total)} wrestlers
          {q ? ` matching “${q}”` : ''}
        </p>
      </div>

      <form onSubmit={submitSearch} className="flex max-w-md gap-2">
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

      <div
        className={`rounded-lg border transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Promotion</TableHead>
              <TableHead className="hidden sm:table-cell">Gender</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.wrestlers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-muted-foreground"
                >
                  No wrestlers found.
                </TableCell>
              </TableRow>
            ) : (
              data.wrestlers.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/wrestlers/$wrestlerId"
                      params={{ wrestlerId: w.id }}
                      search={{ tab: 'profile', page: 1 }}
                      className="hover:underline"
                    >
                      {w.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.current_promotion ?? '—'}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {w.gender ?? '—'}
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
