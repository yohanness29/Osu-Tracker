/**
 * Versions in the semver format: 1.1.0 for a stable version, 1.1.0-beta.2 for a beta.
 * Kept apart from the updater so that it can be tested without Electron.
 */

type Version = { core: number[]; prerelease: string[] }

function parse(version: string): Version {
  const [core = '', ...rest] = version.trim().replace(/^v/, '').split('+')[0]!.split('-')
  const prerelease = rest.join('-')
  return {
    core: core.split('.').map((part) => Number(part) || 0),
    prerelease: prerelease ? prerelease.split('.') : []
  }
}

function compareIdentifiers(a: string, b: string): number {
  const numeric = /^\d+$/
  if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b)
  // Numbers come before words, as semver says.
  if (numeric.test(a)) return -1
  if (numeric.test(b)) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** Negative when a is older than b, positive when it is newer, 0 when they are the same. */
export function compareVersions(a: string, b: string): number {
  const left = parse(a)
  const right = parse(b)
  for (let index = 0; index < Math.max(left.core.length, right.core.length); index += 1) {
    const difference = (left.core[index] ?? 0) - (right.core[index] ?? 0)
    if (difference !== 0) return difference
  }
  // 1.1.0-beta.2 comes before 1.1.0: the stable version replaces its betas.
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length
  }
  for (
    let index = 0;
    index < Math.max(left.prerelease.length, right.prerelease.length);
    index += 1
  ) {
    const a = left.prerelease[index]
    const b = right.prerelease[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    const difference = compareIdentifiers(a, b)
    if (difference !== 0) return difference
  }
  return 0
}

export function isNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}

/** A beta, or any other test version: one with a suffix after its numbers. */
export function isBeta(version: string): boolean {
  return parse(version).prerelease.length > 0
}
