import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getSupabaseServerClient } from '#/lib/supabase'
import { eventLockInstant } from '#/lib/event-time'
import {
  performDeleteMatchPrediction,
  performListEventPredictions,
  performScoreEventPredictions,
  performUpsertMatchPrediction,
} from '#/lib/predictions.server'
import type { MatchPredictionRow, PredictionInput } from '#/lib/predictions.server'
import type {
  PredictedParticipant,
  PredictionStatus,
} from '#/lib/predictions-shared'
import { PREDICTION_POINTS_WINNER } from '#/lib/predictions-shared'

export type {
  MatchPredictionRow,
  PredictionInput,
  PredictedParticipant,
  PredictionStatus,
}
export { PREDICTION_POINTS_WINNER }

export type EventPredictionMap = Record<string, MatchPredictionRow>

export type UserPredictionItem = MatchPredictionRow & {
  matchType: string | null
  matchIndex: number | null
  eventName: string | null
  eventDate: string | null
  predictionsLocked: boolean
}

export type UserPredictionsPage = {
  predictions: Array<UserPredictionItem>
  total: number
  page: number
  pageSize: number
}

export type LeaderboardEntry = {
  userId: string
  username: string
  points: number
  correct: number
  incorrect: number
  rank: number
}

export type LeaderboardPage = {
  entries: Array<LeaderboardEntry>
  total: number
  page: number
  pageSize: number
}

const PREDICTION_PAGE_SIZE = 20
const LEADERBOARD_PAGE_SIZE = 25

function parseParticipants(value: unknown): Array<PredictedParticipant> {
  if (!Array.isArray(value)) return []
  const out: Array<PredictedParticipant> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { id?: unknown; name?: unknown }
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    const id =
      typeof row.id === 'string' && row.id.trim().length > 0
        ? row.id.trim()
        : null
    out.push({ id, name })
  }
  return out
}

export function predictionParticipants(
  row: MatchPredictionRow,
): Array<PredictedParticipant> {
  return parseParticipants(row.predicted_participants)
}

export const listEventPredictions = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => ({
    eventId: input.eventId.trim(),
  }))
  .handler(async ({ data }): Promise<EventPredictionMap> => {
    return performListEventPredictions(data.eventId)
  })

