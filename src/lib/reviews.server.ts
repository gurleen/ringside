import { getSupabaseAuthClient } from '#/lib/supabase-auth.server'
import { fetchCurrentUser } from '#/lib/auth.server'
import { VIEWING_METHODS, isMatchReviewable } from '#/lib/reviews-shared'
import type { ViewingMethod } from '#/lib/reviews-shared'
import type { Tables, TablesInsert, TablesUpdate } from '#/lib/database.types'

export type MatchReviewRow = Tables<{ schema: 'reviews' }, 'match_reviews'>
export type MatchReviewInsert = TablesInsert<
  { schema: 'reviews' },
  'match_reviews'
>
export type MatchReviewUpdate = TablesUpdate<
  { schema: 'reviews' },
  'match_reviews'
>

export type { ViewingMethod }

export type ReviewInput = {
  matchId: string
  rating?: number | null
  reviewText?: string | null
  isFirstWatch?: boolean | null
  watchedAt?: string | null
  viewingMethod?: ViewingMethod | null
}

function isQuarterStar(rating: number): boolean {
  return Math.abs(rating * 4 - Math.round(rating * 4)) < 1e-9
}

export function validateReviewFields(input: {
  rating?: number | null
  reviewText?: string | null
  isFirstWatch?: boolean | null
  watchedAt?: string | null
  viewingMethod?: ViewingMethod | null
  requireSubstance?: boolean
}): {
  rating: number | null
  reviewText: string | null
  isFirstWatch: boolean | null
  watchedAt: string | null
  viewingMethod: ViewingMethod | null
} {
  let rating: number | null = null
  if (input.rating != null) {
    if (
      typeof input.rating !== 'number' ||
      Number.isNaN(input.rating) ||
      input.rating < 0.25 ||
      input.rating > 10 ||
      !isQuarterStar(input.rating)
    ) {
      throw new Error(
        'Rating must be between 0.25 and 10 in quarter-star steps (e.g. 3.75).',
      )
    }
    rating = input.rating
  }

  let reviewText: string | null = null
  if (input.reviewText != null) {
    const trimmed = input.reviewText.trim()
    if (trimmed.length === 0) {
      throw new Error('Review text cannot be blank.')
    }
    if (trimmed.length > 10000) {
      throw new Error('Review text must be 10,000 characters or fewer.')
    }
    reviewText = trimmed
  }

  if (
    input.requireSubstance !== false &&
    rating == null &&
    reviewText == null
  ) {
    throw new Error('A review needs a rating and/or review text.')
  }

  let watchedAt: string | null = null
  if (input.watchedAt != null && input.watchedAt !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.watchedAt)) {
      throw new Error('Watched date must be YYYY-MM-DD.')
    }
    watchedAt = input.watchedAt
  }

  let viewingMethod: ViewingMethod | null = null
  if (input.viewingMethod != null) {
    if (!VIEWING_METHODS.includes(input.viewingMethod)) {
      throw new Error('Invalid viewing method.')
    }
    viewingMethod = input.viewingMethod
  }

  return {
    rating,
    reviewText,
    isFirstWatch:
      input.isFirstWatch === undefined ? null : (input.isFirstWatch ?? null),
    watchedAt,
    viewingMethod,
  }
}

async function ensureMatchHasResult(matchId: string): Promise<void> {
  const supabase = getSupabaseAuthClient()
  const { data: match, error } = await supabase
    .from('matches')
    .select('result, match_sides(side_role)')
    .eq('id', matchId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (
    !match ||
    !isMatchReviewable(
      match.result,
      match.match_sides.map((side) => side.side_role),
    )
  ) {
    throw new Error('This match cannot be reviewed until it has a result.')
  }
}

export async function performCreateMatchReview(
  input: ReviewInput,
): Promise<MatchReviewRow> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to write a review.')

  if (!input.matchId.trim()) {
    throw new Error('Match id is required.')
  }

  await ensureMatchHasResult(input.matchId.trim())

  const fields = validateReviewFields({
    rating: input.rating,
    reviewText: input.reviewText,
    isFirstWatch: input.isFirstWatch,
    watchedAt: input.watchedAt,
    viewingMethod: input.viewingMethod,
    requireSubstance: true,
  })

  const supabase = getSupabaseAuthClient()
  const insert: MatchReviewInsert = {
    user_id: user.id,
    match_id: input.matchId.trim(),
    rating: fields.rating,
    review_text: fields.reviewText,
    is_first_watch: fields.isFirstWatch,
    watched_at: fields.watchedAt,
    viewing_method: fields.viewingMethod,
  }

  const { data, error } = await supabase
    .schema('reviews')
    .from('match_reviews')
    .insert(insert)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function performUpdateMatchReview(input: {
  reviewId: string
  rating?: number | null
  reviewText?: string | null
  isFirstWatch?: boolean | null
  watchedAt?: string | null
  viewingMethod?: ViewingMethod | null
}): Promise<MatchReviewRow> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to edit a review.')

  if (!input.reviewId.trim()) {
    throw new Error('Review id is required.')
  }

  const fields = validateReviewFields({
    rating: input.rating,
    reviewText: input.reviewText,
    isFirstWatch: input.isFirstWatch,
    watchedAt: input.watchedAt,
    viewingMethod: input.viewingMethod,
    requireSubstance: true,
  })

  const update: MatchReviewUpdate = {
    rating: fields.rating,
    review_text: fields.reviewText,
    is_first_watch: fields.isFirstWatch,
    watched_at: fields.watchedAt,
    viewing_method: fields.viewingMethod,
  }

  const supabase = getSupabaseAuthClient()
  const { data, error } = await supabase
    .schema('reviews')
    .from('match_reviews')
    .update(update)
    .eq('id', input.reviewId.trim())
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Review not found or you do not own it.')
  return data
}

export async function performDeleteMatchReview(input: {
  reviewId: string
}): Promise<{ ok: true }> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to delete a review.')

  if (!input.reviewId.trim()) {
    throw new Error('Review id is required.')
  }

  const supabase = getSupabaseAuthClient()
  const { data, error } = await supabase
    .schema('reviews')
    .from('match_reviews')
    .delete()
    .eq('id', input.reviewId.trim())
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Review not found or you do not own it.')
  return { ok: true }
}
