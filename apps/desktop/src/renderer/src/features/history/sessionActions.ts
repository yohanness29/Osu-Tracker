import { notify, type MenuAction } from '../../shared/actionMenuStore'

/** What a right click on a session offers. */
export function sessionActions(sessionId: string): MenuAction[] {
  return [
    {
      label: 'Exporter en JSON',
      run: async () => {
        const path = await window.api.exportSession(sessionId)
        if (path) notify(`Session exportée : ${path}`)
      }
    }
  ]
}
