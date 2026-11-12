import { useEffect, useState } from 'react'
import type { RecentPlay, SessionSummary } from '@osu-tracker/storage'
import { useTracking } from '../../store'

const NO_PLAYS: RecentPlay[] = []

// totalResults changes each time a play is recorded.
export function useSessions(): {
  sessions: SessionSummary[] | null
  refresh: () => void
} {
  const results = useTracking((state) => state.status?.totalResults)
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    window.api.getSessions().then(setSessions)
  }, [results, version])

  return { sessions, refresh: () => setVersion((current) => current + 1) }
}

export function useSessionPlays(sessionId: string | null): RecentPlay[] {
  const results = useTracking((state) => state.status?.totalResults)
  const [plays, setPlays] = useState<RecentPlay[]>([])

  useEffect(() => {
    if (sessionId) window.api.getSessionPlays(sessionId).then(setPlays)
  }, [sessionId, results])

  return sessionId ? plays : NO_PLAYS
}
