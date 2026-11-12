import { useEffect, useState } from 'react'
import type { AccountStatus } from '../../../../main/account'

export function useAccount(): AccountStatus | null {
  const [status, setStatus] = useState<AccountStatus | null>(null)

  useEffect(() => {
    window.api.getAccount().then(setStatus)
    return window.api.onAccount(setStatus)
  }, [])

  return status
}
