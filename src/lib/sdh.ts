import { getCachedSupabaseServerClient } from '#/lib/supabase'
import type { Tables } from '#/lib/database.types'

/** Minimum crosswalk confidence for trusting an SDH match (see sdh-crosswalk.md). */
export const SDH_MIN_CONFIDENCE = 0.7

export type SdhWrestler = Tables<'sdh_wrestlers'>
export type SdhWrestlerNameHistory = Tables<'sdh_wrestler_name_history'>
export type SdhWrestlerPromotion = Tables<'sdh_wrestler_promotions'>
export type SdhWrestlerAlignment = Tables<'sdh_wrestler_alignments'>
export type SdhWrestlerAttribute = Tables<'sdh_wrestler_attributes'>
export type SdhWrestlerRole = Tables<'sdh_wrestler_roles'>
export type SdhWrestlerImage = Tables<'sdh_wrestler_images'>
export type SdhWrestlerAccomplishment = Tables<'sdh_wrestler_accomplishments'>
export type SdhTitle = Tables<'sdh_titles'>
export type SdhTitleNameHistory = Tables<'sdh_title_name_history'>

export interface SdhTitleProfile {
  title: SdhTitle
  nameHistory: Array<SdhTitleNameHistory>
}

export interface SdhWrestlerProfile {
  wrestler: SdhWrestler
  nameHistory: Array<SdhWrestlerNameHistory>
  promotions: Array<SdhWrestlerPromotion>
  alignments: Array<SdhWrestlerAlignment>
  attributes: Array<SdhWrestlerAttribute>
  roles: Array<SdhWrestlerRole>
  images: Array<SdhWrestlerImage>
  accomplishments: Array<SdhWrestlerAccomplishment>
}

/**
 * Load the complete SDH profile for the highest-confidence crosswalk match.
 * Missing crosswalk and dangling SDH rows are both treated as an unmatched
 * wrestler; child collections preserve their SDH `seq` order.
 */
export async function getSdhWrestlerProfile(
  cagematchId: string,
): Promise<SdhWrestlerProfile | null> {
  const supabase = getCachedSupabaseServerClient()
  const { data: crosswalk, error: crosswalkError } = await supabase
    .from('wrestler_crosswalk')
    .select('sdh_id')
    .eq('cagematch_id', cagematchId)
    .gte('confidence', SDH_MIN_CONFIDENCE)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (crosswalkError) throw new Error(crosswalkError.message)
  if (!crosswalk) return null

  const [
    wrestler,
    nameHistory,
    promotions,
    alignments,
    attributes,
    roles,
    images,
    accomplishments,
  ] = await Promise.all([
    supabase
      .from('sdh_wrestlers')
      .select('*')
      .eq('id', crosswalk.sdh_id)
      .maybeSingle(),
    supabase
      .from('sdh_wrestler_name_history')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
    supabase
      .from('sdh_wrestler_promotions')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
    supabase
      .from('sdh_wrestler_alignments')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
    supabase
      .from('sdh_wrestler_attributes')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
    supabase
      .from('sdh_wrestler_roles')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
    supabase
      .from('sdh_wrestler_images')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
    supabase
      .from('sdh_wrestler_accomplishments')
      .select('*')
      .eq('wrestler_id', crosswalk.sdh_id)
      .order('seq'),
  ])

  for (const result of [
    wrestler,
    nameHistory,
    promotions,
    alignments,
    attributes,
    roles,
    images,
    accomplishments,
  ]) {
    if (result.error) throw new Error(result.error.message)
  }
  if (!wrestler.data) return null

  return {
    wrestler: wrestler.data,
    nameHistory: nameHistory.data ?? [],
    promotions: promotions.data ?? [],
    alignments: alignments.data ?? [],
    attributes: attributes.data ?? [],
    roles: roles.data ?? [],
    images: images.data ?? [],
    accomplishments: accomplishments.data ?? [],
  }
}

/**
 * Resolve current SDH headshots for Cagematch wrestler ids via
 * `wrestler_crosswalk` → `sdh_wrestler_images`. The gallery preserves page
 * order with `seq` 0 = most recent, so the lowest seq wins per wrestler.
 * Only ids with a crosswalk match at `confidence >= SDH_MIN_CONFIDENCE` and
 * at least one gallery image are returned.
 */
export async function resolveWrestlerHeadshotUrls(
  wrestlerIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (wrestlerIds.length === 0) return map

  const supabase = getCachedSupabaseServerClient()
  const { data: crosswalk, error: xErr } = await supabase
    .from('wrestler_crosswalk')
    .select('cagematch_id, sdh_id, confidence')
    .in('cagematch_id', wrestlerIds)
    .gte('confidence', SDH_MIN_CONFIDENCE)
  if (xErr) throw new Error(xErr.message)

  // Highest confidence wins when a cagematch id has multiple matches.
  const sdhByCagematch = new Map<string, string>()
  for (const row of [...crosswalk].sort(
    (a, b) => b.confidence - a.confidence,
  )) {
    if (!sdhByCagematch.has(row.cagematch_id)) {
      sdhByCagematch.set(row.cagematch_id, row.sdh_id)
    }
  }
  if (sdhByCagematch.size === 0) return map

  const { data: images, error: iErr } = await supabase
    .from('sdh_wrestler_images')
    .select('wrestler_id, seq, image_url')
    .in('wrestler_id', Array.from(new Set(sdhByCagematch.values())))
    .order('seq')
  if (iErr) throw new Error(iErr.message)

  const headshotBySdh = new Map<string, string>()
  for (const img of images) {
    if (!headshotBySdh.has(img.wrestler_id)) {
      headshotBySdh.set(img.wrestler_id, img.image_url)
    }
  }

  for (const [cagematchId, sdhId] of sdhByCagematch) {
    const url = headshotBySdh.get(sdhId)
    if (url) map.set(cagematchId, url)
  }
  return map
}

