import type { DropdownOption } from './Dropdown'

export type StyleGroup = {
  label: string
  styles: string[]
  /** A CSS variable of main.css: readable on the panels of both themes. */
  color: string
  /** Why this color: each one is an image of what the family asks from the player. */
  meaning: string
}

/** Families of styles and tags, in the order shown. A style found in none goes to « Autres ». */
export const STYLE_GROUPS: StyleGroup[] = [
  {
    label: 'Aim',
    styles: ['Aim', 'Gros jumps'],
    color: 'var(--color-style-aim)',
    meaning: 'Bleu clair : le vent, le curseur qui file d’un bout à l’autre de l’écran'
  },
  {
    label: 'Stream et stamina',
    styles: ['Stream', 'Deathstream', 'Streams espacés', 'Bursts'],
    color: 'var(--color-style-stream)',
    meaning: 'Orange : le feu qui monte dans les poignets'
  },
  {
    label: 'Speed',
    styles: ['Speed'],
    color: 'var(--color-style-speed)',
    meaning: 'Rouge : des flammes plus violentes, tout va trop vite'
  },
  {
    label: 'Tech',
    styles: ['Rythme 1/3 – 1/6', 'Changements de SV'],
    color: 'var(--color-style-tech)',
    meaning: 'Violet : l’arcane, des rythmes et des sliders qui jouent des tours'
  },
  {
    label: 'Lecture',
    styles: ['AR haut', 'AR bas', 'Overlaps', 'Stacks'],
    color: 'var(--color-style-reading)',
    meaning: 'Vert : l’œil, le regard qui balaie le terrain avant la main'
  },
  {
    label: 'Précision',
    styles: ['Précision', 'Accuracy'],
    color: 'var(--color-style-precision)',
    meaning: 'Or : le centre de la cible, le travail d’orfèvre'
  },
  {
    label: 'Taiko',
    styles: ['Stamina', 'Rythme', 'Couleur'],
    color: 'var(--color-style-taiko)',
    meaning: 'Bois : le fût du tambour'
  },
  {
    label: 'Mania',
    styles: ['Long notes', 'Rice'],
    color: 'var(--color-style-mania)',
    meaning: 'Fuchsia : les néons des claviers'
  },
  {
    label: 'Autres',
    styles: ['Équilibré', 'Marathon', 'Spinners'],
    color: 'var(--color-style-other)',
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
