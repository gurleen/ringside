import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getSupabaseServerClient } from '#/lib/supabase'
import { getPromotionResolver } from '#/lib/promotions'
import {
  performDeleteEventAttendance,
  performGetEventAttendance,
  performUpsertEventAttendance,
} from '#/lib/shows.server'
import type { AttendanceInput, EventAttendanceRow } from '#/lib/shows.server'
import { isAttendance, type Attendance } from '#/lib/shows-shared'

export type { Attendance, AttendanceInput, EventAttendanceRow }
export {
  ATTENDANCE_LABELS,
  ATTENDANCE_MODES,
  isAttendance,
} from '#/lib/shows-shared'

export type UserShowItem = EventAttendanceRow & {
  eventName: string | null
  eventDate: string | null
  eventDateText: string | null
  promotionLabel: string | null
}

export type UserShowsPage = {
  shows: Array<UserShowItem>
  total: number
  page: number
  pageSize: number
}

const SHOW_PAGE_SIZE = 20

export const getEventAttendance = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => ({
    eventId: input.eventId.trim(),
  }))
  .handler(async ({ data }): Promise<EventAttendanceRow | null> => {
    return performGetEventAttendance(data.eventId)
  })

export const listUserShows = createServerFn({ method: 'GET' })
  .validator((input: { userId: string; page?: number }) => ({
    userId: input.userId.trim(),
    page: Math.max(1, input.page ?? 1),
  }))
  .handler(async ({ data }): Promise<UserShowsPage> => {
    if (!data.userId) {
      return {
        shows: [],
        total: 0,
        page: data.page,
        pageSize: SHOW_PAGE_SIZE,
      }
    }

    const supabase = getSupabaseServerClient()
    const from = (data.page - 1) * SHOW_PAGE_SIZE
    const to = from + SHOW_PAGE_SIZE - 1

    const {
      data: rows,
      count,
      error,
    } = await supabase
      .schema('shows')
      .from('event_attendance')
      .select('*', { count: 'exact' })
      .eq('user_id', data.userId)
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)

    const eventIds = Array.from(new Set(rows.map((r) => r.event_id)))
    const [{ data: events }, resolvePromotion] = await Promise.all([
      eventIds.length > 0
        ? supabase
            .from('events')
            .select('id, name, event_date, date, promotion')
            .in('id', eventIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string
              name: string | null
              event_date: string | null
              date: string | null
              promotion: string | null
            }>,
          }),
      getPromotionResolver(),
    ])

    const eventById = new Map((events ?? []).map((e) => [e.id, e]))

    return {
      shows: rows.map((row) => {
        const event = eventById.get(row.event_id)
        return {
          ...row,
          eventName: event?.name ?? null,
          eventDate: event?.event_date ?? null,
          eventDateText: event?.date ?? null,
          promotionLabel: resolvePromotion(event?.promotion ?? null),
        }
      }),
      total: count ?? 0,
      page: data.page,
      pageSize: SHOW_PAGE_SIZE,
    }
  })

export const upsertEventAttendance = createServerFn({ method: 'POST' })
  .validator((input: AttendanceInput) => {
    if (!isAttendance(input.attendance)) {
      throw new Error('Attendance must be in person or watched on TV.')
    }
    return {
      eventId: input.eventId.trim(),
      attendance: input.attendance,
    }
  })
  .handler(async ({ data }) => {
    return performUpsertEventAttendance(data)
  })

export const deleteEventAttendance = createServerFn({ method: 'POST' })
  .validator((input: { attendanceId: string }) => ({
    attendanceId: input.attendanceId.trim(),
  }))
  .handler(async ({ data }) => {
    return performDeleteEventAttendance(data)
  })

export const eventAttendanceQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: ['shows', 'event', eventId],
    queryFn: () => getEventAttendance({ data: { eventId } }),
  })

export const userShowsQueryOptions = (userId: string, page: number) =>
  queryOptions({
    queryKey: ['shows', 'user', userId, { page }],
    queryFn: () => listUserShows({ data: { userId, page } }),
  })
