import type { ReactNode } from 'react'
import { ChevronRightIcon } from './icons'

interface ListGroupProps {
  title?: string
  children: ReactNode
  className?: string
}

export function ListGroup({ title, children, className }: ListGroupProps) {
  return (
    <section className={`list-section${className !== undefined ? ` ${className}` : ''}`}>
      {title !== undefined && <h2 className="group-title">{title}</h2>}
      <div className="list-card">{children}</div>
    </section>
  )
}

interface ListRowProps {
  label: string
  value?: ReactNode
  icon?: ReactNode
  onClick?: () => void
  showChevron?: boolean
  danger?: boolean
  action?: ReactNode
}

export function ListRow({
  label,
  value,
  icon,
  onClick,
  showChevron = true,
  danger = false,
  action,
}: ListRowProps) {
  const content = (
    <>
      <span className="row-main">
        {icon !== undefined && <span className="row-icon">{icon}</span>}
        <span className="row-label">{label}</span>
      </span>
      <span className="row-right">
        {value !== undefined && <span className="row-value">{value}</span>}
        {action}
        {showChevron && <ChevronRightIcon className="row-chevron" />}
      </span>
    </>
  )

  const className = `list-row${danger ? ' is-danger' : ''}${onClick ? ' is-clickable' : ''}`

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
