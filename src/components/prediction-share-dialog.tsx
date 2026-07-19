import { useLayoutEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ClipboardCopy, Download, Loader2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Skeleton } from '#/components/ui/skeleton'
import type { EnrichedEvent, MatchCardItem } from '#/lib/events'
import type { EventPredictionMap, MatchPredictionRow } from '#/lib/predictions'
import {
  pickLabel,
  predictionSideParticipants,
  resolvePickedSide,
  sideLabel,
} from '#/lib/predictions-shared'
import {
  PREVIEW_SIZE,
  SHARE_SIZE,
  copyPngBlob,
  downloadPngBlob,
  exportNodeToPngBlob,
  shareFilename,
} from '#/lib/share-card-export'
import {
  titleImageDataUrlsQueryOptions,
  wrestlerHeadshotDataUrlsQueryOptions,
} from '#/lib/share-image'
import { formatEventDate } from '#/routes/events/index'

type PickPortrait = {
  id: string | null
  name: string
  imageUrl: string | null
}

export function PredictionShareDialog({
  open,
  onOpenChange,
  event,
  matches,
  predictions,
  username,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: EnrichedEvent
  matches: Array<MatchCardItem>
  predictions: EventPredictionMap
  username: string | null
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'download' | 'copy' | null>(null)
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const headshotIds = collectPredictedWrestlerIds(matches, predictions)
  const { data: headshots, isLoading: headshotsLoading } = useQuery({
    ...wrestlerHeadshotDataUrlsQueryOptions(headshotIds),
    enabled: open && headshotIds.length > 0,
  })
  const titleIds = Array.from(
    new Set(
      matches
        .map((m) => m.titleId)
        .filter((id): id is string => id != null),
    ),
  )
  const { data: titleImages, isLoading: titleImagesLoading } = useQuery({
    ...titleImageDataUrlsQueryOptions(titleIds),
    enabled: open && titleIds.length > 0,
  })
  const waitingOnImages =
    (headshotIds.length > 0 && headshotsLoading) ||
    (titleIds.length > 0 && titleImagesLoading)

  // The card grows taller than the square minimum when picks need more
  // room; track its real height so the preview shows the whole image.
  const [cardHeight, setCardHeight] = useState(SHARE_SIZE)
  useLayoutEffect(() => {
    const node = cardRef.current
    if (!node) return
    const update = () => setCardHeight(node.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [open, waitingOnImages])

  function exportPngBlob(): Promise<Blob> {
    const node = cardRef.current
    if (!node) return Promise.reject(new Error('Share card is not ready.'))
    return exportNodeToPngBlob(node)
  }

  async function downloadPng() {
    setBusy('download')
    setExportError(null)
    setCopied(false)
    try {
      const blob = await exportPngBlob()
      downloadPngBlob(
        blob,
        shareFilename('predictions', username, event.id),
      )
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
      await copyPngBlob(exportPngBlob())
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
          <DialogTitle>Share predictions</DialogTitle>
          <DialogDescription>
            An image of your picks for this event, ready to post.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-1">
          {waitingOnImages ? (
            <Skeleton
              className="rounded-md"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            />
          ) : (
            <>
              <div
                className="relative overflow-hidden rounded-md border shadow-sm"
                style={{
                  width: PREVIEW_SIZE,
                  height: Math.round(cardHeight * scale),
                }}
              >
                <div
                  className="absolute top-0 left-0 origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                >
                  <PredictionShareCard
                    event={event}
                    matches={matches}
                    predictions={predictions}
                    headshots={headshots ?? {}}
                    titleImages={titleImages ?? {}}
                    username={username}
                  />
                </div>
              </div>
              <div
                aria-hidden
                className="pointer-events-none fixed top-0 left-[-10000px]"
              >
                <PredictionShareCard
                  cardRef={cardRef}
                  event={event}
                  matches={matches}
                  predictions={predictions}
                  headshots={headshots ?? {}}
                  titleImages={titleImages ?? {}}
                  username={username}
                />
              </div>
            </>
          )}
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
            disabled={busy != null || waitingOnImages}
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
            disabled={busy != null || waitingOnImages}
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

function PredictionShareCard({
  cardRef,
  event,
  matches,
  predictions,
  headshots,
  titleImages,
  username,
}: {
  cardRef?: Ref<HTMLDivElement>
  event: EnrichedEvent
  matches: Array<MatchCardItem>
  predictions: EventPredictionMap
  headshots: Record<string, string>
  titleImages: Record<string, string>
  username: string | null
}) {
  const meta = [
    event.promotionLabel,
    formatEventDate(event.event_date, event.date),
  ]
    .filter(Boolean)
    .join(' · ')

  const rows = matches.map((match) => {
    const prediction = predictions[match.id]
    return {
      id: match.id,
      index: match.index,
      subtitle: matchSubtitle(match),
      pick: prediction ? pickLabel(match.sides, prediction) : '—',
      opponents: prediction ? opponentsLabel(match, prediction) : '',
      beltImageUrl: match.titleId ? (titleImages[match.titleId] ?? null) : null,
      isTagTitle: /\btag team\b/i.test(match.titleName ?? ''),
      portraits: prediction
        ? pickPortraits(match, prediction, headshots)
        : [],
    }
  })

  // Scale rows to fill the space between header and footer: compute the
  // per-row budget from the rows-area height and derive sizes from it.
  const count = Math.max(1, rows.length)
  const columns = count > 8 ? 2 : 1
  const rowsPerColumn = Math.ceil(count / columns)
  // 1080 card − padding/header/divider/footer/outer gaps ≈ 640px of rows.
  const ROWS_AREA = 640
  const rowBudget = ROWS_AREA / rowsPerColumn
  const avatarSize = Math.round(Math.min(150, Math.max(36, rowBudget * 0.66)))
  const pickSize = Math.round(Math.min(46, Math.max(19, avatarSize * 0.42)))
  const subtitleSize = Math.max(14, Math.round(pickSize * 0.62))
  const lineGap = Math.round(Math.min(28, Math.max(8, rowBudget * 0.12)))

  return (
    <div
      ref={cardRef}
      style={{
        width: SHARE_SIZE,
        // Square by default; grows taller when the picks need more room.
        minHeight: SHARE_SIZE,
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
          gap: 28,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#2f6a4a',
              fontFamily: 'Fraunces, Georgia, serif',
            }}
          >
            Ringside Predictions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2
              style={{
                margin: 0,
                fontSize: count > 10 ? 40 : 48,
                lineHeight: 1.1,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                fontFamily: 'Fraunces, Georgia, serif',
              }}
            >
              {username ? `@${username}'s Picks` : 'My Picks'}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: count > 10 ? 24 : 28,
                lineHeight: 1.25,
                fontWeight: 600,
                color: '#173a40',
              }}
            >
              {event.name ?? 'Untitled event'}
            </p>
            {meta ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 22,
                  lineHeight: 1.35,
                  color: '#416166',
                }}
              >
                {meta}
              </p>
            ) : null}
          </div>
        </header>

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
            display: 'grid',
            gridTemplateColumns: columns === 2 ? '1fr 1fr' : '1fr',
            columnGap: 28,
            rowGap: lineGap,
            flex: 1,
            // Spread rows over leftover height so short cards fill the
            // square; taller content grows the card instead of clipping.
            alignContent: 'space-evenly',
          }}
        >
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                minWidth: 0,
              }}
            >
              <PickAvatarStack portraits={row.portraits} size={avatarSize} />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: subtitleSize,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#416166',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  #{row.index + 1}
                  {row.subtitle ? ` · ${row.subtitle}` : ''}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: pickSize,
                    lineHeight: 1.2,
                    fontWeight: 700,
                    fontFamily: 'Fraunces, Georgia, serif',
                    // Wrap long names to a second line before truncating.
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {row.pick}
                </p>
                {row.opponents ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: subtitleSize,
                      lineHeight: 1.3,
                      fontWeight: 500,
                      color: '#416166',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    vs {row.opponents}
                  </p>
                ) : null}
              </div>
              {row.beltImageUrl ? (
                <BeltArt
                  imageUrl={row.beltImageUrl}
                  size={avatarSize}
                  double={row.isTagTitle}
                />
              ) : null}
            </div>
          ))}
        </div>

        <footer
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            paddingTop: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 20, color: '#416166' }}>
            ringside.gurleen.net
          </p>
        </footer>
      </div>
    </div>
  )
}

