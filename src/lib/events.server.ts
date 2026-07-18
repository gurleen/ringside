import { getSupabaseAuthClient } from '#/lib/supabase-auth.server'
import { fetchCurrentUser } from '#/lib/auth.server'
import type { Tables, TablesUpdate } from '#/lib/database.types'

export type EventTimeInput = {
  eventId: string
  eventTime?: string | null
  eventTimezone?: string | null
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

// Normalizes an "HH:MM" / "HH:MM:SS" wall-clock string to "HH:MM:SS", or null
// when blank. Throws on anything that isn't a valid 24h time.
export function normalizeEventTime(time?: string | null): string | null {
  if (time == null) return null
  const trimmed = time.trim()
  if (trimmed === '') return null
  const match = TIME_RE.exec(trimmed)
  if (!match) {
    throw new Error('Time must be in 24-hour HH:MM format.')
  }
  const [, hh, mm, ss] = match
  return `${hh}:${mm}:${ss ?? '00'}`
}

export function normalizeEventTimezone(tz?: string | null): string | null {
  if (tz == null) return null
  const trimmed = tz.trim()
  if (trimmed === '') return null
  try {
    // Throws RangeError for an unknown IANA zone.
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed })
  } catch {
    throw new Error('Unknown time zone.')
  }
  return trimmed
}

export function normalizeEventTimeInput(input: EventTimeInput): {
  eventId: string
  eventTime: string | null
  eventTimezone: string | null
} {
  const eventId = input.eventId.trim()
  if (!eventId) throw new Error('Event id is required.')

  const eventTime = normalizeEventTime(input.eventTime)
  const eventTimezone = normalizeEventTimezone(input.eventTimezone)

  if (eventTime && !eventTimezone) {
    throw new Error('A time zone is required when setting a start time.')
  }

  return {
    eventId,
    eventTime,
    // Clearing the time also clears the (now meaningless) time zone.
    eventTimezone: eventTime ? eventTimezone : null,
  }
}

export async function performUpdateEventTime(
  input: EventTimeInput,
): Promise<Tables<'events'>> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in.')
  if (!user.isAdmin) throw new Error('Only admins can edit event times.')

  const { eventId, eventTime, eventTimezone } = normalizeEventTimeInput(input)

  const update: TablesUpdate<'events'> = {
    event_time: eventTime,
    event_timezone: eventTimezone,
  }

  const supabase = getSupabaseAuthClient()
  const { data, error } = await supabase
    .from('events')
    .update(update)
    .eq('id', eventId)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Event not found or you do not have access.')
  return data
}
