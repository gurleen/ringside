import { getSupabaseAuthClient } from '#/lib/supabase-auth.server'
import { getSupabaseServerClient } from '#/lib/supabase'
import { fetchCurrentUser } from '#/lib/auth.server'
import { isAttendance, type Attendance } from '#/lib/shows-shared'
import type { Tables, TablesInsert } from '#/lib/database.types'

export type EventAttendanceRow = Tables<
  { schema: 'shows' },
  'event_attendance'
>

export type AttendanceInput = {
  eventId: string
  attendance: Attendance
}

export async function performGetEventAttendance(
  eventId: string,
): Promise<EventAttendanceRow | null> {
  const trimmed = eventId.trim()
  if (!trimmed) return null

  const user = await fetchCurrentUser()
  if (!user) return null

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .schema('shows')
    .from('event_attendance')
    .select('*')
    .eq('event_id', trimmed)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function performUpsertEventAttendance(
  input: AttendanceInput,
): Promise<EventAttendanceRow> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to track a show.')

  const eventId = input.eventId.trim()
  if (!eventId) throw new Error('Event id is required.')
  if (!isAttendance(input.attendance)) {
    throw new Error('Attendance must be in person or watched on TV.')
  }

  const supabase = getSupabaseAuthClient()
  const row: TablesInsert<{ schema: 'shows' }, 'event_attendance'> = {
    user_id: user.id,
    event_id: eventId,
    attendance: input.attendance,
  }

  const { data, error } = await supabase
    .schema('shows')
    .from('event_attendance')
    .upsert(row, { onConflict: 'user_id,event_id' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function performDeleteEventAttendance(input: {
  attendanceId: string
}): Promise<{ ok: true }> {
  const user = await fetchCurrentUser()
  if (!user) throw new Error('You must be signed in to clear a show.')

  const attendanceId = input.attendanceId.trim()
  if (!attendanceId) throw new Error('Attendance id is required.')

  const supabase = getSupabaseAuthClient()
  const { data, error } = await supabase
    .schema('shows')
    .from('event_attendance')
    .delete()
    .eq('id', attendanceId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Show not found or you do not own it.')
  return { ok: true }
}