/**
 * Load SDH title metadata and ordered name/belt-art history for the
 * highest-confidence crosswalk match.
 */
export async function getSdhTitleProfile(
  cagematchTitleId: string,
): Promise<SdhTitleProfile | null> {
  const supabase = getCachedSupabaseServerClient()
  const { data: crosswalk, error: crosswalkError } = await supabase
    .from('title_crosswalk')
    .select('sdh_id')
    .eq('cagematch_id', cagematchTitleId)
    .gte('confidence', SDH_MIN_CONFIDENCE)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (crosswalkError) throw new Error(crosswalkError.message)
  if (!crosswalk) return null

  const [titleRes, nameHistoryRes] = await Promise.all([
    supabase
      .from('sdh_titles')
      .select('*')
      .eq('id', crosswalk.sdh_id)
      .maybeSingle(),
    supabase
      .from('sdh_title_name_history')
      .select('*')
      .eq('title_id', crosswalk.sdh_id)
      .order('seq'),
  ])
  if (titleRes.error) throw new Error(titleRes.error.message)
  if (nameHistoryRes.error) throw new Error(nameHistoryRes.error.message)
  if (!titleRes.data) return null

  return {
    title: titleRes.data,
    nameHistory: nameHistoryRes.data ?? [],
  }
}

/**
 * Resolve SDH full-body portrait URLs for Cagematch wrestler ids via
 * `wrestler_crosswalk` → `sdh_wrestlers.image_url`. Falls back to the latest
 * gallery headshot when the full-body render is missing.
 */
export async function resolveWrestlerPortraitUrls(
  wrestlerIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (wrestlerIds.length === 0) return map

  const supabase = getCachedSupabaseServerClient()
  const { data: crosswalk, error: xErr } = await supabase
    .from('wrestler_crosswalk')
    .select('cagematch_id, sdh_id, confidence')
    .in('cagematch_id', wrestlerIds)
    .gte('confidence', SDH_MIN_CONFIDENCE)
  if (xErr) throw new Error(xErr.message)

  const sdhByCagematch = new Map<string, string>()
  for (const row of [...crosswalk].sort(
    (a, b) => b.confidence - a.confidence,
  )) {
    if (!sdhByCagematch.has(row.cagematch_id)) {
      sdhByCagematch.set(row.cagematch_id, row.sdh_id)
    }
  }
  if (sdhByCagematch.size === 0) return map

  const { data: wrestlers, error: wErr } = await supabase
    .from('sdh_wrestlers')
    .select('id, image_url')
    .in('id', Array.from(new Set(sdhByCagematch.values())))
  if (wErr) throw new Error(wErr.message)

  const portraitBySdh = new Map<string, string>()
  for (const w of wrestlers ?? []) {
    if (w.image_url) portraitBySdh.set(w.id, w.image_url)
  }

  const missing: Array<string> = []
  for (const [cagematchId, sdhId] of sdhByCagematch) {
    const url = portraitBySdh.get(sdhId)
    if (url) map.set(cagematchId, url)
    else missing.push(cagematchId)
  }

  if (missing.length > 0) {
    const gallery = await resolveWrestlerHeadshotUrls(missing)
    for (const [id, url] of gallery) map.set(id, url)
  }

  return map
}

/**
 * Resolve SDH belt `image_url`s for Cagematch title ids via `title_crosswalk`.
 * Returns only ids that have a match at `confidence >= SDH_MIN_CONFIDENCE`
 * with a non-null image. When multiple crosswalk rows exist, the highest
 * confidence wins.
 */
export async function resolveTitleImageUrls(
  titleIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (titleIds.length === 0) return map

  const supabase = getCachedSupabaseServerClient()
  const { data, error } = await supabase
    .from('title_crosswalk')
    .select('cagematch_id, confidence, sdh_titles(image_url)')
    .in('cagematch_id', titleIds)
    .gte('confidence', SDH_MIN_CONFIDENCE)
  if (error) throw new Error(error.message)

  const ranked = [...data].sort((a, b) => b.confidence - a.confidence)
  for (const row of ranked) {
    if (map.has(row.cagematch_id)) continue
    const embedded = row.sdh_titles
    const url = (Array.isArray(embedded) ? embedded[0] : embedded)?.image_url
    if (url) map.set(row.cagematch_id, url)
  }
  return map
}
