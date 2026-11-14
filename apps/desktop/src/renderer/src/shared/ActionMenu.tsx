import { useEffect } from 'react'
import { FloatingMenu } from './FloatingMenu'
import { closeActionMenu, notify, useActionMenu } from './actionMenuStore'
import { errorMessage } from './errors'

const NOTICE_MS = 5000

/** The menu of a right click on something other than a map, and the notice of its result. */
export function ActionMenu(): React.JSX.Element {
  const target = useActionMenu((state) => state.target)
  const notice = useActionMenu((state) => state.notice)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => useActionMenu.setState({ notice: null }), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <>
      {target && (
        <FloatingMenu
          key={`${target.x}-${target.y}`}
          x={target.x}
          y={target.y}
          onClose={closeActionMenu}
          className="w-56"
        >
          {target.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                closeActionMenu()
                Promise.resolve(action.run()).catch((error: unknown) => notify(errorMessage(error)))
              }}
              className="w-full rounded-md px-3 py-1.5 text-left text-ink hover:bg-line"
            >
              {action.label}
            </button>
          ))}
        </FloatingMenu>
      )}
      {notice && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 max-w-md rounded-lg border border-line bg-panel-raised px-4 py-3 text-sm shadow-xl"
        >
          {notice.text}
        </div>
      )}
    </>
  )
}
