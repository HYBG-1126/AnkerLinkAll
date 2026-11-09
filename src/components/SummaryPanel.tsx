import type { BleState } from '../lib/ble/types'

interface SummaryPanelProps {
  state: BleState
}

function batteryTone(level: number): string {
  if (level <= 20) return 'is-low'
  if (level <= 50) return 'is-mid'
  return 'is-high'
}

export function SummaryPanel({ state }: SummaryPanelProps) {
  const { device, summary, connectionState } = state
  const battery = summary.battery

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>设备概览</h2>
        {device && (
          <span className={`panel-badge${connectionState === 'connected' ? ' is-online' : ''}`}>
            {connectionState === 'connected' ? '在线' : '连接中'}
          </span>
        )}
      </header>

      <div className="panel-body">
        {!device ? (
          <p className="empty-hint">连接设备后展示电量、型号与固件版本等标准 GATT 信息。</p>
        ) : (
          <>
            <div className="summary-device">
              <p className="summary-name">{device.name}</p>
              <p className="summary-id">{device.id}</p>
            </div>

            <div className="battery">
              <div className="battery-head">
                <span>电量</span>
                <strong>{battery === undefined ? '—' : `${battery}%`}</strong>
              </div>
              <div className="battery-track">
                <span
                  className={battery === undefined ? '' : batteryTone(battery)}
                  style={{ width: `${battery ?? 0}%` }}
                />
              </div>
            </div>

            <dl className="kv-grid">
              <div>
                <dt>厂商</dt>
                <dd>{summary.manufacturer ?? '—'}</dd>
              </div>
              <div>
                <dt>型号</dt>
                <dd>{summary.model ?? '—'}</dd>
              </div>
              <div>
                <dt>固件</dt>
                <dd>{summary.firmware ?? '—'}</dd>
              </div>
              <div>
                <dt>序列号</dt>
                <dd>{summary.serial ?? '—'}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </section>
  )
}
