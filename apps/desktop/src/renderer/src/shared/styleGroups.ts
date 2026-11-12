import type { DropdownOption } from './Dropdown'

export type StyleGroup = {
  label: string
  styles: string[]
  /** Readable on the dark panels of the app. */
  color: string
  /** Why this color: each one is an image of what the family asks from the player. */
  meaning: string
}

/** Families of styles and tags, in the order shown. A style found in none goes to « Autres ». */
export const STYLE_GROUPS: StyleGroup[] = [
  {
    label: 'Aim',
    styles: ['Aim', 'Gros jumps'],
    color: '#7cc8ff',
    meaning: 'Bleu clair : le vent, le curseur qui file d’un bout à l’autre de l’écran'
  },
  {
    label: 'Stream et stamina',
    styles: ['Stream', 'Deathstream', 'Streams espacés', 'Bursts'],
    color: '#ff9a3c',
    meaning: 'Orange : le feu qui monte dans les poignets'
  },
  {
    label: 'Speed',
    styles: ['Speed'],
    color: '#ff4d4d',
    meaning: 'Rouge : des flammes plus violentes, tout va trop vite'
  },
  {
    label: 'Tech',
    styles: ['Rythme 1/3 – 1/6', 'Changements de SV'],
    color: '#b388ff',
    meaning: 'Violet : l’arcane, des rythmes et des sliders qui jouent des tours'
  },
  {
    label: 'Lecture',
    styles: ['AR haut', 'AR bas', 'Overlaps', 'Stacks'],
    color: '#5fd38d',
    meaning: 'Vert : l’œil, le regard qui balaie le terrain avant la main'
  },
  {
    label: 'Précision',
    styles: ['Précision', 'Accuracy'],
    color: '#ffd166',
    meaning: 'Or : le centre de la cible, le travail d’orfèvre'
  },
  {
    label: 'Taiko',
    styles: ['Stamina', 'Rythme', 'Couleur'],
    color: '#d9a066',
    meaning: 'Bois : le fût du tambour'
  },
  {
    label: 'Mania',
    styles: ['Long notes', 'Rice'],
    color: '#e879f9',
    meaning: 'Fuchsia : les néons des claviers'
  },
  {
    label: 'Autres',
    styles: ['Équilibré', 'Marathon', 'Spinners'],
    color: '#a8a3b8',
    meaning: 'Gris : ce qui ne penche vers aucune famille'
  }
]

const OTHER_GROUP = 'Autres'

function placeOf(style: string): [number, number] {
  for (const [groupIndex, group] of STYLE_GROUPS.entries()) {
    const index = group.styles.indexOf(style)
    if (index !== -1) return [groupIndex, index]
  }
  return [STYLE_GROUPS.length - 1, Infinity]
}

/** The family of a style, « Autres » when it has none. */
export function styleGroupOf(style: string): StyleGroup {
  return STYLE_GROUPS[placeOf(style)[0]]!
}

/** The styles and tags found, sorted into their families. */
export function groupedStyleOptions(styles: Iterable<string>): DropdownOption[] {
  return [...new Set(styles)]
    .map((style) => ({ style, place: placeOf(style) }))
    .toSorted(
      (a, b) =>
        a.place[0] - b.place[0] || a.place[1] - b.place[1] || a.style.localeCompare(b.style, 'fr')
    )
    .map(({ style, place: [groupIndex] }) => ({
      value: style,
      label: style,
      group: STYLE_GROUPS[groupIndex]?.label ?? OTHER_GROUP,
      color: STYLE_GROUPS[groupIndex]?.color
    }))
}
