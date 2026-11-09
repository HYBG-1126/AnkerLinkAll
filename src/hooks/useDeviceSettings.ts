import { useEffect, useState } from 'react'
import { DEMO_DEVICE } from '../lib/deviceData'
import type { PortId } from '../lib/deviceData'

export interface DeviceSettings {
  name: string
  chargingMode: string
  brightness: number
  screenOff: string
  rotation: string
  screensaver: string
  portPower: Record<PortId, boolean>
  portTimer: Record<PortId, boolean>
}

export const CHARGING_MODES = ['AI模式2.0', '智能模式', '标准模式'] as const
export const SCREEN_OFF_OPTIONS = ['15秒', '30秒', '1分钟', '5分钟'] as const
export const ROTATION_OPTIONS = ['向上', '向左', '向右'] as const
export const SCREENSAVER_OPTIONS = ['关闭', '时钟', '星空'] as const

const DEFAULTS: DeviceSettings = {
  name: DEMO_DEVICE.name,
  chargingMode: CHARGING_MODES[0],
  brightness: 65,
  screenOff: '30秒',
  rotation: '向上',
  screensaver: '关闭',
  portPower: { C1: true, C2: false, C3: false },
  portTimer: { C1: false, C2: false, C3: false },
}

function cloneDefaults(): DeviceSettings {
  return {
    ...DEFAULTS,
    portPower: { ...DEFAULTS.portPower },
    portTimer: { ...DEFAULTS.portTimer },
  }
}

function load(storageKey: string): DeviceSettings {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<DeviceSettings>
    return {
      ...cloneDefaults(),
      ...parsed,
      portPower: { ...DEFAULTS.portPower, ...parsed.portPower },
      portTimer: { ...DEFAULTS.portTimer, ...parsed.portTimer },
    }
  } catch {
    return cloneDefaults()
  }
}

export function useDeviceSettings(deviceKey: string) {
  const storageKey = `ankerlink.settings.${deviceKey}`
  const [settings, setSettings] = useState<DeviceSettings>(() => load(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings))
    } catch {
      // 隐私模式写入失败不影响当前会话
    }
  }, [storageKey, settings])

  const update = (patch: Partial<DeviceSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }))
  }

  const reset = () => setSettings(cloneDefaults())

  return { settings, update, reset }
}
