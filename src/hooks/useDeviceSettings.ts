import { useEffect, useState } from 'react'
import type { PortId } from '../lib/deviceData'

export interface DeviceSettings {
  name: string
  chargingMode: string
  brightness: number | null
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
  name: '',
  chargingMode: '',
  brightness: null,
  screenOff: '',
  rotation: '',
  screensaver: '',
  portPower: { C1: false, C2: false, C3: false },
  portTimer: { C1: false, C2: false, C3: false },
}

function cloneDefaults(): DeviceSettings {
  return {
    ...DEFAULTS,
    portPower: { ...DEFAULTS.portPower },
    portTimer: { ...DEFAULTS.portTimer },
  }
}

function oneOf(options: readonly string[], value: unknown, fallback: string): string {
  return typeof value === 'string' && options.includes(value) ? value : fallback
}

const STORAGE_VERSION = 2

function load(storageKey: string): DeviceSettings {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<DeviceSettings> & { version?: number }
    if (parsed.version !== STORAGE_VERSION) return cloneDefaults()
    return {
      ...cloneDefaults(),
      ...parsed,
      name: typeof parsed.name === 'string' ? parsed.name : DEFAULTS.name,
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
      localStorage.setItem(storageKey, JSON.stringify({ version: STORAGE_VERSION, ...settings }))
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
