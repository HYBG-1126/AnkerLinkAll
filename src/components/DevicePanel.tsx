import { useState } from 'react'
import type { FormEvent } from 'react'
import type { BleManager } from '../lib/ble/manager'
import type { BleState } from '../lib/ble/types'
import { shortUuid } from '../lib/uuid'
import { LinkIcon, RefreshIcon, ScanIcon, UnlinkIcon } from './icons'

interface DevicePanelProps {
  state: BleState
  manager: BleManager
  advancedOpen?: boolean
}

export function DevicePanel({ state, manager, advancedOpen = false }: DevicePanelProps) {
  const [acceptAllDevices, setAcceptAllDevices] = useState(true)
  const [serviceUuid, setServiceUuid] = useState('')
  const canScan = state.supported && state.secureContext && !state.busy

  const handleScan = () => {
    void manager.requestDevice({ acceptAllDevices })
  }

  const handleAddService = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (manager.addExtraServiceUuid(serviceUuid)) setServiceUuid('')
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>设备扫描</h2>
        <button
          type="button"
          className="icon-btn"
          title="刷新已授权设备"
          onClick={() => void manager.refreshKnownDevices()}
        >
          <RefreshIcon />
        </button>
      </header>

      <div className="panel-body">
        <button type="button" className="btn btn-primary btn-block" disabled={!canScan} onClick={handleScan}>
          {state.busy ? <span className="spinner" aria-hidden="true" /> : <ScanIcon />}
          {state.busy ? '处理中…' : '扫描附近设备'}
        </button>

        <label className="checkline">
          <input
            type="checkbox"
            checked={acceptAllDevices}
            onChange={(event) => setAcceptAllDevices(event.target.checked)}
          />
          <span>显示全部 BLE 设备（不限于安克品牌）</span>
        </label>
        <p className="hint">
          浏览器会弹出系统设备选择器并显示信号强度，选中设备后自动连接并读取 GATT 服务。
        </p>

        <div className="section-label">
          <span>已授权设备</span>
          <span className="muted">{state.knownDevices.length}</span>
        </div>

        {state.knownDevices.length === 0 ? (
          <p className="empty-hint">暂无已授权设备，点击上方按钮开始扫描。</p>
        ) : (
          <ul className="device-list">
            {state.knownDevices.map((device) => {
              const isCurrent = state.device?.id === device.id
              return (
                <li key={device.id} className={`device-row${isCurrent ? ' is-current' : ''}`}>
                  <div className="device-main">
                    <span className={`status-dot${device.connected ? ' is-on' : ''}`} aria-hidden="true" />
                    <div className="device-text">
                      <p className="device-name">{device.name}</p>
                      <p className="device-id">{device.id}</p>
                    </div>
                  </div>
                  <div className="device-actions">
                    {isCurrent && state.connectionState === 'connected' ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => void manager.disconnect()}
                      >
                        <UnlinkIcon size={14} /> 断开
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={!canScan}
                        onClick={() => void manager.connect(device.id)}
                      >
                        <LinkIcon size={14} /> 连接
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-btn danger"
                      onClick={() => void manager.forgetDevice(device.id)}
                    >
                      移除
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <details className="advanced" open={advancedOpen}>
          <summary>高级 · 厂商服务 UUID</summary>
          <p className="hint">私有协议服务需先在此登记，浏览器才允许访问；修改后在下次连接时生效。</p>
          <form className="inline-form" onSubmit={handleAddService}>
            <input
              value={serviceUuid}
              onChange={(event) => setServiceUuid(event.target.value)}
              placeholder="0000ffe0-0000-1000-8000-00805f9b34fb"
              spellCheck={false}
              aria-label="厂商服务 UUID"
            />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={!serviceUuid.trim()}>
              添加
            </button>
          </form>
          <div className="chip-list">
            {state.extraServiceUuids.length === 0 ? (
              <span className="muted">暂未添加</span>
            ) : (
              state.extraServiceUuids.map((uuid) => (
                <span className="chip" key={uuid} title={uuid}>
                  {shortUuid(uuid)}
                  <button
                    type="button"
                    onClick={() => manager.removeExtraServiceUuid(uuid)}
                    aria-label={`移除 ${shortUuid(uuid)}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </details>
      </div>
    </section>
  )
}
