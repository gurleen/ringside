// Pure, client-safe helpers for event start times.
//
// `events.event_time` is a wall-clock time in `events.event_timezone` (an IANA
// zone). Venue-time formatting is deterministic from the stored zone, so it is
// safe to render during SSR. Device-time depends on the viewer's zone and must
// only be computed in the browser (see callers) to avoid hydration mismatches.

/** Fallback zone when an event has a date but no admin-set start time. */
export const DEFAULT_EVENT_TZ = 'America/New_York'

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(instant)) map[part.type] = part.value
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )
  return asUTC - instant.getTime()
}

/** Interpret a wall-clock date+time in `timeZone` as an absolute instant. */
export function zonedWallTimeToInstant(
  eventDate: string | null,
  eventTime: string | null,
  timeZone: string | null,
): Date | null {
  if (!eventDate || !eventTime || !timeZone) return null
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate)
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(eventTime)
  if (!dm || !tm) return null

  const naiveUTC = Date.UTC(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    Number(tm[3] ?? '0'),
  )
  // Fixed-point iteration; two passes converge across DST boundaries.
  let instant = new Date(naiveUTC)
  instant = new Date(naiveUTC - zoneOffsetMs(instant, timeZone))
  instant = new Date(naiveUTC - zoneOffsetMs(instant, timeZone))
  return instant
}

/**
 * Absolute instant when predictions lock for an event. Uses the admin-entered
 * start time when both time and timezone are set; otherwise midnight
 * America/New_York on `event_date`. Returns null when there is no date.
 */
export function eventLockInstant(
  eventDate: string | null,
  eventTime: string | null,
  eventTimezone: string | null,
): Date | null {
  if (!eventDate) return null
  if (eventTime && eventTimezone) {
    return zonedWallTimeToInstant(eventDate, eventTime, eventTimezone)
  }
  return zonedWallTimeToInstant(eventDate, '00:00:00', DEFAULT_EVENT_TZ)
}

function instantTimeLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant)
}

function wallClockLabel(eventTime: string): string | null {
  const tm = /^(\d{2}):(\d{2})/.exec(eventTime)
  if (!tm) return null
  const d = new Date(2000, 0, 1, Number(tm[1]), Number(tm[2]))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Venue-local time label, e.g. "7:00 PM EST". SSR-safe. */
export function formatVenueTime(
  eventDate: string | null,
  eventTime: string | null,
  timeZone: string | null,
): string | null {
  if (!eventTime) return null
  const instant = zonedWallTimeToInstant(eventDate, eventTime, timeZone)
  if (instant && timeZone) return instantTimeLabel(instant, timeZone)
  return wallClockLabel(eventTime)
}

/**
 * The same instant shown in the viewer's local zone, e.g. "4:00 PM PST" — or
 * null when it matches the venue zone or can't be resolved. Browser-only.
 */
export function formatDeviceTime(
  eventDate: string | null,
  eventTime: string | null,
  timeZone: string | null,
): string | null {
  if (!eventTime || !timeZone) return null
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!deviceTz || deviceTz === timeZone) return null
  const instant = zonedWallTimeToInstant(eventDate, eventTime, timeZone)
  if (!instant) return null
  return instantTimeLabel(instant, deviceTz)
}
