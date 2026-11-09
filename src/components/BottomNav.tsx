import { NavLink } from 'react-router-dom'
import { DevicesIcon, UserIcon } from './icons'

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
        <DevicesIcon />
        <span>设备</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
        <UserIcon />
        <span>我的</span>
      </NavLink>
    </nav>
  )
}
