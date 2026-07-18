import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getSupabaseServerClient } from '#/lib/supabase'
import {
  performCreateMatchReview,
  performDeleteMatchReview,
  performUpdateMatchReview,
  validateReviewFields,
} from '#/lib/reviews.server'
import { VIEWING_METHODS } from '#/lib/reviews-shared'
import type {
  MatchReviewRow,
  ReviewInput,
  ViewingMethod,
} from '#/lib/reviews.server'

export type { MatchReviewRow, ReviewInput, ViewingMethod }
export { VIEWING_METHODS }

export type MatchReviewSummary = {
  average: number | null
  count: number
}

export type MatchReviewSummaries = Record<string, MatchReviewSummary>

export type MatchReviewWithAuthor = MatchReviewRow & {
  username: string | null
}

export type MatchReviewsPage = {
  reviews: Array<MatchReviewWithAuthor>
  total: number
  page: number
  pageSize: number
  summary: MatchReviewSummary
}

export type UserReviewItem = MatchReviewWithAuthor & {
  matchType: string | null
  eventId: string | null
  eventName: string | null
  eventDate: string | null
}

export type UserReviewsPage = {
  reviews: Array<UserReviewItem>
  total: number
  page: number
  pageSize: number
}

const REVIEW_PAGE_SIZE = 20

function emptySummary(): MatchReviewSummary {
  return { average: null, count: 0 }
}

function summarizeRatings(
  rows: Array<{ match_id: string; rating: number | null }>,
): MatchReviewSummaries {
  const byMatch = new Map<
    string,
    { sum: number; rated: number; count: number }
  >()
  for (const row of rows) {
    const current = byMatch.get(row.match_id) ?? {
      sum: 0,
      rated: 0,
      count: 0,
    }
    current.count += 1
    if (row.rating != null) {
      current.sum += row.rating
      current.rated += 1
    }
    byMatch.set(row.match_id, current)
  }

  const out: MatchReviewSummaries = {}
  for (const [matchId, stats] of byMatch) {
    out[matchId] = {
      count: stats.count,
      average: stats.rated > 0 ? stats.sum / stats.rated : null,
    }
  }
  return out
}

export const getMatchReviewSummaries = createServerFn({ method: 'GET' })
  .validator((input: { matchIds: Array<string> }) => ({
    matchIds: Array.from(
      new Set(
        input.matchIds.map((id) => id.trim()).filter((id) => id.length > 0),
      ),
    ),
  }))
  .handler(async ({ data }): Promise<MatchReviewSummaries> => {
    if (data.matchIds.length === 0) return {}

    const supabase = getSupabaseServerClient()
    const { data: rows, error } = await supabase
      .schema('reviews')
      .from('match_reviews')
      .select('match_id, rating')
      .in('match_id', data.matchIds)

    if (error) throw new Error(error.message)
    return summarizeRatings(rows)
  })

async function resolveUsernames(
  userIds: Array<string>,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', unique)
  if (error) throw new Error(error.message)
  for (const row of data) map.set(row.id, row.username)
  return map
}

