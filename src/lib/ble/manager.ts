import {
  ANKER_NAME_PREFIXES,
  CHARACTERISTIC_NAMES,
  SERVICE_NAMES,
  STANDARD_SERVICE_UUIDS,
  UUIDS,
  VENDOR_SERVICE_UUIDS,
} from './constants'
import type {
  BleState,
  CharacteristicInfo,
  DeviceSummary,
  LogLevel,
  ServiceInfo,
  WriteMode,
} from './types'
import type { AnkerPortId, AnkerSettingKind, AnkerState } from '../anker/protocol'
import {
  ANKER_ADVERTISED_SERVICE_UUID,
  ANKER_NOTIFY_UUID,
  ANKER_SERVICE_UUID,
  ANKER_WRITE_UUID,
  createInitialAnkerState,
} from '../anker/protocol'
import { AnkerSession } from '../anker/session'
import { bytesToText, toHex } from '../format'
import { isValidUuid, normalizeUuid, shortUuid } from '../uuid'

const STORAGE_KEY = 'ankerlink.extraServiceUuids'
const MAX_LOGS = 300

function describeError(error: unknown): string {
  if (error instanceof DOMException) return `${error.name}：${error.message}`
  if (error instanceof Error) return error.message
  return String(error)
}

function loadStoredServices(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...VENDOR_SERVICE_UUIDS]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...VENDOR_SERVICE_UUIDS]
    const stored = parsed
      .filter((value): value is string => typeof value === 'string' && isValidUuid(value))
      .map(normalizeUuid)
    return [...new Set([...VENDOR_SERVICE_UUIDS, ...stored])]
  } catch {
    return [...VENDOR_SERVICE_UUIDS]
  }
}

function persistServices(uuids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uuids))
  } catch {
    // 隐私模式下写入失败不影响当前会话
  }
}

export class BleManager {
  private state: BleState = {
    supported:
      typeof navigator !== 'undefined' && typeof navigator.bluetooth?.requestDevice === 'function',
    secureContext: typeof window !== 'undefined' && window.isSecureContext,
    availability: null,
    connectionState: 'idle',
    device: null,
    services: [],
    summary: {},
    knownDevices: [],
    extraServiceUuids: loadStoredServices(),
    logs: [],
    busy: false,
    scanError: null,
    anker: createInitialAnkerState(),
  }

