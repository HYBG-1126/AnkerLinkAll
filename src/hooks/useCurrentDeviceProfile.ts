import { useBle } from './useBle'
import { DEMO_DEVICE } from '../lib/deviceData'
import type { DeviceProfile } from '../lib/deviceData'

export function useCurrentDeviceProfile(): {
  connected: boolean
  deviceKey: string
  profile: DeviceProfile
} {
  const { state } = useBle()
  const connected = state.connectionState === 'connected' && state.device !== null

  if (!connected || !state.device) {
    return { connected: false, deviceKey: 'demo', profile: DEMO_DEVICE }
  }

  return {
    connected: true,
    deviceKey: state.device.id,
    profile: {
      name: state.device.name,
      sn: state.summary.serial ?? '—',
      firmware: state.summary.firmware ?? '—',
      model: state.summary.model ?? '—',
    },
  }
}