export const listMatchReviews = createServerFn({ method: 'GET' })
  .validator((input: { matchId: string; page?: number }) => ({
    matchId: input.matchId.trim(),
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<MatchReviewsPage> => {
    if (!data.matchId) {
      return {
        reviews: [],
        total: 0,
        page: data.page,
        pageSize: REVIEW_PAGE_SIZE,
        summary: emptySummary(),
      }
    }

    const supabase = getSupabaseServerClient()
    const from = (data.page - 1) * REVIEW_PAGE_SIZE
    const to = from + REVIEW_PAGE_SIZE - 1

    const [
      { data: rows, count, error },
      { data: ratingRows, error: ratingError },
    ] = await Promise.all([
      supabase
        .schema('reviews')
        .from('match_reviews')
        .select('*', { count: 'exact' })
        .eq('match_id', data.matchId)
        .order('created_at', { ascending: false })
        .range(from, to),
      supabase
        .schema('reviews')
        .from('match_reviews')
        .select('match_id, rating')
        .eq('match_id', data.matchId),
    ])

    if (error) throw new Error(error.message)
    if (ratingError) throw new Error(ratingError.message)

    const usernames = await resolveUsernames(rows.map((r) => r.user_id))
    const summary = summarizeRatings(ratingRows)[data.matchId] ?? emptySummary()

    return {
      reviews: rows.map((r) => ({
        ...r,
        username: usernames.get(r.user_id) ?? null,
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: REVIEW_PAGE_SIZE,
      summary,
    }
  })

export const listUserReviews = createServerFn({ method: 'GET' })
  .validator((input: { userId: string; page?: number }) => ({
    userId: input.userId.trim(),
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<UserReviewsPage> => {
    if (!data.userId) {
      return {
        reviews: [],
        total: 0,
        page: data.page,
        pageSize: REVIEW_PAGE_SIZE,
      }
    }

    const supabase = getSupabaseServerClient()
    const from = (data.page - 1) * REVIEW_PAGE_SIZE
    const to = from + REVIEW_PAGE_SIZE - 1

    const {
      data: rows,
      count,
      error,
    } = await supabase
      .schema('reviews')
      .from('match_reviews')
      .select('*', { count: 'exact' })
      .eq('user_id', data.userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)

    const reviewRows = rows
    const matchIds = Array.from(
      new Set(reviewRows.map((r) => r.match_id).filter(Boolean)),
    )

    const matchById = new Map<
      string,
      {
        id: string
        match_type: string | null
        event_id: string
        event_name: string | null
        event_date: string | null
      }
    >()

    if (matchIds.length > 0) {
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('id, match_type, event_id')
        .in('id', matchIds)
      if (matchError) throw new Error(matchError.message)

      const eventIds = Array.from(
        new Set(matches.map((m) => m.event_id).filter(Boolean)),
      )
      const eventById = new Map<
        string,
        { id: string; name: string | null; event_date: string | null }
      >()

      if (eventIds.length > 0) {
        const { data: events, error: eventError } = await supabase
          .from('events')
          .select('id, name, event_date')
          .in('id', eventIds)
        if (eventError) throw new Error(eventError.message)
        for (const e of events) {
          eventById.set(e.id, e)
        }
      }

      for (const m of matches) {
        const event = eventById.get(m.event_id)
        matchById.set(m.id, {
          id: m.id,
          match_type: m.match_type,
          event_id: m.event_id,
          event_name: event?.name ?? null,
          event_date: event?.event_date ?? null,
        })
      }
    }

    const usernames = await resolveUsernames(reviewRows.map((r) => r.user_id))

    return {
      reviews: reviewRows.map((r) => {
        const match = matchById.get(r.match_id)
        return {
          ...r,
          username: usernames.get(r.user_id) ?? null,
          matchType: match?.match_type ?? null,
          eventId: match?.event_id ?? null,
          eventName: match?.event_name ?? null,
          eventDate: match?.event_date ?? null,
        }
      }),
      total: count ?? 0,
      page: data.page,
      pageSize: REVIEW_PAGE_SIZE,
    }
  })

function normalizeCreateInput(input: ReviewInput): ReviewInput {
  const fields = validateReviewFields({
    rating: input.rating,
    reviewText: input.reviewText,
    isFirstWatch: input.isFirstWatch,
    watchedAt: input.watchedAt,
    viewingMethod: input.viewingMethod,
    requireSubstance: true,
  })
  return {
    matchId: input.matchId.trim(),
    rating: fields.rating,
    reviewText: fields.reviewText,
    isFirstWatch: fields.isFirstWatch,
    watchedAt: fields.watchedAt,
    viewingMethod: fields.viewingMethod,
  }
}

export const createMatchReview = createServerFn({ method: 'POST' })
  .validator((input: ReviewInput) => normalizeCreateInput(input))
  .handler(async ({ data }) => {
    return performCreateMatchReview(data)
  })

export const updateMatchReview = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      reviewId: string
      rating?: number | null
      reviewText?: string | null
      isFirstWatch?: boolean | null
      watchedAt?: string | null
      viewingMethod?: ViewingMethod | null
    }) => {
      const fields = validateReviewFields({
        rating: input.rating,
        reviewText: input.reviewText,
        isFirstWatch: input.isFirstWatch,
        watchedAt: input.watchedAt,
        viewingMethod: input.viewingMethod,
        requireSubstance: true,
      })
      return {
        reviewId: input.reviewId.trim(),
        rating: fields.rating,
        reviewText: fields.reviewText,
        isFirstWatch: fields.isFirstWatch,
        watchedAt: fields.watchedAt,
        viewingMethod: fields.viewingMethod,
      }
    },
  )
  .handler(async ({ data }) => {
    return performUpdateMatchReview(data)
  })

export const deleteMatchReview = createServerFn({ method: 'POST' })
  .validator((input: { reviewId: string }) => ({
    reviewId: input.reviewId.trim(),
  }))
  .handler(async ({ data }) => {
    return performDeleteMatchReview(data)
  })

export const matchReviewSummariesQueryOptions = (matchIds: Array<string>) => {
  const sorted = Array.from(new Set(matchIds)).sort()
  return queryOptions({
    queryKey: ['reviews', 'summaries', sorted],
    queryFn: () => getMatchReviewSummaries({ data: { matchIds: sorted } }),
  })
}

export const matchReviewsQueryOptions = (matchId: string, page: number) =>
  queryOptions({
    queryKey: ['reviews', 'match', matchId, { page }],
    queryFn: () => listMatchReviews({ data: { matchId, page } }),
  })

export const userReviewsQueryOptions = (userId: string, page: number) =>
  queryOptions({
    queryKey: ['reviews', 'user', userId, { page }],
    queryFn: () => listUserReviews({ data: { userId, page } }),
  })
