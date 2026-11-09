import { useEffect, useRef, useState } from 'react'
import type { BleManager } from '../lib/ble/manager'
import type { BleState, LogLevel } from '../lib/ble/types'
import { formatTime } from '../lib/format'
import { CopyIcon, TrashIcon } from './icons'

interface LogPanelProps {
  state: BleState
  manager: BleManager
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  system: 'SYS',
  info: 'INFO',
  success: 'OK',
  warn: 'WARN',
  error: 'ERR',
  tx: 'TX',
  rx: 'RX',
}

export function LogPanel({ state, manager }: LogPanelProps) {
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScroll) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [state.logs, autoScroll])

  const handleCopy = () => {
    const text = state.logs
      .map((entry) => `[${formatTime(entry.timestamp)}] ${LEVEL_LABELS[entry.level]} ${entry.message}`)
      .join('\n')
    void navigator.clipboard?.writeText(text)
  }

  return (
    <section className="panel panel-log">
      <header className="panel-header">
        <h2>实时日志</h2>
        <div className="panel-actions">
          <span className="muted">{state.logs.length}</span>
          <button
            type="button"
            className="icon-btn"
            title="复制日志"
            disabled={state.logs.length === 0}
            onClick={handleCopy}
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="清空日志"
            disabled={state.logs.length === 0}
            onClick={() => manager.clearLogs()}
          >
            <TrashIcon />
          </button>
        </div>
      </header>

      <div className="log-toolbar">
        <label className="checkline">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
          />
          <span>自动滚动</span>
        </label>
      </div>

      <div className="log-list" ref={listRef}>
        {state.logs.length === 0 ? (
          <p className="empty-hint">蓝牙事件与收发数据将在这里实时显示。</p>
        ) : (
          state.logs.map((entry) => (
            <div key={entry.id} className={`log-entry level-${entry.level}`}>
              <time>{formatTime(entry.timestamp)}</time>
              <span className="log-level">{LEVEL_LABELS[entry.level]}</span>
              <span className="log-message">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
