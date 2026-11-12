/** Speed of the song with these mods. */
export function clockRate(mods: string): number {
  const list: string[] = mods.match(/.{2}/g) ?? []
  if (list.some((mod) => mod === 'DT' || mod === 'NC')) return 1.5
  return list.includes('HT') ? 0.75 : 1
}
