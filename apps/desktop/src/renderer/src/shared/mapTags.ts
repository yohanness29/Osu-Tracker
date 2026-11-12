const HIGH_AR = 10.3
const LOW_AR = 8
const SMALL_CIRCLES_CS = 5
const ACCURACY_OD = 10
const MARATHON_SECONDS = 300

/** With the mods applied. Unknown values give no tag. */
export type MapSettings = {
  mode: string
  ar?: number | null
  cs?: number | null
  od?: number | null
  lengthSeconds?: number | null
}

/**
 * What the settings of a map ask for. Unlike the tags of its patterns, they change with the mods,
 * so they are read from the values shown next to them.
 */
export function settingTags({ mode, ar, cs, od, lengthSeconds }: MapSettings): string[] {
  const rules: [string, boolean][] = [
    ['AR haut', mode === 'osu' && ar != null && ar >= HIGH_AR],
    ['AR bas', mode === 'osu' && ar != null && ar <= LOW_AR],
    ['Précision', mode === 'osu' && cs != null && cs >= SMALL_CIRCLES_CS],
    ['Accuracy', od != null && od >= ACCURACY_OD],
    ['Marathon', lengthSeconds != null && lengthSeconds >= MARATHON_SECONDS]
  ]
  return rules.flatMap(([tag, applies]) => (applies ? [tag] : []))
}

export const TAG_DESCRIPTIONS: Record<string, string> = {
  Deathstream: 'Au moins un stream de 64 notes ou plus',
  'Streams espacés': 'Les notes des streams ne se touchent pas',
  Bursts: 'Beaucoup de suites rapides de 3 ou 4 notes',
  'Gros jumps': 'Beaucoup de jumps qui traversent une grande partie de l’écran',
  'Rythme 1/3 – 1/6': 'Une part notable du rythme en divisions ternaires',
  'Changements de SV': 'La vitesse des sliders change souvent',
  Stacks: 'Beaucoup de notes empilées sur la précédente',
  Overlaps: 'Beaucoup de notes qui touchent la précédente sans être en stream',
  Spinners: 'Les spinners occupent une part notable de la map',
  'AR haut': `AR ${HIGH_AR} ou plus avec les mods`,
  'AR bas': `AR ${LOW_AR} ou moins avec les mods`,
  Précision: `CS ${SMALL_CIRCLES_CS} ou plus avec les mods : petits cercles`,
  Accuracy: `OD ${ACCURACY_OD} ou plus avec les mods`,
  Marathon: 'Plus de 5 minutes avec les mods'
}
