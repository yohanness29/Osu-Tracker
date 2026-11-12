import { describe, expect, it } from 'vitest'
import { typedValue } from './sliderValue'

const stars = { min: 3, max: 8, step: 0.1 }

describe('typedValue', () => {
  it('reads decimals written with a comma or a point', () => {
    expect(typedValue('5,5', stars, [3, 8])).toBe(5.5)
    expect(typedValue('5.55', stars, [3, 8])).toBe(5.6)
    expect(typedValue('6.2★', stars, [3, 8])).toBe(6.2)
  })

  it('stays inside the slider and on its side of the other handle', () => {
    expect(typedValue('12', stars, [3, 8])).toBe(8)
    expect(typedValue('1', stars, [3, 8])).toBe(3)
    expect(typedValue('4', stars, [5, 8])).toBe(5)
  })

  it('follows the steps of the slider', () => {
    expect(typedValue('173', { min: 60, max: 320, step: 5 }, [60, 320])).toBe(175)
  })

  it('ignores text that is not a number', () => {
    expect(typedValue('', stars, [3, 8])).toBeNull()
    expect(typedValue('abc', stars, [3, 8])).toBeNull()
  })
})
