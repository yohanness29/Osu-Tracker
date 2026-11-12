import { describe, expect, it } from 'vitest'
import { groupedStyleOptions, STYLE_GROUPS, styleGroupOf } from './styleGroups'

describe('groupedStyleOptions', () => {
  it('sorts the styles into their families, unknown ones last', () => {
    const options = groupedStyleOptions(['Bursts', 'Inconnu', 'Aim', 'Stream', 'AR haut', 'Aim'])
    expect(options.map(({ value, group }) => [group, value])).toEqual([
      ['Aim', 'Aim'],
      ['Stream et stamina', 'Stream'],
      ['Stream et stamina', 'Bursts'],
      ['Lecture', 'AR haut'],
      ['Autres', 'Inconnu']
    ])
  })
})

describe('styleGroupOf', () => {
  it('gives each style the color of its family', () => {
    expect(styleGroupOf('Deathstream').label).toBe('Stream et stamina')
    expect(styleGroupOf('Inconnu').label).toBe('Autres')
    expect(new Set(STYLE_GROUPS.map(({ color }) => color)).size).toBe(STYLE_GROUPS.length)
  })
})
