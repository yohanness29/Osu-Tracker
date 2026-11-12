// Keys are the mode names sent by tosu.
export const MODES = [
  { key: 'osu', label: 'osu!', icon: '●' },
  { key: 'taiko', label: 'Taiko', icon: '◐' },
  { key: 'fruits', label: 'Catch', icon: '◆' },
  { key: 'mania', label: 'Mania', icon: '▮' }
]

export function modeLabel(mode: string): string {
  return MODES.find(({ key }) => key === mode)?.label ?? mode
}
