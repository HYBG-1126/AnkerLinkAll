import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import productImage from '../assets/device-160w.png'
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
import { CHARGING_MODES, useDeviceSettings } from '../hooks/useDeviceSettings'
import { useTelemetry } from '../hooks/useTelemetry'
import type { PortId } from '../lib/deviceData'

export function DevicePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { state, manager } = useBle()
  const { connected, deviceKey, profile } = useCurrentDeviceProfile()
  const { settings, update } = useDeviceSettings(deviceKey)
  const { ports, history, totalPower } = useTelemetry(settings.portPower)
  const [selectedPort, setSelectedPort] = useState<PortId>('C1')
  const [modeOpen, setModeOpen] = useState(false)

  const currentPort = ports.find((port) => port.id === selectedPort) ?? ports[0]
  const displayName = connected ? profile.name : settings.name

  const handleBluetooth = () => {
    if (connected) {
      toast('蓝牙已连接')
      return
    }
    const known = state.knownDevices.find((device) => !device.connected) ?? state.knownDevices[0]
    if (known) {
      toast(`正在连接 ${known.name} …`)
      void manager.connect(known.id)
      return
    }
    void manager.requestDevice({ acceptAllDevices: false })
  }

  const toggleTimer = () => {
    const next = !settings.portTimer[selectedPort]
    update({ portTimer: { ...settings.portTimer, [selectedPort]: next } })
    toast(`${selectedPort} 定时${next ? '已开启' : '已关闭'}`)
  }

  const togglePower = () => {
    if (!currentPort.plugged) {
      toast(`${selectedPort} 未检测到线缆`)
      return
    }
    const next = !settings.portPower[selectedPort]
    update({ portPower: { ...settings.portPower, [selectedPort]: next } })
    toast(`${selectedPort} 输出已${next ? '开启' : '关闭'}`)
  }

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
        <img src={productImage} alt={displayName} className="hero-product" />
      </section>

      <div className="hero-actions">
        <button
          type="button"
          className="output-pill"
          onClick={() => toast(currentPort.plugged ? '正在为设备供电' : '未检测到充电设备')}
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
        {ports.map((port) => (
          <button
            type="button"
            key={port.id}
            className={`port-summary${selectedPort === port.id ? ' is-active' : ''}`}
            onClick={() => setSelectedPort(port.id)}
          >
            <span className="port-chip">{port.id}</span>
            <span className="port-power">
              {port.plugged ? port.power.toFixed(1) : '--'} <em>W</em>
            </span>
            <span className="port-vi">
              {port.voltage > 0 ? `${port.voltage.toFixed(1)}V / ${port.current.toFixed(1)}A` : '--V / --A'}
            </span>
          </button>
        ))}
      </section>

      <div className="section-heading">
        <h2>实时数据</h2>
        <span className="demo-chip">演示</span>
        <ChevronRightIcon className="section-chevron" />
      </div>
      <section className="card chart-card">
        <p className="chart-label">总输出</p>
        <p className="chart-value">
          {totalPower.toFixed(1)} <span>W</span>
        </p>
        <Sparkline data={history} />
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
                className={`port-toggle is-filled${settings.portPower[selectedPort] && currentPort.plugged ? ' is-on' : ''}`}
                aria-label="端口电源"
                onClick={togglePower}
              >
                <PowerIcon />
              </button>
            </div>
          </div>

          <div className="port-info">
            <div>
              <span>线缆信息</span>
              <span>{currentPort.cable}</span>
            </div>
            <div>
              <span>充电信息</span>
              <span>{currentPort.charging}</span>
            </div>
            <div>
              <span>设备信息</span>
              <span>{currentPort.device}</span>
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
            {settings.chargingMode}
            <ChevronRightIcon />
          </span>
        </button>
      </section>

      {!connected && (
        <p className="page-footnote">
          当前为演示数据。连接设备并接入安克私有协议后，可显示真实端口功率。
        </p>
      )}

      <OptionSheet
        open={modeOpen}
        title="充电模式"
        options={CHARGING_MODES}
        value={settings.chargingMode}
        onSelect={(mode) => {
          update({ chargingMode: mode })
          toast(`已切换为 ${mode}`)
        }}
        onClose={() => setModeOpen(false)}
      />
    </div>
  )
}
