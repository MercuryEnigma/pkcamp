import { useTranslation } from 'react-i18next'
import { useEffect, useRef, type ReactNode } from 'react'

/** A modal dialog controlled by `open`; Esc and the Close button call `onClose`. */
export function Dialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation(['hub', 'common'] as const)

  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="hub-dialog" onClose={onClose}>
      <h2>{title}</h2>
      {children}
      <div className="hub-dialog-actions">
        <button type="button" onClick={onClose}>
          {t('common:actions.close')}
        </button>
      </div>
    </dialog>
  )
}
