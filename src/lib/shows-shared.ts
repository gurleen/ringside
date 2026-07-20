// Client-safe attendance constants/types shared between shows.ts and
// shows.server.ts. Keep runtime values out of shows.server.ts if client code
// needs them — TanStack Start's import protection blocks .server.* imports
// from the client bundle.

export type Attendance = 'in_person' | 'tv'

export const ATTENDANCE_MODES: Array<Attendance> = ['in_person', 'tv']

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  in_person: 'In person',
  tv: 'Watched on TV',
}

export function isAttendance(value: unknown): value is Attendance {
  return value === 'in_person' || value === 'tv'
}
