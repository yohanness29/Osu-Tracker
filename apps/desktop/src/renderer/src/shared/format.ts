export function mapName(map: { title: string; version: string; beatmapId: number }): string {
  return map.title ? `${map.title} [${map.version}]` : `Beatmap #${map.beatmapId}`
}

export function splitMods(mods: string): string[] {
  return mods.match(/.{2}/g) ?? []
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function passRate(passed: number, failed: number): number | null {
  const finished = passed + failed
  return finished > 0 ? Math.round((passed / finished) * 100) : null
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60000)
  if (minutes < 1) return "moins d'1 min"
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

export function formatTiming(hitError: number): string {
  const rounded = Math.abs(hitError).toFixed(1)
  if (Math.abs(hitError) < 1) return 'bien calé'
  return `${rounded} ms ${hitError < 0 ? 'en avance' : 'en retard'}`
}
