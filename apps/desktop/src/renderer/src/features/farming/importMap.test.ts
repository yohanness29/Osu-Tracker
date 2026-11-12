import { describe, expect, it } from 'vitest'
import type { ImportedMap } from '../../../../main/farming'
import { errorMessage, importSummary, parseBeatmapId } from './importMap'

describe('parseBeatmapId', () => {
  it('reads an id or a link to a difficulty', () => {
    expect(parseBeatmapId(' 1860169 ')).toBe(1860169)
    expect(parseBeatmapId('https://osu.ppy.sh/b/1860169')).toBe(1860169)
    expect(parseBeatmapId('https://osu.ppy.sh/beatmaps/1860169?mode=osu')).toBe(1860169)
    expect(parseBeatmapId('https://osu.ppy.sh/beatmapsets/886499#osu/1860169')).toBe(1860169)
  })

  it('refuses anything else', () => {
    expect(parseBeatmapId('')).toBeNull()
    expect(parseBeatmapId('raise my sword')).toBeNull()
    expect(parseBeatmapId('https://osu.ppy.sh/beatmapsets/886499')).toBeNull()
  })
})

describe('errorMessage', () => {
  it('keeps only the message written by the app', () => {
    const error = new Error(
      "Error invoking remote method 'farming:import': Error: Aucune map osu! avec l’identifiant 1."
    )
    expect(errorMessage(error)).toBe('Aucune map osu! avec l’identifiant 1.')
  })
})

describe('importSummary', () => {
  const imported: ImportedMap = {
    beatmapId: 1,
    checksum: 'c',
    mode: 'osu',
    title: 'Night of Knights',
    version: 'The World',
    givesPp: true,
    best: { mods: '', accuracy: 98, pp: 402, gain: 0, excluded: 'unreachable' }
  }

  it('says what the map would give, or why it gives nothing', () => {
    expect(
      importSummary({ ...imported, best: { ...imported.best!, gain: 12.34, excluded: null } })
    ).toBe(
      'Night of Knights [The World] est importée : +12.3pp sur ton profil en NM à 98.0% (402pp).'
    )
    expect(importSummary(imported)).toContain('dépasserait de loin ton meilleur score')
    expect(importSummary({ ...imported, givesPp: false })).toContain('pas classée')
  })
})
