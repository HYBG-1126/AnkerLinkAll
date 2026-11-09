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

export const CHARGING_MODES = ['AI 模式', '标准模式'] as const
export const CHARGING_MODE_VALUES: Record<string, 0 | 1 | 4> = {
  'AI 模式': 0,
  标准模式: 1,
  自定义模式: 4,
}
export const CHARGING_MODE_LABELS: Record<number, string> = {
  0: 'AI 模式',
  1: '标准模式',
  4: '自定义模式',
}
export const SCREEN_OFF_OPTIONS = ['30秒', '1分钟', '5分钟', '30分钟', '12小时'] as const
export const ROTATION_OPTIONS = ['向上', '向左', '向下', '向右'] as const
export const SCREENSAVER_OPTIONS = ['关闭', '时钟', '星空'] as const

const DEFAULTS: DeviceSettings = {
  name: DEMO_DEVICE.name,
  chargingMode: CHARGING_MODES[0],
  brightness: 65,
  screenOff: SCREEN_OFF_OPTIONS[0],
  rotation: ROTATION_OPTIONS[0],
  screensaver: SCREENSAVER_OPTIONS[0],
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

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

function load(storageKey: string): DeviceSettings {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<DeviceSettings>
    return {
      ...cloneDefaults(),
      ...parsed,
      chargingMode: oneOf(CHARGING_MODES, parsed.chargingMode, DEFAULTS.chargingMode),
      screenOff: oneOf(SCREEN_OFF_OPTIONS, parsed.screenOff, DEFAULTS.screenOff),
      rotation: oneOf(ROTATION_OPTIONS, parsed.rotation, DEFAULTS.rotation),
      screensaver: oneOf(SCREENSAVER_OPTIONS, parsed.screensaver, DEFAULTS.screensaver),
      brightness:
        typeof parsed.brightness === 'number' && parsed.brightness >= 10 && parsed.brightness <= 100
          ? parsed.brightness
          : DEFAULTS.brightness,
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
