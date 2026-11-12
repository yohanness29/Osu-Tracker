/**
 * A value typed for a handle of a range slider: a comma works as a decimal point, and the
 * value is kept on the steps of the slider, inside its ends and on its side of the other
 * handle. Null when the text is not a number.
 */
export function typedValue(
  text: string,
  { min, max, step }: { min: number; max: number; step: number },
  [lowest, highest]: [number, number]
): number | null {
  const digits = text
    .trim()
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const number = Number(digits)
  if (!/\d/.test(digits) || !Number.isFinite(number)) return null

  // The small offset keeps a value written halfway, such as 5.55, from rounding down.
  const stepped = Math.round(number / step + 1e-9) * step
  // Steps such as 0.1 leave floating point noise behind.
  const rounded = Number(stepped.toFixed(String(step).split('.')[1]?.length ?? 0))
  return Math.min(Math.max(rounded, min, lowest), max, highest)
}
