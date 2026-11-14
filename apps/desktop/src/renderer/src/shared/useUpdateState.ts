import { useEffect, useState } from 'react'
import type { UpdateState } from '../../../main/updates'

export function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  useEffect(() => {
    window.api.getUpdateState().then(setState).catch(console.error)
    return window.api.onUpdateState(setState)
  }, [])
  return state
}