export const listUserPredictions = createServerFn({ method: 'GET' })
  .validator((input: { userId: string; page?: number }) => ({
    userId: input.userId.trim(),
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<UserPredictionsPage> => {
    if (!data.userId) {
      return {
        predictions: [],
        total: 0,
        page: data.page,
        pageSize: PREDICTION_PAGE_SIZE,
      }
    }

    const supabase = getSupabaseServerClient()
    const from = (data.page - 1) * PREDICTION_PAGE_SIZE
    const to = from + PREDICTION_PAGE_SIZE - 1

    const {
      data: rows,
      count,
      error,
    } = await supabase
      .schema('predictions')
      .from('match_predictions')
      .select('*', { count: 'exact' })
      .eq('user_id', data.userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)

    const eventIds = Array.from(new Set(rows.map((r) => r.event_id)))
    const matchIds = Array.from(new Set(rows.map((r) => r.match_id)))

    for (const eventId of eventIds) {
      await performScoreEventPredictions(eventId)
    }

    const [{ data: refreshed }, { data: matches }, { data: events }] =
      await Promise.all([
        rows.length > 0
          ? supabase
              .schema('predictions')
              .from('match_predictions')
              .select('*')
              .in(
                'id',
                rows.map((r) => r.id),
              )
          : Promise.resolve({ data: [] as Array<MatchPredictionRow> }),
        matchIds.length > 0
          ? supabase
              .from('matches')
              .select('id, match_type, match_index, event_id')
              .in('id', matchIds)
          : Promise.resolve({ data: [] as Array<{
              id: string
              match_type: string | null
              match_index: number
              event_id: string
            }> }),
        eventIds.length > 0
          ? supabase
              .from('events')
              .select('id, name, event_date, event_time, event_timezone')
              .in('id', eventIds)
          : Promise.resolve({
              data: [] as Array<{
                id: string
                name: string | null
                event_date: string | null
                event_time: string | null
                event_timezone: string | null
              }>,
            }),
      ])

    const byId = new Map((refreshed ?? rows).map((r) => [r.id, r]))
    const matchById = new Map((matches ?? []).map((m) => [m.id, m]))
    const eventById = new Map((events ?? []).map((e) => [e.id, e]))
    const now = Date.now()

    return {
      predictions: rows.map((r) => {
        const row = byId.get(r.id) ?? r
        const match = matchById.get(row.match_id)
        const event = eventById.get(row.event_id)
        let predictionsLocked = true
        if (event) {
          const instant = eventLockInstant(
            event.event_date,
            event.event_time,
            event.event_timezone,
          )
          predictionsLocked = !instant || instant.getTime() <= now
        }
        return {
          ...row,
          matchType: match?.match_type ?? null,
          matchIndex: match?.match_index ?? null,
          eventName: event?.name ?? null,
          eventDate: event?.event_date ?? null,
          predictionsLocked,
        }
      }),
      total: count ?? 0,
      page: data.page,
      pageSize: PREDICTION_PAGE_SIZE,
    }
  })

export const getLeaderboard = createServerFn({ method: 'GET' })
  .validator((input: { page?: number } = {}) => ({
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<LeaderboardPage> => {
    const supabase = getSupabaseServerClient()

    const { data: pendingEvents, error: pendingError } = await supabase
      .schema('predictions')
      .from('match_predictions')
      .select('event_id')
      .eq('status', 'pending')
      .limit(50)
    if (pendingError) throw new Error(pendingError.message)

    const eventIds = Array.from(
      new Set((pendingEvents ?? []).map((r) => r.event_id)),
    )
    for (const eventId of eventIds) {
      await performScoreEventPredictions(eventId)
    }

    const { data: scored, error } = await supabase
      .schema('predictions')
      .from('match_predictions')
      .select('user_id, points_awarded, status')
      .in('status', ['correct', 'incorrect'])

    if (error) throw new Error(error.message)

    const byUser = new Map<
      string,
      { points: number; correct: number; incorrect: number }
    >()
    for (const row of scored) {
      const current = byUser.get(row.user_id) ?? {
        points: 0,
        correct: 0,
        incorrect: 0,
      }
      current.points += Number(row.points_awarded ?? 0)
      if (row.status === 'correct') current.correct += 1
      if (row.status === 'incorrect') current.incorrect += 1
      byUser.set(row.user_id, current)
    }

    const sorted = Array.from(byUser.entries()).sort((a, b) => {
      const pointsDiff = b[1].points - a[1].points
      if (pointsDiff !== 0) return pointsDiff
      return b[1].correct - a[1].correct
    })

    const total = sorted.length
    const from = (data.page - 1) * LEADERBOARD_PAGE_SIZE
    const pageRows = sorted.slice(from, from + LEADERBOARD_PAGE_SIZE)

    const usernames = new Map<string, string>()
    if (pageRows.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .in(
          'id',
          pageRows.map(([userId]) => userId),
        )
      if (profileError) throw new Error(profileError.message)
      for (const p of profiles) usernames.set(p.id, p.username)
    }

    return {
      entries: pageRows.map(([userId, stats], i) => ({
        userId,
        username: usernames.get(userId) ?? 'unknown',
        points: stats.points,
        correct: stats.correct,
        incorrect: stats.incorrect,
        rank: from + i + 1,
      })),
      total,
      page: data.page,
      pageSize: LEADERBOARD_PAGE_SIZE,
    }
  })

export const scoreEventPredictions = createServerFn({ method: 'POST' })
  .validator((input: { eventId: string }) => ({
    eventId: input.eventId.trim(),
  }))
  .handler(async ({ data }) => {
    const updated = await performScoreEventPredictions(data.eventId)
    return { updated }
  })

export const upsertMatchPrediction = createServerFn({ method: 'POST' })
  .validator((input: PredictionInput) => ({
    matchId: input.matchId.trim(),
    eventId: input.eventId.trim(),
    predictedSideIndex: input.predictedSideIndex,
  }))
  .handler(async ({ data }) => {
    return performUpsertMatchPrediction(data)
  })

export const deleteMatchPrediction = createServerFn({ method: 'POST' })
  .validator((input: { predictionId: string }) => ({
    predictionId: input.predictionId.trim(),
  }))
  .handler(async ({ data }) => {
    return performDeleteMatchPrediction(data)
  })

export const eventPredictionsQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: ['predictions', 'event', eventId],
    queryFn: () => listEventPredictions({ data: { eventId } }),
  })

export const userPredictionsQueryOptions = (userId: string, page: number) =>
  queryOptions({
    queryKey: ['predictions', 'user', userId, { page }],
    queryFn: () => listUserPredictions({ data: { userId, page } }),
  })

export const leaderboardQueryOptions = (page: number) =>
  queryOptions({
    queryKey: ['predictions', 'leaderboard', { page }],
    queryFn: () => getLeaderboard({ data: { page } }),
  })
