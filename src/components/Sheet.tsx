import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { CheckIcon } from './icons'

interface SheetProps {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-overlay" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {title !== undefined && <h3>{title}</h3>}
        {children}
        <button type="button" className="sheet-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}

interface OptionSheetProps {
  open: boolean
  title: string
  options: readonly string[]
  value: string
  onSelect: (value: string) => void
  onClose: () => void
}

export function OptionSheet({ open, title, options, value, onSelect, onClose }: OptionSheetProps) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="sheet-options">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={`sheet-option${option === value ? ' is-active' : ''}`}
            onClick={() => {
              onSelect(option)
              onClose()
            }}
          >
            <span>{option}</span>
            {option === value && <CheckIcon />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
