import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toBlob } from 'html-to-image'
import { Check, ClipboardCopy, Download, Loader2, Star } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import { matchSummaryQueryOptions } from '#/lib/events'
import type { MatchSummary } from '#/lib/events'
import type { MatchReviewWithAuthor } from '#/lib/reviews'
import { wrestlerHeadshotDataUrlsQueryOptions } from '#/lib/share-image'
import { formatEventDate } from '#/routes/events/index'

const SHARE_SIZE = 1080
const PREVIEW_SIZE = 360

const VIEWING_LABELS: Record<string, string> = {
  in_person: 'In person',
  live: 'Live',
  later: 'Later',
}

function joinNames(names: Array<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

function sideNames(
  match: MatchSummary,
  role: 'winner' | 'loser' | 'side',
): Array<string> {
  return match.sides
    .filter((s) => s.role === role)
    .flatMap((s) =>
      s.participants
        .filter((p) => p.role === 'wrestler' || p.role === 'team')
        .map((p) => p.name)
        .filter((name): name is string => !!name),
    )
}

function formatMatchup(match: MatchSummary, showWinner: boolean): string {
  const winners = sideNames(match, 'winner')
  const losers = sideNames(match, 'loser')
  const sides = sideNames(match, 'side')
  if (winners.length > 0 || losers.length > 0) {
    if (showWinner) {
      return `${joinNames(winners) || '—'} def. ${joinNames(losers) || '—'}`
    }
    // Alphabetical so the ordering can't hint at who won.
    const all = [...winners, ...losers, ...sides].sort((a, b) =>
      a.localeCompare(b),
    )
    if (all.length === 0) return 'Match'
    if (all.length < 5) return all.join(' vs ')
    return `${all[0]} vs ${all.length - 1} others`
  }
  if (sides.length === 0) return 'Match'
  if (sides.length < 5) return sides.join(' vs ')
  return `${sides[0]} vs ${sides.length - 1} others`
}

type SoloWrestler = {
  id: string | null
  name: string
  imageUrl: string | null
  isWinner: boolean
}

/**
 * For singles / triple threat / fatal four-way cards (2–4 sides, exactly one
 * wrestler per side), the wrestlers in display order; otherwise null.
 */
function soloWrestlers(match: MatchSummary): Array<SoloWrestler> | null {
  if (match.sides.length < 2 || match.sides.length > 4) return null
  const result: Array<SoloWrestler> = []
  for (const side of match.sides) {
    const wrestlers = side.participants.filter((p) => p.role === 'wrestler')
    if (wrestlers.length !== 1 || !wrestlers[0].name) return null
    result.push({
      id: wrestlers[0].id,
      name: wrestlers[0].name,
      imageUrl: null,
      isWinner: side.role === 'winner',
    })
  }
  return result
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function ReviewShareDialog({
  review,
  open,
  onOpenChange,
}: {
  review: MatchReviewWithAuthor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'download' | 'copy' | null>(null)
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showWinner, setShowWinner] = useState(true)

  const { data: match, isLoading, isError } = useQuery({
    ...matchSummaryQueryOptions(review.match_id),
    enabled: open,
  })

  // Headshots go through a server fn that returns data URLs: the SDH host
  // blocks cross-origin reads, so `html-to-image` can't inline remote URLs
  // when exporting.
  const baseWrestlers = match ? soloWrestlers(match) : null
  const headshotIds =
    baseWrestlers
      ?.map((w) => w.id)
      .filter((id): id is string => id != null) ?? []
  const { data: headshots, isLoading: headshotsLoading } = useQuery({
    ...wrestlerHeadshotDataUrlsQueryOptions(headshotIds),
    enabled: open && headshotIds.length > 0,
  })
  const wrestlers = baseWrestlers
    ? baseWrestlers.map((w) => ({
        ...w,
        imageUrl: w.id ? (headshots?.[w.id] ?? null) : null,
      }))
    : null
  const waitingOnHeadshots = headshotIds.length > 0 && headshotsLoading

  async function exportPngBlob(): Promise<Blob> {
    const node = cardRef.current
    if (!node) throw new Error('Share card is not ready.')
    const blob = await toBlob(node, {
      width: SHARE_SIZE,
      height: SHARE_SIZE,
      pixelRatio: 1,
      cacheBust: true,
    })
    if (!blob) throw new Error('Could not export image.')
    return blob
  }

  async function downloadPng() {
    setBusy('download')
    setExportError(null)
    setCopied(false)
    try {
      const blob = await exportPngBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const slug = (review.username ?? 'review').replace(/[^\w-]+/g, '-')
      link.download = `ringside-${slug}-${review.id.slice(0, 8)}.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Could not export image.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function copyPng() {
    setBusy('copy')
    setExportError(null)
    setCopied(false)
    try {
      if (
        typeof ClipboardItem === 'undefined' ||
        !navigator.clipboard?.write
      ) {
        throw new Error('Clipboard image copy is not supported in this browser.')
      }
      // Hand ClipboardItem the pending promise: Safari rejects writes that
      // happen after an await (user activation has expired by then).
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': exportPngBlob() }),
      ])
      setCopied(true)
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Could not copy image.',
      )
    } finally {
      setBusy(null)
    }
  }

  const scale = PREVIEW_SIZE / SHARE_SIZE

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share review</DialogTitle>
          <DialogDescription>
            A square image of this match and your review, ready to post.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-1">
          {isLoading ? (
            <Skeleton
              className="rounded-md"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            />
          ) : isError || !match ? (
            <div
              className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            >
              Could not load match details.
            </div>
          ) : (
            <>
              <div
                className="relative overflow-hidden rounded-md border shadow-sm"
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
              >
                <div
                  className="absolute top-0 left-0 origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                >
                  <ShareCard
                    review={review}
                    match={match}
                    wrestlers={wrestlers}
                    showWinner={showWinner}
                  />
                </div>
              </div>
              {/* Full-size unscaled card for PNG export (off-screen). */}
              <div
                aria-hidden
                className="pointer-events-none fixed top-0 left-[-10000px]"
              >
                <ShareCard
                  cardRef={cardRef}
                  review={review}
                  match={match}
                  wrestlers={wrestlers}
                  showWinner={showWinner}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="share-show-winner"
            checked={showWinner}
            onCheckedChange={setShowWinner}
          />
          <Label htmlFor="share-show-winner" className="text-sm font-normal">
            Show match winner
          </Label>
        </div>

        {exportError ? (
          <p role="alert" className="text-sm text-destructive">
            {exportError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!match || busy != null || waitingOnHeadshots}
            onClick={() => void copyPng()}
          >
            {busy === 'copy' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : copied ? (
              <Check className="size-4" />
            ) : (
              <ClipboardCopy className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy image'}
          </Button>
          <Button
            type="button"
            disabled={!match || busy != null || waitingOnHeadshots}
            onClick={() => void downloadPng()}
          >
            {busy === 'download' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShareCard({
  cardRef,
  review,
  match,
  wrestlers,
  showWinner,
}: {
  cardRef?: Ref<HTMLDivElement>
  review: MatchReviewWithAuthor
  match: MatchSummary
  wrestlers: Array<SoloWrestler> | null
  showWinner: boolean
}) {
  const viewingMethod = review.viewing_method
  const meta = [
    match.event.promotionLabel,
    formatEventDate(match.event.event_date, match.event.date),
    match.matchType,
  ]
    .filter(Boolean)
    .join(' · ')

  const rating = review.rating
  const filledStars =
    rating != null ? Math.min(10, Math.max(0, Math.ceil(rating))) : 0

  return (
    <div
      ref={cardRef}
      style={{
        width: SHARE_SIZE,
        height: SHARE_SIZE,
        boxSizing: 'border-box',
        padding: 72,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        color: '#173a40',
        background:
          'linear-gradient(160deg, #f3faf5 0%, #e7f3ec 45%, #d8ebe3 100%)',
        fontFamily: 'Manrope, system-ui, sans-serif',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 80% 50% at 10% 0%, rgba(79,184,178,0.28), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(47,106,74,0.18), transparent 50%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          minHeight: 0,
          flex: 1,
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#2f6a4a',
              fontFamily: 'Fraunces, Georgia, serif',
            }}
          >
            Ringside
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 44,
                lineHeight: 1.15,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                fontFamily: 'Fraunces, Georgia, serif',
              }}
            >
              {match.event.name ?? 'Untitled event'}
            </h2>
            {meta ? (
              <p style={{ margin: 0, fontSize: 24, lineHeight: 1.35, color: '#416166' }}>
                {meta}
              </p>
            ) : null}
          </div>
        </header>

        {wrestlers ? (
          <WrestlerHeadshotRow wrestlers={wrestlers} showWinner={showWinner} />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!wrestlers ? (
            <p
              style={{
                margin: 0,
                fontSize: 36,
                lineHeight: 1.3,
                fontWeight: 600,
                fontFamily: 'Fraunces, Georgia, serif',
              }}
            >
              {formatMatchup(match, showWinner)}
            </p>
          ) : null}
          {match.titleName ? (
            <p style={{ margin: 0, fontSize: 22, color: '#416166' }}>
              {match.titleName}
              {/* A title change gives away the result too. */}
              {showWinner && match.titleChange ? ' · Title change' : ''}
            </p>
          ) : null}
        </div>

        <div
          style={{
            height: 1,
            width: '100%',
            flexShrink: 0,
            background: 'rgba(23,58,64,0.16)',
          }}
        />

        <div
          style={{
            display: 'flex',
            minHeight: 0,
            flex: 1,
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {rating != null ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {Array.from({ length: Math.max(5, filledStars) }, (_, i) => {
                  const fill = Math.min(1, Math.max(0, rating - i))
                  return (
                    <span
                      key={i}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: 36,
                        height: 36,
                      }}
                    >
                      <Star
                        style={{
                          width: 36,
                          height: 36,
                          color: 'rgba(65,97,102,0.35)',
                          fill: 'rgba(65,97,102,0.12)',
                          visibility: fill > 0 && fill < 1 ? 'hidden' : 'visible',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          overflow: 'hidden',
                          width: `${Math.round(fill * 100)}%`,
                        }}
                      >
                        <Star
                          style={{
                            width: 36,
                            height: 36,
                            color: '#f59e0b',
                            fill: '#f59e0b',
                          }}
                        />
                      </span>
                    </span>
                  )
                })}
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {rating.toFixed(2)}
              </span>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {review.is_first_watch ? <ShareChip>First watch</ShareChip> : null}
            {viewingMethod && VIEWING_LABELS[viewingMethod] ? (
              <ShareChip>{VIEWING_LABELS[viewingMethod]}</ShareChip>
            ) : null}
          </div>

          {review.review_text ? (
            <FitReviewText text={review.review_text} />
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 26,
                fontStyle: 'italic',
                color: '#416166',
              }}
            >
              Rated without a written review.
            </p>
          )}
        </div>

        <footer
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>
            {review.username ? `@${review.username}` : 'Anonymous'}
          </p>
          <p style={{ margin: 0, fontSize: 22, color: '#416166' }}>
            ringside.gurleen.net
          </p>
        </footer>
      </div>
    </div>
  )
}

const REVIEW_FONT_MIN = 28
const REVIEW_FONT_MAX = 52
const REVIEW_LINE_HEIGHT = 1.45

/**
 * Quoted review text that grows to fill its box: picks the largest font size
 * (28–52px) at which the whole text fits, and falls back to line-clamping at
 * the minimum size when even that overflows.
 */
function FitReviewText({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [fontSize, setFontSize] = useState(REVIEW_FONT_MIN)
  const [clampLines, setClampLines] = useState<number | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const node = textRef.current
    if (!container || !node) return

    function fit() {
      if (!container || !node) return
      const available = container.clientHeight
      if (available <= 0) return

      node.style.webkitLineClamp = ''
      for (let size = REVIEW_FONT_MAX; size >= REVIEW_FONT_MIN; size -= 2) {
        node.style.fontSize = `${size}px`
        if (node.scrollHeight <= available) {
          setFontSize(size)
          setClampLines(null)
          return
        }
      }
      setFontSize(REVIEW_FONT_MIN)
      setClampLines(
        Math.max(
          1,
          Math.floor(available / (REVIEW_FONT_MIN * REVIEW_LINE_HEIGHT)),
        ),
      )
    }

    fit()
    // Available height shifts when siblings change (e.g. winner toggle).
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [text])

  return (
    <div ref={containerRef} style={{ minHeight: 0, flex: 1 }}>
      <p
        ref={textRef}
        style={{
          margin: 0,
          maxHeight: '100%',
          overflow: 'hidden',
          fontSize,
          lineHeight: REVIEW_LINE_HEIGHT,
          color: '#173a40',
          ...(clampLines != null
            ? {
                display: '-webkit-box',
                WebkitLineClamp: clampLines,
                WebkitBoxOrient: 'vertical' as const,
              }
            : null),
        }}
      >
        {'\u201C'}
        {text}
        {'\u201D'}
      </p>
    </div>
  )
}

/**
 * Headshot circles for 2–4 solo-wrestler matches, each with the wrestler's
 * name beneath it and "vs" separators between them. Replaces the plain
 * matchup line, so the winner (when known) is marked here.
 */
function WrestlerHeadshotRow({
  wrestlers: orderedWrestlers,
  showWinner,
}: {
  wrestlers: Array<SoloWrestler>
  showWinner: boolean
}) {
  // Sides are sorted winner-first, so when hiding the winner re-order
  // alphabetically to avoid leaking the result through position.
  const wrestlers = showWinner
    ? orderedWrestlers
    : [...orderedWrestlers].sort((a, b) => a.name.localeCompare(b.name))

  // Keep the row inside the card at every side count.
  const size = wrestlers.length === 2 ? 180 : wrestlers.length === 3 ? 150 : 124
  const nameSize = wrestlers.length === 2 ? 28 : wrestlers.length === 3 ? 24 : 21

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 20,
        flexWrap: 'nowrap',
      }}
    >
      {wrestlers.map((w, i) => (
        <div
          key={`${w.name}-${i}`}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}
        >
          {i > 0 ? (
            // Match the circle height so "vs" centers on the headshots
            // even when names below wrap to different line counts.
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: size,
                fontSize: 24,
                fontWeight: 600,
                color: '#416166',
                fontFamily: 'Fraunces, Georgia, serif',
              }}
            >
              vs
            </span>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              width: size + 36,
            }}
          >
            <span
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.72)',
                border:
                  showWinner && w.isWinner
                    ? '4px solid #f59e0b'
                    : '3px solid rgba(47,106,74,0.25)',
              }}
            >
              {w.imageUrl ? (
                <img
                  // Base64 data URL from the server fn, so `html-to-image`
                  // never has to fetch cross-origin during export.
                  src={w.imageUrl}
                  alt={w.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: size * 0.32,
                    fontWeight: 700,
                    color: '#2f6a4a',
                    fontFamily: 'Fraunces, Georgia, serif',
                  }}
                >
                  {initials(w.name)}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: nameSize,
                lineHeight: 1.2,
                fontWeight: 600,
                textAlign: 'center',
                fontFamily: 'Fraunces, Georgia, serif',
              }}
            >
              {w.name}
            </span>
            {showWinner && w.isWinner ? (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: '#b45309',
                }}
              >
                Winner
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function ShareChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 9999,
        padding: '6px 16px',
        fontSize: 20,
        fontWeight: 500,
        background: 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(47,106,74,0.22)',
        color: '#2f6a4a',
      }}
    >
      {children}
    </span>
  )
}
