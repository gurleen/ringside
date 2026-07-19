import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { resolveTitleImageUrls, resolveWrestlerHeadshotUrls } from '#/lib/sdh'

/** Review cards need ≤4; event prediction cards can need many more. */
const MAX_IMAGE_IDS = 48

/** Fetch each URL and return base64 data URLs keyed by the map's ids. */
async function fetchImageDataUrls(
  urls: ReadonlyMap<string, string>,
): Promise<Record<string, string>> {
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
        // Missing images fall back to placeholders on the card.
      }
    }),
  )
  return result
}

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
    ids: input.ids.slice(0, MAX_IMAGE_IDS),
  }))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    return fetchImageDataUrls(await resolveWrestlerHeadshotUrls(data.ids))
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

/**
 * SDH belt art as base64 data URLs keyed by Cagematch title id (crosswalk
 * resolved, same export rationale as headshots).
 */
export const getTitleImageDataUrls = createServerFn({ method: 'GET' })
  .validator((input: { ids: Array<string> }) => ({
    ids: input.ids.slice(0, MAX_IMAGE_IDS),
  }))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    return fetchImageDataUrls(await resolveTitleImageUrls(data.ids))
  })

export const titleImageDataUrlsQueryOptions = (ids: ReadonlyArray<string>) =>
  queryOptions({
    queryKey: ['title-image-data-urls', [...ids].sort()],
    queryFn: () => getTitleImageDataUrls({ data: { ids: [...ids] } }),
    staleTime: 5 * 60 * 1000,
  })
