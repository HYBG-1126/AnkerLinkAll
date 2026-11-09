import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import productImage from '../assets/device-160w-empty.png'
import { DeviceCables } from '../components/DeviceCables'
import { DetailHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { OptionSheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import {
  BluetoothBadgeIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoHexIcon,
  OutputIcon,
  PowerIcon,
  SettingsHexIcon,
} from '../components/icons'
import { useBle } from '../hooks/useBle'
import { useCurrentDeviceProfile } from '../hooks/useCurrentDeviceProfile'
import {
  CHARGING_MODES,
  CHARGING_MODE_LABELS,
  CHARGING_MODE_VALUES,
  useDeviceSettings,
} from '../hooks/useDeviceSettings'
import type { AnkerPortTelemetry } from '../lib/anker/protocol'
import { isAnkerDeviceName } from '../lib/ble/manager'
import type { PortId } from '../lib/deviceData'

const TIMER_OPTIONS = ['关闭', '15 分钟', '30 分钟', '1 小时', '2 小时'] as const
const TIMER_SECONDS: Record<string, number> = {
  关闭: 0,
  '15 分钟': 15 * 60,
  '30 分钟': 30 * 60,
  '1 小时': 60 * 60,
  '2 小时': 2 * 60 * 60,
}

function formatWatts(value: number | null): string {
  return value === null ? '--' : value.toFixed(1)
}

function formatVoltage(value: number | null): string {
  return value === null ? '--V' : `${value.toFixed(1)}V`
}

function formatCurrent(value: number | null): string {
  return value === null ? '--A' : `${value.toFixed(2)}A`
}

function isPlugged(port: AnkerPortTelemetry): boolean {
  if (port.cableCode !== null) return !port.cableCode.startsWith('03')
  return (port.power ?? 0) > 0.2
}

function statusChip(phase: string, connected: boolean): string {
  if (!connected) return '未连接'
  switch (phase) {
    case 'ready':
      return '实时'
    case 'handshaking':
      return '握手中'
    case 'error':
      return '协议异常'
    case 'unsupported':
      return '标准 GATT'
    default:
      return '未就绪'
  }
}

export function DevicePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { state, manager } = useBle()
  const { connected, deviceKey, profile } = useCurrentDeviceProfile()
  const { settings, update } = useDeviceSettings(deviceKey)
  const [selectedPort, setSelectedPort] = useState<PortId>('C1')
  const [modeOpen, setModeOpen] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)

  const anker = state.anker
  const ports = anker.ports
  const currentPort = ports.find((port) => port.id === selectedPort) ?? ports[0]
  const displayName = profile.name
  const sessionReady = connected && anker.phase === 'ready'
  const chip = statusChip(anker.phase, connected)
  const liveMode = anker.chargingMode !== null ? CHARGING_MODE_LABELS[anker.chargingMode] : null

  const handleBluetooth = () => {
    if (connected) {
      toast('蓝牙已连接')
      return
    }
    if (state.reconnecting) {
      toast('正在自动重连充电器…')
      return
    }
    const known =
      state.knownDevices.find((device) => !device.connected && isAnkerDeviceName(device.name)) ??
      state.knownDevices.find((device) => isAnkerDeviceName(device.name))
    if (known) {
      toast(`正在连接 ${known.name} …`)
      void manager.connect(known.id)
      return
    }
    void manager.requestDevice({ acceptAllDevices: true })
  }

  const toggleTimer = () => {
    if (!sessionReady) {
      toast('请先连接充电器并等待安克会话建立')
      return
    }
    setTimerOpen(true)
  }

  const applyTimer = (option: string) => {
    const seconds = TIMER_SECONDS[option] ?? 0
    void manager.setAnkerPortTimer(selectedPort, seconds).then((ok) => {
      if (!ok) {
        toast('定时指令发送失败')
        return
      }
      update({ portTimer: { ...settings.portTimer, [selectedPort]: seconds > 0 } })
      toast(seconds > 0 ? `${selectedPort} 定时${option}` : `${selectedPort} 定时已关闭`)
    })
  }

  const togglePower = () => {
    if (!sessionReady) {
      toast('请先连接充电器并等待安克会话建立')
      return
    }
    const next = !currentPort.outputOn
    void manager.setAnkerPortPower(selectedPort, next).then((ok) => {
      toast(ok ? `${selectedPort} 输出已${next ? '开启' : '关闭'}` : '端口指令发送失败')
    })
  }

  const applyMode = (mode: string) => {
    const value = CHARGING_MODE_VALUES[mode]
    if (value === undefined) return
    if (!sessionReady) {
      toast('请先连接充电器并等待安克会话建立')
      return
    }
    void manager.setAnkerChargingMode(value).then((ok) => {
      if (ok) update({ chargingMode: mode })
      toast(ok ? `已切换为 ${mode}` : '充电模式指令发送失败')
    })
  }

  const footnote = (() => {
    if (!connected && state.reconnecting) return '与充电器的连接中断，正在自动重连…'
    if (!connected) return state.connectionError ?? '连接安克 A2687 充电器后，这里会显示真实的端口功率、电压与电流。'
    if (anker.phase === 'handshaking') return anker.message
    if (anker.phase === 'error' || anker.phase === 'unsupported') return anker.message
    if (anker.phase === 'ready' && anker.lastUpdatedAt === null) return '会话已建立，等待设备上报遥测数据…'
    return null
  })()

  return (
    <div className="page device-page">
      <DetailHeader
        title={displayName}
        action={
          <button
            type="button"
            className="header-icon-btn"
            aria-label="设备设置"
            onClick={() => navigate('/device/settings')}
          >
            <SettingsHexIcon />
          </button>
        }
      />

      <section className="device-hero">
        {connected ? (
          <div className="hero-stage">
            <img src={productImage} alt={displayName} className="hero-product" />
            <DeviceCables activePorts={ports.filter(isPlugged).map((port) => port.id)} />
          </div>
        ) : (
          <div className="hero-empty">
            <BluetoothBadgeIcon size={30} />
            <p>未连接设备</p>
            <span>点击下方蓝牙按钮扫描并连接附近的安克设备</span>
          </div>
        )}
      </section>

      <div className="hero-actions">
        <button
          type="button"
          className="output-pill"
          onClick={() => toast(isPlugged(currentPort) ? '当前端口正在输出' : '未检测到线缆')}
        >
          <OutputIcon size={15} /> 输出
        </button>
        <button
          type="button"
          className={`bt-fab${connected ? ' is-connected' : ''}`}
          aria-label={connected ? '蓝牙已连接' : '连接蓝牙'}
          onClick={handleBluetooth}
        >
          <BluetoothBadgeIcon size={20} />
        </button>
      </div>

      <section className="port-summary-card">
        {ports.map((port) => {
          const plugged = isPlugged(port)
          return (
            <button
              type="button"
              key={port.id}
              className={`port-summary${selectedPort === port.id ? ' is-active' : ''}`}
              onClick={() => setSelectedPort(port.id)}
            >
              <span className="port-chip">{port.id}</span>
              <span className="port-power">
                {plugged ? formatWatts(port.power) : '--'} <em>W</em>
              </span>
              <span className="port-vi">
                {plugged || port.voltage !== null
                  ? `${formatVoltage(port.voltage)} / ${formatCurrent(port.current)}`
                  : '--V / --A'}
              </span>
            </button>
          )
        })}
      </section>

      <div className="section-heading">
        <h2>实时数据</h2>
        <span className={`demo-chip${anker.phase === 'ready' ? ' is-live' : ''}`}>{chip}</span>
        <ChevronRightIcon className="section-chevron" />
      </div>
      <section className="card chart-card">
        <p className="chart-label">总输出</p>
        <p className="chart-value">
          {formatWatts(anker.totalPower)} <span>W</span>
        </p>
        <Sparkline data={anker.history} />
      </section>

      <div className="section-heading">
        <h2>端口控制</h2>
      </div>
      <section className="card port-control">
        <div className="port-tabs">
          {ports.map((port) => (
            <button
              type="button"
              key={port.id}
              className={selectedPort === port.id ? 'is-active' : undefined}
              onClick={() => setSelectedPort(port.id)}
            >
              {port.id}
            </button>
          ))}
        </div>

        <div className="port-control-body">
          <div className="port-setting-row">
            <span>端口设置</span>
            <div className="port-toggle-group">
              <button
                type="button"
                className={`port-toggle is-outline${settings.portTimer[selectedPort] ? ' is-on' : ''}`}
                aria-label="端口定时"
                onClick={toggleTimer}
              >
                <ClockIcon />
              </button>
              <button
                type="button"
                className={`port-toggle is-filled${currentPort.outputOn ? ' is-on' : ''}`}
                aria-label="端口电源"
                onClick={togglePower}
                disabled={!sessionReady}
              >
                <PowerIcon />
              </button>
            </div>
          </div>

          <div className="port-info">
            <div>
              <span>线缆信息</span>
              <span>{isPlugged(currentPort) ? (currentPort.cable ?? '已连接') : '未检测到线缆'}</span>
            </div>
            <div>
              <span>充电信息</span>
              <span>{currentPort.charging ?? '—'}</span>
            </div>
            <div>
              <span>设备信息</span>
              <span>{profile.model}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card mode-card">
        <button type="button" className="mode-row" onClick={() => setModeOpen(true)}>
          <span className="mode-label">
            <InfoHexIcon size={20} /> 充电模式
          </span>
          <span className="mode-value">
            {liveMode ?? '—'}
            <ChevronRightIcon />
          </span>
        </button>
      </section>

      {footnote !== null && <p className="page-footnote">{footnote}</p>}

      <OptionSheet
        open={modeOpen}
        title="充电模式"
        options={CHARGING_MODES}
        value={liveMode ?? ''}
        onSelect={applyMode}
        onClose={() => setModeOpen(false)}
      />

      <OptionSheet
        open={timerOpen}
        title={`${selectedPort} 定时关闭`}
        options={TIMER_OPTIONS}
        value={settings.portTimer[selectedPort] ? '' : '关闭'}
        onSelect={applyTimer}
        onClose={() => setTimerOpen(false)}
      />
    </div>
  )
}