/**
 * SDH belt art for a title bout. Tag team titles render two copies of the
 * belt, the top one offset down and to the right.
 */
function BeltArt({
  imageUrl,
  size,
  double,
}: {
  imageUrl: string
  size: number
  double: boolean
}) {
  const height = Math.round(size * 0.9)
  const maxWidth = Math.round(size * 1.6)
  // Base64 data URL from the server fn, so `html-to-image` never has to
  // fetch cross-origin during export.
  const belt = (
    <img
      src={imageUrl}
      alt=""
      style={{
        height,
        width: 'auto',
        maxWidth,
        objectFit: 'contain',
        display: 'block',
      }}
    />
  )

  if (!double) return <span style={{ flexShrink: 0 }}>{belt}</span>

  const offset = Math.round(height * 0.18)
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        // Reserve room for the offset copy so the row lays out correctly.
        paddingRight: offset,
        paddingBottom: offset,
      }}
    >
      {belt}
      <span
        style={{
          position: 'absolute',
          top: offset,
          left: offset,
        }}
      >
        {belt}
      </span>
    </span>
  )
}

function PickAvatarStack({
  portraits,
  size,
}: {
  portraits: Array<PickPortrait>
  size: number
}) {
  const visible = portraits.slice(0, 3)
  const overflow = portraits.length - visible.length
  const overlap = Math.round(size * 0.28)

  if (visible.length === 0) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.72)',
          border: '2px solid rgba(47,106,74,0.25)',
          fontSize: size * 0.28,
          fontWeight: 700,
          color: '#2f6a4a',
          fontFamily: 'Fraunces, Georgia, serif',
        }}
      >
        ?
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        paddingRight: overflow > 0 ? size * 0.35 : 0,
      }}
    >
      {visible.map((p, i) => (
        <span
          key={`${p.id ?? p.name}-${i}`}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.92)',
            border: '2px solid rgba(47,106,74,0.3)',
            marginLeft: i === 0 ? 0 : -overlap,
            position: 'relative',
            zIndex: visible.length - i,
          }}
        >
          {p.imageUrl ? (
            <img
              // Base64 data URL from the server fn, so `html-to-image`
              // never has to fetch cross-origin during export.
              src={p.imageUrl}
              alt={p.name}
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
              {initials(p.name)}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          style={{
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: '50%',
            marginLeft: -overlap * 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#2f6a4a',
            color: '#f3faf5',
            fontSize: size * 0.22,
            fontWeight: 700,
            position: 'relative',
            zIndex: 0,
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}

function collectPredictedWrestlerIds(
  matches: Array<MatchCardItem>,
  predictions: EventPredictionMap,
): Array<string> {
  const ids = new Set<string>()
  for (const match of matches) {
    const prediction = predictions[match.id]
    if (!prediction) continue
    for (const p of pickPortraits(match, prediction, {})) {
      if (p.id) ids.add(p.id)
    }
  }
  return Array.from(ids)
}

function pickPortraits(
  match: MatchCardItem,
  prediction: MatchPredictionRow,
  headshots: Record<string, string>,
): Array<PickPortrait> {
  const picked = resolvePickedSide(match.sides, prediction)
  const source = picked
    ? picked.participants.filter((p) => p.role === 'wrestler')
    : predictionSideParticipants(prediction)

  const byKey = new Map<string, PickPortrait>()
  for (const p of source) {
    const name = p.name?.trim()
    if (!name) continue
    const id = p.id?.trim() || null
    const key = id ? `id:${id}` : `name:${name.toLowerCase()}`
    if (byKey.has(key)) continue
    byKey.set(key, {
      id,
      name,
      imageUrl: id ? (headshots[id] ?? null) : null,
    })
  }
  return Array.from(byKey.values())
}

/**
 * Compact "vs" text for the sides the user did not pick. Empty when the
 * stored pick no longer maps to a current side (card changed).
 */
function opponentsLabel(
  match: MatchCardItem,
  prediction: MatchPredictionRow,
): string {
  const picked = resolvePickedSide(match.sides, prediction)
  if (!picked) return ''
  const others = match.sides.filter((s) => s.id !== picked.id)
  if (others.length === 0) return ''
  if (others.length <= 2) return others.map(sideLabel).join(', ')
  return `${sideLabel(others[0])} & ${others.length - 1} others`
}

function matchSubtitle(match: MatchCardItem): string {
  if (match.titleName) return match.titleName
  if (match.matchType) return match.matchType
  return ''
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
