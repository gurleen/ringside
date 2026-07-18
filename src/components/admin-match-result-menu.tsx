import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, MoreVertical, Trophy, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { clearMatchResult, setMatchResult } from '#/lib/events'
import type { MatchSide } from '#/lib/events'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

function sideLabel(side: MatchSide): string {
  const wrestlers = side.participants.filter((p) => p.role === 'wrestler')
  const names = (wrestlers.length > 0 ? wrestlers : side.participants)
    .map((p) => p.name)
    .filter(Boolean)
  if (names.length === 0) return `Side ${side.sideIndex + 1}`
  if (names.length <= 2) return names.join(' & ')
  return `${names[0]} & ${names.length - 1} others`
}

// Admin-only 3-dot menu on a match card: "Set Result" opens a modal to pick
// the winning side; "Clear result" resets the match. Writes hit the live
// scraped tables and are overwritten by the nightly ETL.
export function AdminMatchResultMenu({
  eventId,
  matchId,
  sides,
}: {
  eventId: string
  matchId: string
  sides: Array<MatchSide>
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [setOpen, setSetOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [selectedSideId, setSelectedSideId] = useState<string | null>(null)

  const winner = sides.find((s) => s.role === 'winner')

  async function invalidateMatchQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['match', matchId] }),
      queryClient.invalidateQueries({ queryKey: ['predictions'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews'] }),
    ])
  }

  const setResult = useMutation({
    mutationFn: async (winnerSideId: string) => {
      const result = await setMatchResult({
        data: { matchId, winnerSideId },
      })
      await invalidateMatchQueries()
      return result
    },
    onSuccess: () => {
      setError(null)
      setSetOpen(false)
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Could not mark match result.',
      )
    },
  })

  const clearResult = useMutation({
    mutationFn: async () => {
      const result = await clearMatchResult({ data: { matchId } })
      await invalidateMatchQueries()
      return result
    },
    onSuccess: () => {
      setError(null)
      setClearOpen(false)
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Could not clear match result.',
      )
    },
  })

  const pending = setResult.isPending || clearResult.isPending

  if (sides.length < 2) return null

  function openSetResult() {
    setError(null)
    setSelectedSideId(winner?.id ?? null)
    setSetOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={pending}
            aria-label="Admin: match actions"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreVertical className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Admin
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={pending} onSelect={openSetResult}>
            <Trophy />
            Set Result…
          </DropdownMenuItem>
          {winner && (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={() => {
                setError(null)
                setClearOpen(true)
              }}
            >
              <Undo2 />
              Clear result…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={setOpen} onOpenChange={setSetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set match result</DialogTitle>
            <DialogDescription>
              Choose the winning side. This marks the match decisive right away
              and is replaced by the nightly scrape once Cagematch has the
              result.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sides.map((side) => {
              const selected = side.id === selectedSideId
              return (
                <button
                  key={side.id}
                  type="button"
                  disabled={pending}
                  onClick={() => setSelectedSideId(side.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <span className="truncate">{sideLabel(side)}</span>
                  {side.role === 'winner' && (
                    <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">
                      current winner
                    </span>
                  )}
                  {selected && (
                    <Check
                      className={cn(
                        'size-4 shrink-0 text-primary',
                        side.role !== 'winner' && 'ml-auto',
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setSetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                pending || !selectedSideId || selectedSideId === winner?.id
              }
              onClick={() => {
                if (selectedSideId) setResult.mutate(selectedSideId)
              }}
            >
              {setResult.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                'Save result'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this match result?</AlertDialogTitle>
            <AlertDialogDescription>
              {winner ? `Winner is currently ${sideLabel(winner)}. ` : null}
              This resets the match to unresolved until you mark it again (or
              the nightly scrape lands a result).
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep result</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                clearResult.mutate()
              }}
            >
              {clearResult.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Clearing…
                </>
              ) : (
                'Clear result'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
