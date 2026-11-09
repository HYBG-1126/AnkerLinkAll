import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ankerLogo from '../assets/anker-logo.svg'
import { RootHeader } from '../components/PageHeader'
import { ListGroup, ListRow } from '../components/List'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import {
  BellIcon,
  BookIcon,
  CompassIcon,
  HelpIcon,
  SettingsHexIcon,
  SpaceIcon,
  StarIcon,
  UserIcon,
} from '../components/icons'
import { useBle } from '../hooks/useBle'

const APP_VERSION = '0.1.0'

export function ProfilePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { state } = useBle()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const clearLocalData = () => {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('ankerlink.'))
    keys.forEach((key) => localStorage.removeItem(key))
    setClearOpen(false)
    toast(`已清除 ${keys.length} 项本地数据`)
  }

  return (
    <div className="page profile-page">
      <RootHeader
        title="我的"
        action={
          <button
            type="button"
            className="header-icon-btn"
            aria-label="消息通知"
            onClick={() => toast('暂无新消息')}
          >
            <BellIcon />
          </button>
        }
      />

      <section className="profile-card">
        <span className="avatar" aria-hidden="true">
          <UserIcon size={30} />
        </span>
        <div className="profile-text">
          <p className="profile-name">本机用户</p>
          <p className="profile-sub">
            {state.connectionState === 'connected'
              ? `已连接 · ${state.device?.name ?? ''}`
              : '未连接设备'}
          </p>
        </div>
        <span className="profile-tag">本地模式</span>
      </section>

      <section className="promo-card">
        <div className="promo-text">
          <p className="promo-title">安克官方商城</p>
          <p className="promo-sub">新品首发 · 会员专享 · 以旧换新</p>
        </div>
        <button type="button" className="promo-btn" onClick={() => toast('商城页面在移动端打开')}>
          成为创作者
        </button>
        <span className="promo-glow" aria-hidden="true" />
      </section>

      <ListGroup>
        <ListRow label="帮助和反馈" icon={<HelpIcon />} onClick={() => toast('反馈通道即将开放')} />
        <ListRow label="用户手册" icon={<BookIcon />} onClick={() => toast('用户手册尚未内置')} />
        <ListRow label="设备设置" icon={<SettingsHexIcon />} onClick={() => navigate('/device/settings')} />
        <ListRow label="关于" icon={<StarIcon />} onClick={() => setAboutOpen(true)} />
      </ListGroup>

      <ListGroup>
        <ListRow label="发现" icon={<CompassIcon />} onClick={() => toast('发现页在移动端打开')} />
        <ListRow label="安克创客空间" icon={<SpaceIcon />} onClick={() => toast('创客空间在移动端打开')} />
        <ListRow label="评价我们" icon={<StarIcon />} onClick={() => toast('感谢你的支持')} />
      </ListGroup>

      <button type="button" className="text-action" onClick={() => setClearOpen(true)}>
        清除本地数据
      </button>
      <p className="page-footnote">
        AnkerLinkAll v{APP_VERSION} · {state.supported ? '蓝牙可用' : '蓝牙不可用'}
      </p>

      <Sheet open={aboutOpen} title="关于" onClose={() => setAboutOpen(false)}>
        <div className="about-block">
          <img src={ankerLogo} alt="ANKER" className="about-logo" />
          <p className="about-name">AnkerLinkAll 安克万连</p>
          <p className="muted">版本 {APP_VERSION}</p>
          <p className="about-desc">
            通过蓝牙发现附近的安克设备，查看端口功率、控制输出，并提供 GATT 协议调试能力。
          </p>
        </div>
      </Sheet>

      <Sheet open={clearOpen} title="清除本地数据" onClose={() => setClearOpen(false)}>
        <p className="sheet-text">
          将删除设备名称、充电模式、端口开关和已登记的厂商服务 UUID，不影响已配对的系统蓝牙设备。
        </p>
        <button type="button" className="sheet-primary is-danger" onClick={clearLocalData}>
          清除数据
        </button>
      </Sheet>
    </div>
  )
}
