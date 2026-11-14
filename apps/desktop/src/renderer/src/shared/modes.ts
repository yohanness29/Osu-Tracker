// Keys are the mode names sent by tosu.
export const MODES = [
  { key: 'osu', label: 'osu!' },
  { key: 'taiko', label: 'Taiko' },
  { key: 'fruits', label: 'Catch' },
  { key: 'mania', label: 'Mania' }
]

export function modeLabel(mode: string): string {
  return MODES.find(({ key }) => key === mode)?.label ?? mode
}
