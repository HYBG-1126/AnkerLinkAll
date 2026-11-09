import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon } from './icons'

interface RootHeaderProps {
  title: string
  action?: ReactNode
}

export function RootHeader({ title, action }: RootHeaderProps) {
  return (
    <header className="root-header">
      <h1>{title}</h1>
      {action !== undefined && <div className="header-action">{action}</div>}
    </header>
  )
}

interface DetailHeaderProps {
  title: string
  action?: ReactNode
}

export function DetailHeader({ title, action }: DetailHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="detail-header">
      <button
        type="button"
        className="header-back"
        aria-label="返回"
        onClick={() => navigate(-1)}
      >
        <BackIcon />
      </button>
      <h1>{title}</h1>
      <div className="header-action">{action}</div>
    </header>
  )
}

interface LargeHeaderProps {
  title: string
  action?: ReactNode
}

export function LargeHeader({ title, action }: LargeHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="large-header">
      <div className="large-header-bar">
        <button
          type="button"
          className="header-back"
          aria-label="返回"
          onClick={() => navigate(-1)}
        >
          <BackIcon />
        </button>
        <div className="header-action">{action}</div>
      </div>
      <h1>{title}</h1>
    </header>
  )
}
