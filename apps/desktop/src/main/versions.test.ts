import { describe, expect, it } from 'vitest'
import { compareVersions, isBeta, isNewer } from './versions'

describe('isNewer', () => {
  it('compares the numbers one by one', () => {
    expect(isNewer('1.10.0', '1.9.2')).toBe(true)
    expect(isNewer('v1.0.1', '1.0.1')).toBe(false)
    expect(isNewer('1.0.0', '1.0.1')).toBe(false)
  })

  it('puts a stable version after its betas', () => {
    expect(isNewer('1.1.0', '1.1.0-beta.2')).toBe(true)
    expect(isNewer('1.1.0-beta.2', '1.1.0')).toBe(false)
    expect(isNewer('1.1.0-beta.1', '1.0.1')).toBe(true)
  })

  it('orders the betas by their number', () => {
    expect(isNewer('1.1.0-beta.10', '1.1.0-beta.9')).toBe(true)
    expect(isNewer('1.1.0-beta.1', '1.1.0-beta.1')).toBe(false)
    expect(isNewer('1.1.0-beta', '1.1.0-alpha.3')).toBe(true)
    expect(compareVersions('1.1.0-beta', '1.1.0-beta.1')).toBeLessThan(0)
  })
})

describe('isBeta', () => {
  it('spots the versions with a suffix', () => {
    expect(isBeta('1.1.0-beta.1')).toBe(true)
    expect(isBeta('v1.1.0')).toBe(false)
  })
})
