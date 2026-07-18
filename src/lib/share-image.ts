import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { resolveWrestlerHeadshotUrls } from '#/lib/sdh'

/**
 * Fetch SDH headshots server-side and return them as base64 data URLs, keyed
 * by Cagematch wrestler id. The share card export (`html-to-image`) re-fetches
 * image URLs from the browser, where the SDH host blocks cross-origin reads;
 * data URLs sidestep that entirely. Ids resolve through the crosswalk, so
 * arbitrary URLs can't be proxied. Wrestlers whose image can't be fetched are
 * simply omitted.
 */
export const getWrestlerHeadshotDataUrls = createServerFn({ method: 'GET' })
  .validator((input: { ids: Array<string> }) => ({
    // A share card shows at most 4 wrestlers.
    ids: input.ids.slice(0, 4),
  }))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const urls = await resolveWrestlerHeadshotUrls(data.ids)
    const result: Record<string, string> = {}
    await Promise.all(
      Array.from(urls, async ([id, url]) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return
          const contentType = res.headers.get('content-type') ?? 'image/png'
          const buf = await res.arrayBuffer()
          result[id] =
            `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`
        } catch {
          // Missing headshots fall back to initials on the card.
        }
      }),
    )
    return result
  })

export const wrestlerHeadshotDataUrlsQueryOptions = (
  ids: ReadonlyArray<string>,
) =>
  queryOptions({
    queryKey: ['wrestler-headshot-data-urls', [...ids].sort()],
    queryFn: () => getWrestlerHeadshotDataUrls({ data: { ids: [...ids] } }),
    // Data URLs are large; avoid refetching while the dialog is open.
    staleTime: 5 * 60 * 1000,
  })
