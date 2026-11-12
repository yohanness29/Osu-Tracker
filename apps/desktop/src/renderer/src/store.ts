import { create } from 'zustand'
import type { GameFrame } from '@osu-tracker/shared'
import type { TrackingStatus } from '../../main/tracking'

type TrackingState = {
  status: TrackingStatus | null
  frame: GameFrame | null
}

export const useTracking = create<TrackingState>(() => ({ status: null, frame: null }))

export function connectTracking(): () => void {
  window.api.getStatus().then((status) => useTracking.setState({ status }))
  const stopStatus = window.api.onStatus((status) => useTracking.setState({ status }))
  const stopFrames = window.api.onFrame((frame) => useTracking.setState({ frame }))

  return () => {
    stopStatus()
    stopFrames()
  }
}
