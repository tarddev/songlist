import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  variant = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        if (onCancel) onCancel()
        else if (onConfirm) onConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    confirmRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel, onConfirm])

  if (!open || typeof document === 'undefined') return null

  const confirmClass =
    variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={() => { if (!busy && onCancel) onCancel() }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 id="modal-title" className="modal-title">{title}</h3>}
        {message && <p className="modal-message">{message}</p>}
        <div className="modal-actions">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
