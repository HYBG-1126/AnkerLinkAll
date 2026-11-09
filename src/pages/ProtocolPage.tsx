import { useState } from 'react'
import { DetailHeader } from '../components/PageHeader'
import { DevicePanel } from '../components/DevicePanel'
import { useToast } from '../components/toastContext'
import { useBle } from '../hooks/useBle'
import { shortUuid } from '../lib/uuid'

const EXAMPLE_UUIDS = ['0000ffe0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']

export function ProtocolPage() {
  const { state, manager } = useBle()
  const toast = useToast()
  const [uuid, setUuid] = useState('')

  const addService = (value: string) => {
    if (!value.trim()) {
      toast('请输入服务 UUID')
      return
    }
    if (manager.addExtraServiceUuid(value)) {
      setUuid('')
      toast('服务 UUID 已登记')
    } else {
      toast('UUID 无效或已存在')
    }
  }

  return (
    <div className="page protocol-page">
      <DetailHeader title="协议管理" />

      <section className="card protocol-intro">
        <h2>安克私有协议</h2>
        <p>
          安克充电设备通常通过自定义 GATT 服务传输端口功率与控制指令。浏览器出于安全限制，
          只会暴露已声明的服务，因此需要先登记厂商服务 UUID，重新连接后即可在实验室中读写。
        </p>
      </section>

      <div className="section-heading">
        <h2>快速登记</h2>
      </div>
      <section className="card">
        <div className="inline-form">
          <input
            value={uuid}
            onChange={(event) => setUuid(event.target.value)}
            placeholder="0000ffe0-0000-1000-8000-00805f9b34fb"
            spellCheck={false}
            aria-label="厂商服务 UUID"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!uuid.trim()}
            onClick={() => addService(uuid)}
          >
            登记
          </button>
        </div>
        <div className="protocol-examples">
          {EXAMPLE_UUIDS.map((example) => (
            <button
              type="button"
              key={example}
              className="protocol-chip"
              onClick={() => addService(example)}
            >
              {shortUuid(example)}
            </button>
          ))}
        </div>
        <p className="hint">以上为常见示例，实际 UUID 请以对应产品的协议文档为准。</p>
      </section>

      <div className="section-heading">
        <h2>已登记服务</h2>
      </div>
      <section className="card">
        {state.extraServiceUuids.length === 0 ? (
          <p className="empty-hint">尚未登记厂商服务。设备连接后仅能访问标准 GATT 服务。</p>
        ) : (
          <ul className="protocol-list">
            {state.extraServiceUuids.map((serviceUuid) => (
              <li key={serviceUuid}>
                <code>{shortUuid(serviceUuid)}</code>
                <button
                  type="button"
                  className="text-btn danger"
                  onClick={() => manager.removeExtraServiceUuid(serviceUuid)}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="section-heading">
        <h2>设备连接</h2>
      </div>
      <DevicePanel state={state} manager={manager} advancedOpen />
    </div>
  )
}