  private listeners = new Set<() => void>()
  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private knownDeviceMap = new Map<string, BluetoothDevice>()
  private characteristicMap = new Map<string, BluetoothRemoteGATTCharacteristic>()
  private notificationHandlers = new Map<string, EventListener>()
  private ankerSession: AnkerSession | null = null
  private ankerNotify: BluetoothRemoteGATTCharacteristic | null = null
  private ankerNotifyHandler: EventListener | null = null

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): BleState => this.state

  async initialize(): Promise<void> {
    if (!this.state.supported) return
    if (typeof navigator.bluetooth.getAvailability === 'function') {
      try {
        this.setState({ availability: await navigator.bluetooth.getAvailability() })
      } catch {
        this.setState({ availability: null })
      }
    }
    await this.refreshKnownDevices()
  }

  async refreshKnownDevices(): Promise<void> {
    if (!this.state.supported) return
    if (typeof navigator.bluetooth.getDevices !== 'function') return
    try {
      const devices = await navigator.bluetooth.getDevices()
      this.knownDeviceMap = new Map(devices.map((device) => [device.id, device]))
      this.setState({
        knownDevices: devices.map((device) => ({
          id: device.id,
          name: device.name ?? '未命名设备',
          connected: device.gatt?.connected ?? false,
        })),
      })
    } catch (error) {
      this.log('warn', `读取已授权设备失败：${describeError(error)}`)
    }
  }

  async requestDevice(options: { acceptAllDevices: boolean }): Promise<void> {
    if (!this.state.supported) {
      this.log('error', '当前浏览器不支持 Web Bluetooth，请使用 Chrome 或 Edge')
      return
    }
    if (!this.state.secureContext) {
      this.log('error', 'Web Bluetooth 需要 HTTPS 或 localhost 环境')
      return
    }

    const optionalServices = [...new Set([...STANDARD_SERVICE_UUIDS, ...this.state.extraServiceUuids])]
    this.setState({ busy: true, scanError: null })
    this.log(
      'system',
      options.acceptAllDevices
        ? '打开设备选择器：显示附近全部 BLE 设备'
        : '打开设备选择器：按安克品牌名筛选附近设备',
    )

    try {
      const device = options.acceptAllDevices
        ? await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices })
        : await navigator.bluetooth.requestDevice({
            filters: [
              { services: [ANKER_ADVERTISED_SERVICE_UUID] },
              ...ANKER_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
            ],
            optionalServices,
          })
      this.knownDeviceMap.set(device.id, device)
      await this.connectDevice(device)
      await this.refreshKnownDevices()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        this.log('warn', '已取消设备选择或未发现匹配设备')
        this.setState({
          scanError: '未发现匹配的安克设备，或已取消选择。可尝试扫描全部蓝牙设备。',
        })
      } else {
        const message = describeError(error)
        this.log('error', `扫描失败：${message}`)
        this.setState({ scanError: `扫描失败：${message}` })
      }
    } finally {
      this.setState({ busy: false })
    }
  }

  async connect(deviceId: string): Promise<void> {
    const device = this.knownDeviceMap.get(deviceId)
    if (!device) {
      this.log('error', '设备不在已授权列表中，请重新扫描')
      return
    }
    this.setState({ busy: true })
    try {
      await this.connectDevice(device)
    } finally {
      this.setState({ busy: false })
      await this.refreshKnownDevices()
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device
    if (!device) return
    device.removeEventListener('gattserverdisconnected', this.handleDisconnected)
    this.cleanupConnection()
    try {
      device.gatt?.disconnect()
    } catch {
      // 断开时设备可能已离线，忽略异常
    }
    this.setState({
      connectionState: 'idle',
      device: null,
      services: [],
      summary: {},
      busy: false,
      anker: createInitialAnkerState(),
    })
    this.log('info', `已断开 ${device.name ?? device.id}`)
    await this.refreshKnownDevices()
  }

  async forgetDevice(deviceId: string): Promise<void> {
    const device = this.knownDeviceMap.get(deviceId)
    if (!device) return
    if (this.device?.id === deviceId) await this.disconnect()
    try {
      await device.forget()
      this.knownDeviceMap.delete(deviceId)
      this.log('info', `已移除授权设备 ${device.name ?? deviceId}`)
      await this.refreshKnownDevices()
    } catch (error) {
      this.log('error', `移除设备失败：${describeError(error)}`)
    }
  }

  async refreshServices(): Promise<void> {
    if (!this.server?.connected) {
      this.log('warn', '设备未连接，无法发现服务')
      return
    }
    this.setState({ busy: true })
    try {
      await this.discoverServices()
      await this.readSummary()
    } catch (error) {
      this.log('error', `重新发现服务失败：${describeError(error)}`)
    } finally {
      this.setState({ busy: false })
    }
  }

  async readCharacteristic(serviceUuid: string, characteristicUuid: string): Promise<void> {
    const characteristic = this.characteristicMap.get(this.key(serviceUuid, characteristicUuid))
    if (!characteristic) {
      this.log('error', '特征值不可用，请重新连接设备')
      return
    }
    if (!characteristic.properties.read) {
      this.log('warn', `${shortUuid(characteristicUuid)} 不支持读取`)
      return
    }
    try {
      const bytes = this.copyView(await characteristic.readValue())
      this.applyValue(serviceUuid, characteristicUuid, bytes)
      this.log('rx', `READ ${shortUuid(characteristicUuid)} → ${toHex(bytes)}`)
    } catch (error) {
      this.log('error', `读取失败：${describeError(error)}`)
    }
  }

  async writeCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    bytes: Uint8Array,
    mode: WriteMode,
  ): Promise<boolean> {
    const characteristic = this.characteristicMap.get(this.key(serviceUuid, characteristicUuid))
    if (!characteristic) {
      this.log('error', '特征值不可用，请重新连接设备')
      return false
    }
    const payload = new Uint8Array(bytes)
    try {
      if (mode === 'without-response') {
        if (!characteristic.properties.writeWithoutResponse) throw new Error('该特征值不支持无响应写入')
        await characteristic.writeValueWithoutResponse(payload)
      } else {
        if (!characteristic.properties.write) throw new Error('该特征值不支持带响应写入')
        await characteristic.writeValueWithResponse(payload)
      }
      this.applyValue(serviceUuid, characteristicUuid, payload)
      this.log('tx', `WRITE ${shortUuid(characteristicUuid)} ← ${toHex(payload)}`)
      return true
    } catch (error) {
      this.log('error', `写入失败：${describeError(error)}`)
      return false
    }
  }

  async setAnkerPortPower(port: AnkerPortId, on: boolean): Promise<boolean> {
    if (!this.ankerSession?.ready) {
      this.log('warn', '安克会话尚未就绪，无法控制端口')
      return false
    }
    try {
      await this.ankerSession.setPortPower(port, on)
      return true
    } catch (error) {
      this.log('error', `端口控制失败：${describeError(error)}`)
      return false
    }
  }

  async setAnkerPortTimer(port: AnkerPortId, seconds: number): Promise<boolean> {
    if (!this.ankerSession?.ready) {
      this.log('warn', '安克会话尚未就绪，无法设置定时')
      return false
    }
    try {
      await this.ankerSession.setPortTimer(port, seconds)
      return true
    } catch (error) {
      this.log('error', `定时设置失败：${describeError(error)}`)
      return false
    }
  }

  async setAnkerChargingMode(mode: 0 | 1 | 4): Promise<boolean> {
    if (!this.ankerSession?.ready) {
      this.log('warn', '安克会话尚未就绪，无法切换充电模式')
      return false
    }
    try {
      await this.ankerSession.setChargingMode(mode)
      return true
    } catch (error) {
      this.log('error', `充电模式切换失败：${describeError(error)}`)
      return false
    }
  }

  async setAnkerSetting(kind: AnkerSettingKind, value: number): Promise<boolean> {
    if (!this.ankerSession?.ready) {
      this.log('warn', '安克会话尚未就绪，无法下发设置')
      return false
    }
    try {
      await this.ankerSession.setSetting(kind, value)
      return true
    } catch (error) {
      this.log('error', `设置下发失败：${describeError(error)}`)
      return false
    }
  }

  async refreshAnkerTelemetry(): Promise<void> {
    if (!this.ankerSession?.ready) return
    try {
      await this.ankerSession.requestTelemetry()
      await this.ankerSession.requestStatus()
    } catch (error) {
      this.log('warn', `刷新遥测失败：${describeError(error)}`)
    }
  }

  async setNotifications(
    serviceUuid: string,
    characteristicUuid: string,
    enabled: boolean,
  ): Promise<boolean> {
    const characteristic = this.characteristicMap.get(this.key(serviceUuid, characteristicUuid))
    if (!characteristic) {
      this.log('error', '特征值不可用，请重新连接设备')
      return false
    }
    if (!characteristic.properties.notify && !characteristic.properties.indicate) {
      this.log('warn', `${shortUuid(characteristicUuid)} 不支持通知`)
      return false
    }

    const mapKey = this.key(serviceUuid, characteristicUuid)
    const handler: EventListener = () => {
      const view = characteristic.value
      if (!view) return
      const bytes = this.copyView(view)
      this.applyValue(serviceUuid, characteristicUuid, bytes)
      this.log('rx', `NOTIFY ${shortUuid(characteristicUuid)} → ${toHex(bytes)}`)
    }

    try {
      if (enabled) {
        characteristic.addEventListener('characteristicvaluechanged', handler)
        this.notificationHandlers.set(mapKey, handler)
        await characteristic.startNotifications()
      } else {
        await characteristic.stopNotifications()
        this.detachNotification(mapKey, characteristic)
      }
      this.updateCharacteristic(serviceUuid, characteristicUuid, { notifying: enabled })
      this.log('info', `${enabled ? '已订阅' : '已取消订阅'} ${shortUuid(characteristicUuid)} 通知`)
      return true
    } catch (error) {
      if (enabled) this.detachNotification(mapKey, characteristic)
      this.log('error', `${enabled ? '订阅' : '取消订阅'}通知失败：${describeError(error)}`)
      return false
    }
  }

  addExtraServiceUuid(raw: string): boolean {
    if (!isValidUuid(raw)) {
      this.log('warn', '服务 UUID 格式无效，示例：0000ffe0-0000-1000-8000-00805f9b34fb')
      return false
    }
    const uuid = normalizeUuid(raw)
    if (this.state.extraServiceUuids.includes(uuid)) {
      this.log('warn', '该服务 UUID 已存在')
      return false
    }
    const extraServiceUuids = [...this.state.extraServiceUuids, uuid]
    persistServices(extraServiceUuids)
    this.setState({ extraServiceUuids })
    this.log('info', `已添加厂商服务 ${shortUuid(uuid)}，重新扫描或连接后生效`)
    return true
  }

  removeExtraServiceUuid(uuid: string): void {
    const extraServiceUuids = this.state.extraServiceUuids.filter(
      (item) => normalizeUuid(item) !== normalizeUuid(uuid),
    )
    persistServices(extraServiceUuids)
    this.setState({ extraServiceUuids })
    this.log('info', `已移除厂商服务 ${shortUuid(uuid)}`)
  }

  clearLogs(): void {
    this.setState({ logs: [] })
  }

  private async connectDevice(device: BluetoothDevice): Promise<void> {
    if (this.device?.id === device.id && this.server?.connected) return
    if (this.device) await this.disconnect()

    this.setState({
      connectionState: 'connecting',
      device: { id: device.id, name: device.name ?? '未命名设备' },
      services: [],
      summary: {},
    })
    this.log('system', `正在连接 ${device.name ?? device.id} …`)
    device.addEventListener('gattserverdisconnected', this.handleDisconnected)

    try {
      const server = await device.gatt?.connect()
      if (!server) throw new Error('该设备不支持 GATT 连接')
      this.device = device
      this.server = server
      this.setState({ connectionState: 'connected' })
      this.log('success', `已连接 ${device.name ?? device.id}`)
      await this.discoverServices()
      await this.readSummary()
      await this.startAnkerSession()
    } catch (error) {
      device.removeEventListener('gattserverdisconnected', this.handleDisconnected)
      this.cleanupConnection()
      this.setState({
        connectionState: 'idle',
        device: null,
        services: [],
        summary: {},
        anker: createInitialAnkerState(),
      })
      this.log('error', `连接失败：${describeError(error)}`)
    }
  }

  private async startAnkerSession(): Promise<void> {
    this.stopAnkerSession()
    const server = this.server
    if (!server) return

    let service: BluetoothRemoteGATTService
    try {
      service = await server.getPrimaryService(ANKER_SERVICE_UUID)
    } catch {
      this.setState({
        anker: {
          ...createInitialAnkerState(),
          phase: 'unsupported',
          message: '该设备未提供 A2687 私有服务，仅支持标准 GATT 调试',
        },
      })
      return
    }

    try {
      const write = await service.getCharacteristic(ANKER_WRITE_UUID)
      const notify = await service.getCharacteristic(ANKER_NOTIFY_UUID)
      await notify.startNotifications()

      const session = new AnkerSession({
        write: async (packet) => {
          const bytes = new Uint8Array(packet)
          if (write.properties.writeWithoutResponse) {
            await write.writeValueWithoutResponse(bytes)
          } else {
            await write.writeValueWithResponse(bytes)
          }
        },
        onUpdate: (patch) => this.applyAnkerPatch(patch),
        log: (level, message) => this.log(level, message),
      })

      const handler: EventListener = () => {
        const view = notify.value
        if (!view) return
        this.ankerSession?.handleNotification(this.copyView(view))
      }

      this.ankerSession = session
      this.ankerNotify = notify
      this.ankerNotifyHandler = handler
      notify.addEventListener('characteristicvaluechanged', handler)
      this.setState({
        anker: {
          ...createInitialAnkerState(),
          phase: 'handshaking',
          message: '正在建立安克安全会话…',
        },
      })
      void session.start()
    } catch (error) {
      this.setState({
        anker: {
          ...createInitialAnkerState(),
          phase: 'error',
          message: `安克服务初始化失败：${describeError(error)}`,
          error: describeError(error),
        },
      })
      this.log('error', `安克服务初始化失败：${describeError(error)}`)
    }
  }

  private stopAnkerSession(): void {
    if (this.ankerNotify && this.ankerNotifyHandler) {
      this.ankerNotify.removeEventListener('characteristicvaluechanged', this.ankerNotifyHandler)
    }
    this.ankerNotify = null
    this.ankerNotifyHandler = null
    this.ankerSession?.stop()
    this.ankerSession = null
  }

  private applyAnkerPatch(patch: Partial<AnkerState>): void {
    const previous = this.state.anker
    const next: AnkerState = { ...previous, ...patch }
    if (patch.totalPower !== undefined && patch.totalPower !== null && patch.lastUpdatedAt !== undefined) {
      next.history = [...previous.history, patch.totalPower].slice(-48)
    }
    this.setState({ anker: next })
  }

  private async discoverServices(): Promise<void> {
    const server = this.server
    if (!server) return

    this.characteristicMap.clear()
    const primaryServices = await server.getPrimaryServices()
    const services: ServiceInfo[] = []

    for (const service of primaryServices) {
      const characteristics = await service.getCharacteristics()
      const infos: CharacteristicInfo[] = []
      for (const characteristic of characteristics) {
        this.characteristicMap.set(this.key(service.uuid, characteristic.uuid), characteristic)
        infos.push({
          uuid: characteristic.uuid,
          name: CHARACTERISTIC_NAMES[normalizeUuid(characteristic.uuid)],
          serviceUuid: service.uuid,
          properties: {
            read: characteristic.properties.read,
            write: characteristic.properties.write,
            writeWithoutResponse: characteristic.properties.writeWithoutResponse,
            notify: characteristic.properties.notify,
            indicate: characteristic.properties.indicate,
          },
          value: null,
          notifying: false,
          lastUpdatedAt: null,
        })
      }
      services.push({
        uuid: service.uuid,
        name: SERVICE_NAMES[normalizeUuid(service.uuid)],
        isPrimary: service.isPrimary,
        characteristics: infos,
      })
    }

    const characteristicCount = services.reduce((total, service) => total + service.characteristics.length, 0)
    this.setState({ services })
    this.log('info', `发现 ${services.length} 个服务、${characteristicCount} 个特征值`)
  }

  private async readSummary(): Promise<void> {
    const [battery, manufacturer, model, firmware, serial] = await Promise.all([
      this.tryRead(UUIDS.batteryService, UUIDS.batteryLevel),
      this.tryRead(UUIDS.deviceInformation, UUIDS.manufacturerName),
      this.tryRead(UUIDS.deviceInformation, UUIDS.modelNumber),
      this.tryRead(UUIDS.deviceInformation, UUIDS.firmwareRevision),
      this.tryRead(UUIDS.deviceInformation, UUIDS.serialNumber),
    ])

    const summary: DeviceSummary = {}
    if (battery && battery.length > 0) summary.battery = battery[0]
    if (manufacturer) summary.manufacturer = bytesToText(manufacturer)
    if (model) summary.model = bytesToText(model)
    if (firmware) summary.firmware = bytesToText(firmware)
    if (serial) summary.serial = bytesToText(serial)
    this.setState({ summary })
  }

  private async tryRead(serviceUuid: string, characteristicUuid: string): Promise<Uint8Array | null> {
    const characteristic = this.characteristicMap.get(this.key(serviceUuid, characteristicUuid))
    if (!characteristic?.properties.read) return null
    try {
      const bytes = this.copyView(await characteristic.readValue())
      this.applyValue(serviceUuid, characteristicUuid, bytes)
      return bytes
    } catch {
      return null
    }
  }

  private updateCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    patch: Partial<CharacteristicInfo>,
  ): void {
    const serviceKey = normalizeUuid(serviceUuid)
    const characteristicKey = normalizeUuid(characteristicUuid)
    this.setState({
      services: this.state.services.map((service) =>
        normalizeUuid(service.uuid) !== serviceKey
          ? service
          : {
              ...service,
              characteristics: service.characteristics.map((characteristic) =>
                normalizeUuid(characteristic.uuid) === characteristicKey
                  ? { ...characteristic, ...patch }
                  : characteristic,
              ),
            },
      ),
    })
  }

  private applyValue(serviceUuid: string, characteristicUuid: string, value: Uint8Array): void {
    this.updateCharacteristic(serviceUuid, characteristicUuid, { value, lastUpdatedAt: Date.now() })
  }

  private detachNotification(mapKey: string, characteristic: BluetoothRemoteGATTCharacteristic): void {
    const handler = this.notificationHandlers.get(mapKey)
    if (handler) characteristic.removeEventListener('characteristicvaluechanged', handler)
    this.notificationHandlers.delete(mapKey)
  }

  private cleanupConnection(): void {
    this.stopAnkerSession()
    this.characteristicMap.clear()
    this.notificationHandlers.clear()
    this.device = null
    this.server = null
  }

  private handleDisconnected = (): void => {
    const name = this.device?.name ?? '设备'
    this.cleanupConnection()
    this.setState({
      connectionState: 'idle',
      device: null,
      services: [],
      summary: {},
      anker: createInitialAnkerState(),
      knownDevices: this.state.knownDevices.map((device) => ({ ...device, connected: false })),
    })
    this.log('warn', `${name} 已断开连接`)
  }

  private key(serviceUuid: string, characteristicUuid: string): string {
    return `${normalizeUuid(serviceUuid)}::${normalizeUuid(characteristicUuid)}`
  }

  private copyView(view: DataView): Uint8Array {
    const bytes = new Uint8Array(view.byteLength)
    bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    return bytes
  }

  private log(level: LogLevel, message: string): void {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      message,
    }
    this.setState({ logs: [...this.state.logs, entry].slice(-MAX_LOGS) })
  }

  private setState(patch: Partial<BleState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}

export const bleManager = new BleManager()
