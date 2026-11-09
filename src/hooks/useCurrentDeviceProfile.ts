import { useBle } from './useBle'
import { ANKER_MODEL_NAME } from '../lib/anker/protocol'
import type { DeviceProfile } from '../lib/deviceData'

const DISCONNECTED_PROFILE: DeviceProfile = {
  name: '未连接设备',
  sn: '—',
  firmware: '—',
  model: '—',
}

function versionLabel(value: string): string {
  if (value === '—' || /^v/i.test(value)) return value
  return `v${value}`
}

export function useCurrentDeviceProfile(): {
  connected: boolean
  deviceKey: string
  profile: DeviceProfile
} {
  const { state } = useBle()
  const connected = state.connectionState === 'connected' && state.device !== null

  if (!connected || !state.device) {
    return { connected: false, deviceKey: 'local', profile: DISCONNECTED_PROFILE }
  }

  const isAnker = state.anker.phase !== 'idle' && state.anker.phase !== 'unsupported'
  const firmware = state.summary.firmware ?? state.anker.firmware

  return {
    connected: true,
    deviceKey: state.device.id,
    profile: {
      name: isAnker ? state.anker.productName ?? ANKER_MODEL_NAME : state.device.name ?? '未命名设备',
      sn: state.summary.serial ?? state.anker.serial ?? '—',
      firmware: firmware ? versionLabel(firmware) : '—',
      model: state.summary.model ?? (isAnker ? 'A2687' : '—'),
    },
  }
}
