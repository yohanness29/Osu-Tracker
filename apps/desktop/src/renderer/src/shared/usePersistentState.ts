import { useEffect, useState } from 'react'

const PREFIX = 'osu-tracker:'

function read<T>(key: string, initial: T): T {
  try {
    const saved = localStorage.getItem(PREFIX + key)
    if (saved === null) return initial
    const value: unknown = JSON.parse(saved)
    // Fields added since the value was saved keep their default.
    if (isRecord(initial) && isRecord(value)) return { ...initial, ...value } as T
    return typeof value === typeof initial ? (value as T) : initial
  } catch {
    return initial
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Like `useState`, kept between launches of the app. */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState(() => read(key, initial))

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // Without storage, the filters are only lost on the next launch.
    }
  }, [key, value])

  return [value, setValue]
}
