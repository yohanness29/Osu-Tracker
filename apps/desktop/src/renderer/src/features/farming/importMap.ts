import type { ImportedMap } from '../../../../main/farming'
import { errorMessage } from '../../shared/errors'

export { errorMessage }

/**
 * The id of a difficulty, from the id itself or a link to it:
 * osu.ppy.sh/b/123, osu.ppy.sh/beatmaps/123 or osu.ppy.sh/beatmapsets/45#osu/123.
 */
export function parseBeatmapId(text: string): number | null {
  const value = text.trim()
  const match =
    /^(\d+)$/.exec(value) ?? /#[a-z]+\/(\d+)/.exec(value) ?? /\/(?:b|beatmaps)\/(\d+)/.exec(value)
  const id = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const EXCLUSION_REASONS = {
  unreachable: 'le score dépasserait de loin ton meilleur score',
  'no-gain': 'il ne battrait pas tes top plays ni ton score sur cette map'
}

/** What the imported map would give, in one sentence. */
export function importSummary(imported: ImportedMap): string {
  const name = `${imported.title} [${imported.version}]`
  if (!imported.givesPp)
    return `${name} est importée, mais elle n’est pas classée : elle ne donne pas de pp.`
  const { best } = imported
  if (!best) return `${name} est importée. Relie ton compte pour savoir ce qu’elle te rapporterait.`

  const way = `en ${best.mods || 'NM'} à ${best.accuracy.toFixed(1)}%`
  if (best.excluded) {
    return `${name} est importée : ${best.pp.toFixed(0)}pp ${way}, mais ${EXCLUSION_REASONS[best.excluded]}.`
  }
  return `${name} est importée : +${best.gain.toFixed(1)}pp sur ton profil ${way} (${best.pp.toFixed(0)}pp).`
}
