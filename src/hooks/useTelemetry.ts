import { useEffect, useRef, useState } from 'react'
import { INITIAL_PORTS } from '../lib/deviceData'
import type { PortId, PortTelemetry } from '../lib/deviceData'

const HISTORY_LENGTH = 48
const REFRESH_MS = 1200

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function seedHistory(): number[] {
  return Array.from({ length: HISTORY_LENGTH }, (_, index) =>
    clamp(26.5 + Math.sin(index / 4.2) * 1.3 + Math.random() * 0.8, 23, 31),
  )
}

export function useTelemetry(activePorts: Record<PortId, boolean>) {
  const [ports, setPorts] = useState<PortTelemetry[]>(INITIAL_PORTS)
  const [history, setHistory] = useState<number[]>(seedHistory)
  const portsRef = useRef<PortTelemetry[]>(INITIAL_PORTS)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = portsRef.current.map((port) => {
        if (port.id !== 'C1') return port
        if (!activePorts.C1) return { ...port, power: 0, voltage: 0, current: 0 }
        const power = clamp(port.power + (Math.random() - 0.5) * 2.4, 23.5, 31)
        const voltage = clamp(port.voltage + (Math.random() - 0.5) * 0.16, 27, 27.8)
        return { ...port, power, voltage, current: power / voltage }
      })
      portsRef.current = next
      setPorts(next)
      const total = next.reduce((sum, port) => sum + port.power, 0)
      setHistory((previous) => [...previous.slice(-(HISTORY_LENGTH - 1)), total])
    }, REFRESH_MS)

    return () => window.clearInterval(timer)
  }, [activePorts.C1])

  const totalPower = ports.reduce((sum, port) => sum + port.power, 0)

  return { ports, history, totalPower }
}
