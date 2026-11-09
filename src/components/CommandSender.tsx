import { useMemo, useState } from 'react'
import type { BleManager } from '../lib/ble/manager'
import type { BleState, CharacteristicInfo, ServiceInfo, WriteMode } from '../lib/ble/types'
import { formatByteCount, fromHex, textToBytes, toHex } from '../lib/format'
import { shortUuid } from '../lib/uuid'
import { SendIcon } from './icons'

interface CommandSenderProps {
  state: BleState
  manager: BleManager
}

interface WritableTarget {
  service: ServiceInfo
  characteristic: CharacteristicInfo
}

type PayloadFormat = 'hex' | 'text'

function targetKey(target: WritableTarget): string {
  return `${target.service.uuid}::${target.characteristic.uuid}`
}

function targetLabel(target: WritableTarget): string {
  const service = target.service.name ?? shortUuid(target.service.uuid)
  const characteristic = target.characteristic.name ?? shortUuid(target.characteristic.uuid)
  return `${service} · ${characteristic}`
}

export function CommandSender({ state, manager }: CommandSenderProps) {
  const [selected, setSelected] = useState('')
  const [format, setFormat] = useState<PayloadFormat>('hex')
  const [payload, setPayload] = useState('')
  const [mode, setMode] = useState<WriteMode>('with-response')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const writableTargets = useMemo<WritableTarget[]>(
    () =>
      state.services.flatMap((service) =>
        service.characteristics
          .filter(
            (characteristic) =>
              characteristic.properties.write || characteristic.properties.writeWithoutResponse,
          )
          .map((characteristic) => ({ service, characteristic })),
      ),
    [state.services],
  )

  const activeKey = writableTargets.some((target) => targetKey(target) === selected)
    ? selected
    : writableTargets.length > 0
      ? targetKey(writableTargets[0])
      : ''
  const current = writableTargets.find((target) => targetKey(target) === activeKey) ?? null

  const supportsResponse = current?.characteristic.properties.write ?? false
  const supportsNoResponse = current?.characteristic.properties.writeWithoutResponse ?? false
  const effectiveMode: WriteMode =
    mode === 'with-response'
      ? supportsResponse
        ? 'with-response'
        : 'without-response'
      : supportsNoResponse
        ? 'without-response'
        : 'with-response'

  const parsed = useMemo(() => {
    if (!payload.trim()) return { bytes: null, error: null }
    try {
      return { bytes: format === 'hex' ? fromHex(payload) : textToBytes(payload), error: null }
    } catch (parseError) {
      return {
        bytes: null,
        error: parseError instanceof Error ? parseError.message : '指令格式无效',
      }
    }
  }, [payload, format])

  const handleSend = async () => {
    if (!current || !parsed.bytes) return
    setError(null)
    setSending(true)
    const success = await manager.writeCharacteristic(
      current.service.uuid,
      current.characteristic.uuid,
      parsed.bytes,
      effectiveMode,
    )
    setSending(false)
    if (!success) setError('指令写入失败，请查看右侧日志')
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>指令下发</h2>
        <span className="panel-badge">TX</span>
      </header>

      <div className="panel-body">
        {writableTargets.length === 0 ? (
          <p className="empty-hint">连接设备并发现可写特征值后即可下发指令。</p>
        ) : (
          <div className="command-body">
            <label className="field">
              <span>目标特征值</span>
              <select value={activeKey} onChange={(event) => setSelected(event.target.value)}>
                {writableTargets.map((target) => (
                  <option key={targetKey(target)} value={targetKey(target)}>
                    {targetLabel(target)}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row">
              <label className="field">
                <span>数据格式</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={format === 'hex' ? 'is-active' : ''}
                    onClick={() => setFormat('hex')}
                  >
                    Hex
                  </button>
                  <button
                    type="button"
                    className={format === 'text' ? 'is-active' : ''}
                    onClick={() => setFormat('text')}
                  >
                    文本
                  </button>
                </div>
              </label>

              <label className="field">
                <span>写入模式</span>
                <select
                  value={effectiveMode}
                  onChange={(event) => setMode(event.target.value as WriteMode)}
                >
                  {current?.characteristic.properties.write && <option value="with-response">带响应</option>}
                  {current?.characteristic.properties.writeWithoutResponse && (
                    <option value="without-response">无响应</option>
                  )}
                </select>
              </label>
            </div>

            <label className="field">
              <span>数据</span>
              <textarea
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={format === 'hex' ? '例如：01 0A FF 00' : '例如：POWER ON'}
              />
            </label>

            <div className={`payload-preview${parsed.error ? ' has-error' : ''}`}>
              {parsed.error ??
                (parsed.bytes
                  ? `${formatByteCount(parsed.bytes.length)} · ${toHex(parsed.bytes)}`
                  : '等待输入指令数据')}
            </div>

            {error && <p className="form-error">{error}</p>}

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!parsed.bytes || sending}
              onClick={() => void handleSend()}
            >
              <SendIcon />
              {sending ? '发送中…' : '发送指令'}
            </button>

            <p className="hint">安克私有协议指令请依据对应产品的 GATT 协议文档填写。</p>
          </div>
        )}
      </div>
    </section>
  )
}
