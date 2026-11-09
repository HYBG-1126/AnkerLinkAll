import type { AnkerState } from '../anker/protocol'

export type LogLevel = 'system' | 'info' | 'success' | 'warn' | 'error' | 'tx' | 'rx'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
}

export interface KnownDevice {
  id: string
  name: string
  connected: boolean
}

export interface CharacteristicProperties {
  read: boolean
  write: boolean
  writeWithoutResponse: boolean
  notify: boolean
  indicate: boolean
}

export interface CharacteristicInfo {
  uuid: string
  name?: string
  serviceUuid: string
  properties: CharacteristicProperties
  value: Uint8Array | null
  notifying: boolean
  lastUpdatedAt: number | null
}

export interface ServiceInfo {
  uuid: string
  name?: string
  isPrimary: boolean
  characteristics: CharacteristicInfo[]
}

export interface DeviceSummary {
  battery?: number
  manufacturer?: string
  model?: string
  firmware?: string
  serial?: string
}

export type ConnectionState = 'idle' | 'connecting' | 'connected'

export interface BleState {
  supported: boolean
  secureContext: boolean
  availability: boolean | null
  connectionState: ConnectionState
  device: { id: string; name: string } | null
  services: ServiceInfo[]
  summary: DeviceSummary
  knownDevices: KnownDevice[]
  extraServiceUuids: string[]
  logs: LogEntry[]
  busy: boolean
  scanError: string | null
  anker: AnkerState
}

export type WriteMode = 'with-response' | 'without-response'
