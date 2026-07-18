import { getSupabaseAuthClient } from '#/lib/supabase-auth.server'
import { getSupabaseServerClient } from '#/lib/supabase'
import { fetchCurrentUser } from '#/lib/auth.server'
import { eventLockInstant } from '#/lib/event-time'
import {
  isMatchPredictable,
  snapshotParticipants,
  type PredictedParticipant,
} from '#/lib/predictions-shared'
import type { Json, Tables, TablesInsert } from '#/lib/database.types'

export type MatchPredictionRow = Tables<
  { schema: 'predictions' },
  'match_predictions'
>

export type PredictionInput = {
  matchId: string
  eventId: string
  predictedSideIndex: number
}

function participantsToJson(
  participants: Array<PredictedParticipant>,
): Json {
  return participants.map((p) => ({ id: p.id, name: p.name }))
}

async function loadMatchForPrediction(matchId: string): Promise<{
  id: string
  event_id: string
  result: string | null
  sides: Array<{
    side_index: number
    side_role: string
    participants: Array<{
      participant_role: string
      participant_id: string | null
      participant_name: string | null
    }>
  }>
  event: {
    event_date: string | null
    event_time: string | null
    event_timezone: string | null
  }
}> {
  const supabase = getSupabaseAuthClient()
  const { data: match, error } = await supabase
    .from('matches')
    .select(
      'id, event_id, result, match_sides(side_index, side_role, match_side_participants(participant_role, participant_id, participant_name)), events(event_date, event_time, event_timezone)',
    )
    .eq('id', matchId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!match) throw new Error('Match not found.')

  const event = match.events
  if (!event || Array.isArray(event)) {
    throw new Error('Event not found for match.')
  }

  return {
    id: match.id,
    event_id: match.event_id,
    result: match.result,
    sides: match.match_sides.map((s) => ({
      side_index: s.side_index,
      side_role: s.side_role,
      participants: s.match_side_participants,
    })),
    event: {
      event_date: event.event_date,
      event_time: event.event_time,
      event_timezone: event.event_timezone,
    },
  }
}

function assertPredictionsOpen(event: {
  event_date: string | null
  event_time: string | null
  event_timezone: string | null
}): void {
  const lockAt = eventLockInstant(
    event.event_date,
    event.event_time,
    event.event_timezone,
  )
  if (!lockAt) {
    throw new Error('Predictions require an event date.')
  }
  if (lockAt.getTime() <= Date.now()) {
    throw new Error('Predictions are locked for this event.')
  }
}

export async function performUpsertMatchPrediction(
  input: PredictionInput,
): Promise<MatchPredictionRow> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to make a prediction.')

  const matchId = input.matchId.trim()
  const eventId = input.eventId.trim()
  if (!matchId || !eventId) {
    throw new Error('Match and event ids are required.')
  }
  if (
    !Number.isInteger(input.predictedSideIndex) ||
    input.predictedSideIndex < 0
  ) {
    throw new Error('Predicted side index is invalid.')
  }

  const match = await loadMatchForPrediction(matchId)
  if (match.event_id !== eventId) {
    throw new Error('Match does not belong to this event.')
  }

  assertPredictionsOpen(match.event)

  if (
    !isMatchPredictable(
      match.result,
      match.sides.map((s) => s.side_role),
    )
  ) {
    throw new Error('This match already has a result and cannot be predicted.')
  }

  const side = match.sides.find((s) => s.side_index === input.predictedSideIndex)
  if (!side) {
    throw new Error('Selected side is not on this match card.')
  }

  const participants = snapshotParticipants(
    side.participants.map((p) => ({
      role: p.participant_role,
      id: p.participant_id,
      name: p.participant_name,
    })),
  )
  if (participants.length === 0) {
    throw new Error('Selected side has no wrestlers to predict.')
  }

  const supabase = getSupabaseAuthClient()
  const row: TablesInsert<{ schema: 'predictions' }, 'match_predictions'> = {
    user_id: user.id,
    match_id: matchId,
    event_id: eventId,
    predicted_side_index: input.predictedSideIndex,
    predicted_participants: participantsToJson(participants),
  }

  const { data, error } = await supabase
    .schema('predictions')
    .from('match_predictions')
    .upsert(row, { onConflict: 'user_id,match_id' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function performDeleteMatchPrediction(input: {
  predictionId: string
}): Promise<{ ok: true }> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to delete a prediction.')

  const predictionId = input.predictionId.trim()
  if (!predictionId) throw new Error('Prediction id is required.')

  const supabase = getSupabaseAuthClient()
  const { data: existing, error: loadError } = await supabase
    .schema('predictions')
    .from('match_predictions')
    .select('id, event_id, user_id')
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Prediction not found or you do not own it.')

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('event_date, event_time, event_timezone')
    .eq('id', existing.event_id)
    .maybeSingle()
  if (eventError) throw new Error(eventError.message)
  if (event) assertPredictionsOpen(event)

  const { data, error } = await supabase
    .schema('predictions')
    .from('match_predictions')
    .delete()
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Prediction not found or you do not own it.')
  return { ok: true }
}

export async function performListEventPredictions(
  eventId: string,
): Promise<Record<string, MatchPredictionRow>> {
  const trimmed = eventId.trim()
  if (!trimmed) return {}

  // Score first so pending picks settle whenever the event page is viewed.
  await performScoreEventPredictions(trimmed)

  const user = await fetchCurrentUser()
  if (!user) return {}

  const supabase = getSupabaseServerClient()
  const { data: rows, error } = await supabase
    .schema('predictions')
    .from('match_predictions')
    .select('*')
    .eq('event_id', trimmed)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  const map: Record<string, MatchPredictionRow> = {}
  for (const row of rows) map[row.match_id] = row
  return map
}

/** Lazy-score pending predictions for an event via SECURITY DEFINER RPC. */
export async function performScoreEventPredictions(
  eventId: string,
): Promise<number> {
  const trimmed = eventId.trim()
  if (!trimmed) return 0

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .schema('predictions')
    .rpc('score_event_predictions', { p_event_id: trimmed })

  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}
