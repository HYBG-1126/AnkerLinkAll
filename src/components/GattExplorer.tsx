import type { BleManager } from '../lib/ble/manager'
import type { BleState, CharacteristicInfo } from '../lib/ble/types'
import { formatTime, printableAscii, toHex } from '../lib/format'
import { shortUuid } from '../lib/uuid'
import { RefreshIcon } from './icons'

interface GattExplorerProps {
  state: BleState
  manager: BleManager
}

interface CharacteristicRowProps {
  info: CharacteristicInfo
  manager: BleManager
}

function ValuePreview({ value, lastUpdatedAt }: Pick<CharacteristicInfo, 'value' | 'lastUpdatedAt'>) {
  if (!value) return <p className="char-value is-empty">尚未读取</p>
  if (value.length === 0) return <p className="char-value is-empty">空数据</p>
  return (
    <div className="char-value">
      <code>{toHex(value)}</code>
      <span className="char-ascii">{printableAscii(value)}</span>
      {lastUpdatedAt !== null && <time>{formatTime(lastUpdatedAt)}</time>}
    </div>
  )
}

function CharacteristicRow({ info, manager }: CharacteristicRowProps) {
  const { properties } = info
  return (
    <div className="char-row">
      <div className="char-head">
        <div className="char-title">
          <span className="char-name">{info.name ?? '自定义特征值'}</span>
          <span className="uuid">{shortUuid(info.uuid)}</span>
        </div>
        <div className="char-actions">
          {properties.read && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => void manager.readCharacteristic(info.serviceUuid, info.uuid)}
            >
              读取
            </button>
          )}
          {(properties.notify || properties.indicate) && (
            <button
              type="button"
              className={`btn btn-xs ${info.notifying ? 'btn-active' : 'btn-ghost'}`}
              onClick={() => void manager.setNotifications(info.serviceUuid, info.uuid, !info.notifying)}
            >
              {info.notifying ? '停止通知' : '订阅通知'}
            </button>
          )}
        </div>
      </div>

      <div className="prop-row">
        {properties.read && <span className="prop">R</span>}
        {properties.write && <span className="prop">W</span>}
        {properties.writeWithoutResponse && <span className="prop">WNR</span>}
        {properties.notify && <span className="prop">N</span>}
        {properties.indicate && <span className="prop">I</span>}
      </div>

      <ValuePreview value={info.value} lastUpdatedAt={info.lastUpdatedAt} />
    </div>
  )
}

export function GattExplorer({ state, manager }: GattExplorerProps) {
  const totalCharacteristics = state.services.reduce(
    (total, service) => total + service.characteristics.length,
    0,
  )

  return (
    <section className="panel panel-grow">
      <header className="panel-header">
        <h2>GATT 服务浏览器</h2>
        <div className="panel-actions">
          {state.connectionState === 'connected' && (
            <>
              <span className="muted">
                {state.services.length} 服务 / {totalCharacteristics} 特征值
              </span>
              <button
                type="button"
                className="icon-btn"
                title="重新发现服务"
                disabled={state.busy}
                onClick={() => void manager.refreshServices()}
              >
                <RefreshIcon />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="panel-body">
        {state.connectionState !== 'connected' ? (
          <div className="placeholder">
            <p className="placeholder-title">尚未连接设备</p>
            <p className="placeholder-text">扫描并连接附近安克蓝牙设备后，这里会列出全部 GATT 服务与特征值。</p>
          </div>
        ) : state.services.length === 0 ? (
          <div className="placeholder">
            <p className="placeholder-title">正在发现服务…</p>
            <p className="placeholder-text">如果长时间没有结果，请尝试重新发现或重新连接。</p>
          </div>
        ) : (
          <div className="service-list">
            {state.services.map((service, index) => (
              <details key={service.uuid} className="service" open={index === 0}>
                <summary>
                  <span className="service-name">{service.name ?? '厂商自定义服务'}</span>
                  <span className="uuid">{shortUuid(service.uuid)}</span>
                  <span className="service-count">{service.characteristics.length} 特征值</span>
                </summary>
                <div className="char-list">
                  {service.characteristics.length === 0 ? (
                    <p className="empty-hint">该服务下没有可访问的特征值</p>
                  ) : (
                    service.characteristics.map((characteristic) => (
                      <CharacteristicRow
                        key={characteristic.uuid}
                        info={characteristic}
                        manager={manager}
                      />
                    ))
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
