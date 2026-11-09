export type PortId = 'C1' | 'C2' | 'C3'

export interface PortTelemetry {
  id: PortId
  power: number
  voltage: number
  current: number
  plugged: boolean
  cable: string
  charging: string
  device: string
}

export interface DeviceProfile {
  name: string
  sn: string
  firmware: string
  model: string
}

export const DEMO_DEVICE: DeviceProfile = {
  name: '160W Prime Charger',
  sn: 'ASHDPPE1G19600139',
  firmware: 'v1.0.0.6',
  model: 'A2345',
}

export const PORT_META: Record<PortId, { cable: string; charging: string; device: string }> = {
  C1: { cable: 'EPR-240W Max', charging: 'Apple PD 快充', device: 'Macbook Pro 系列' },
  C2: { cable: '未检测到线缆', charging: '—', device: '—' },
  C3: { cable: '未检测到线缆', charging: '—', device: '—' },
}

export const MAX_OUTPUT_WATTS = 160

export const INITIAL_PORTS: PortTelemetry[] = [
  {
    id: 'C1',
    power: 27.7,
    voltage: 27.4,
    current: 1.0,
    plugged: true,
    ...PORT_META.C1,
  },
  {
    id: 'C2',
    power: 0,
    voltage: 0,
    current: 0,
    plugged: false,
    ...PORT_META.C2,
  },
  {
    id: 'C3',
    power: 0,
    voltage: 0,
    current: 0,
    plugged: false,
    ...PORT_META.C3,
  },
]
