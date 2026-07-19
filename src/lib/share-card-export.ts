import { toBlob } from 'html-to-image'

/** Full-size share card edge length (px). */
export const SHARE_SIZE = 1080
/** Scaled dialog preview edge length (px). */
export const PREVIEW_SIZE = 360

export async function exportNodeToPngBlob(node: HTMLElement): Promise<Blob> {
  // Measure the node so cards taller than the square minimum export fully.
  const blob = await toBlob(node, {
    width: node.offsetWidth,
    height: node.offsetHeight,
    pixelRatio: 1,
    cacheBust: true,
  })
  if (!blob) throw new Error('Could not export image.')
  return blob
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Copy a PNG to the clipboard. Pass a pending blob promise so Safari keeps
 * user activation (it rejects writes that happen after an await).
 */
export async function copyPngBlob(
  blobOrPromise: Blob | Promise<Blob>,
): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard image copy is not supported in this browser.')
  }
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blobOrPromise }),
  ])
}

export function shareFilename(
  prefix: string,
  username: string | null | undefined,
  id: string,
): string {
  const slug = (username ?? prefix).replace(/[^\w-]+/g, '-')
  return `ringside-${slug}-${id.slice(0, 8)}.png`
}
