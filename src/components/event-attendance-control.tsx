import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2, Ticket, Tv, X } from 'lucide-react'
import { useState } from 'react'
import {
  ATTENDANCE_LABELS,
  deleteEventAttendance,
  upsertEventAttendance,
  type Attendance,
  type EventAttendanceRow,
} from '#/lib/shows'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export function EventAttendanceControl({
  eventId,
  attendance,
  signedIn,
  compact = false,
}: {
  eventId: string
  attendance: EventAttendanceRow | null
  signedIn: boolean
  /** Tighter layout for list cards (My Shows). */
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const upsert = useMutation({
    mutationFn: async (mode: Attendance) => {
      const row = await upsertEventAttendance({
        data: { eventId, attendance: mode },
      })
      await queryClient.invalidateQueries({ queryKey: ['shows'] })
      return row
    },
    onSuccess: () => setError(null),
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not save show.')
    },
  })

  const remove = useMutation({
    mutationFn: async (attendanceId: string) => {
      const result = await deleteEventAttendance({ data: { attendanceId } })
      await queryClient.invalidateQueries({ queryKey: ['shows'] })
      return result
    },
    onSuccess: () => setError(null),
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not clear show.')
    },
  })

  const pending = upsert.isPending || remove.isPending
  const current = (attendance?.attendance ?? null) as Attendance | null

  if (!signedIn) {
    return (
      <p className="text-xs text-muted-foreground">
        <Link
          to="/login"
          search={{ error: undefined }}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Log in
        </Link>{' '}
        to track shows
      </p>
    )
  }

  return (
    <div className={cn('space-y-1.5', compact ? '' : 'pt-1')}>
      {!compact && (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Did you watch?
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ModeButton
          active={current === 'in_person'}
          disabled={pending}
          icon={Ticket}
          label={ATTENDANCE_LABELS.in_person}
          onClick={() => {
            if (current === 'in_person' && attendance) {
              remove.mutate(attendance.id)
            } else {
              upsert.mutate('in_person')
            }
          }}
        />
        <ModeButton
          active={current === 'tv'}
          disabled={pending}
          icon={Tv}
          label={ATTENDANCE_LABELS.tv}
          onClick={() => {
            if (current === 'tv' && attendance) {
              remove.mutate(attendance.id)
            } else {
              upsert.mutate('tv')
            }
          }}
        />
        {attendance && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="h-8 px-2 text-muted-foreground"
            aria-label="Clear show"
            onClick={() => remove.mutate(attendance.id)}
          >
            {remove.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Clear
          </Button>
        )}
        {pending && !attendance && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ModeButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  disabled: boolean
  icon: typeof Ticket
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      disabled={disabled}
      className="h-8 gap-1.5"
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon className="size-3.5" />
      {label}
    </Button>
  )
}
