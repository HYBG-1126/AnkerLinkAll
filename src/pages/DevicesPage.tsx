import { useNavigate } from 'react-router-dom'
import productImage from '../assets/device-160w.png'
import { RootHeader } from '../components/PageHeader'
import { BluetoothBadgeIcon, PlusIcon } from '../components/icons'
import { useBle } from '../hooks/useBle'
import { useDeviceSettings } from '../hooks/useDeviceSettings'

export function DevicesPage() {
  const { state, manager } = useBle()
  const navigate = useNavigate()
  const { settings } = useDeviceSettings('demo')

  const handleScan = () => {
    void manager.requestDevice({ acceptAllDevices: false })
  }

  const openKnownDevice = (deviceId: string) => {
    const target = state.knownDevices.find((device) => device.id === deviceId)
    if (target && !target.connected) void manager.connect(deviceId)
    navigate('/device')
  }

  return (
    <div className="page">
      <RootHeader
        title="我的设备"
        action={
          <button
            type="button"
            className="header-icon-btn"
            aria-label="扫描附近设备"
            disabled={!state.supported || state.busy}
            onClick={handleScan}
          >
            {state.busy ? <span className="spinner is-dark" aria-hidden="true" /> : <PlusIcon />}
          </button>
        }
      />

      {!state.supported && (
        <div className="notice">
          当前环境不支持 Web Bluetooth，仅可浏览演示界面。在 macOS 客户端中可使用真实蓝牙。
        </div>
      )}

      <div className="device-card-list">
        {state.knownDevices.map((device) => (
          <button
            type="button"
            key={device.id}
            className="device-card"
            onClick={() => openKnownDevice(device.id)}
          >
            <span className="device-thumb">
              <img src={productImage} alt="" />
            </span>
            <span className="device-card-text">
              <span className="device-card-name">{device.name}</span>
              <span className={`device-card-status${device.connected ? ' is-online' : ''}`}>
                <BluetoothBadgeIcon size={13} />
                {device.connected ? '已连接' : '未连接'}
              </span>
            </span>
          </button>
        ))}

        {state.knownDevices.length === 0 && (
          <button type="button" className="device-card" onClick={() => navigate('/device')}>
            <span className="device-thumb">
              <img src={productImage} alt="" />
            </span>
            <span className="device-card-text">
              <span className="device-card-name">{settings.name}</span>
              <span className="device-card-status">
                <BluetoothBadgeIcon size={13} />
                未连接
              </span>
            </span>
          </button>
        )}
      </div>

      {state.knownDevices.length === 0 && (
        <p className="page-footnote">
          当前展示演示数据。点击右上角 + 扫描并连接附近的安克蓝牙设备。
        </p>
      )}

      {state.knownDevices.length > 0 && (
        <button type="button" className="scan-link" onClick={handleScan} disabled={!state.supported || state.busy}>
          <PlusIcon size={16} /> 扫描附近设备
        </button>
      )}
    </div>
  )
}
