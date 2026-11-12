export type Searchable = {
  title: string
  artist: string
  version: string
  mapper: string
  beatmapId: number
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Every word must be found, in any order, among the texts of the map or its ID. */
export function matchesSearch(map: Searchable, search: string): boolean {
  const haystack = normalize(
    [map.title, map.artist, map.version, map.mapper, String(map.beatmapId)].join(' ')
  )
  return normalize(search)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}
