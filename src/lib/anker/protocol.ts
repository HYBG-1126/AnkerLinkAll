export type AnkerPortId = 'C1' | 'C2' | 'C3'

export const ANKER_SERVICE_UUID = '8c850001-0302-41c5-b46e-cf057c562025'
export const ANKER_WRITE_UUID = '8c850002-0302-41c5-b46e-cf057c562025'
export const ANKER_NOTIFY_UUID = '8c850003-0302-41c5-b46e-cf057c562025'
export const ANKER_ADVERTISED_SERVICE_UUID = '0000ff09-0000-1000-8000-00805f9b34fb'

export const ANKER_AAD_HEX = '3322110077665544bbaa9988ffeeddcc'
export const ANKER_INITIAL_KEY_HEX = 'b8ff7422955d4eb6d554a2c470280559'
export const ANKER_INITIAL_NONCE_HEX = '6ba3e3f2f3a60f2971ce5d1f'
export const ANKER_LOGIN_ID_HEX =
  '62303932663861346533663832363864376230646339643564336538643062396431306465646264'

export const ANKER_PORTS: readonly AnkerPortId[] = ['C1', 'C2', 'C3']

export const ANKER_MODEL_NAME = 'Anker Prime 160W'

const PORT_INDEX: Record<AnkerPortId, number> = { C1: 0, C2: 1, C3: 2 }

export const ANKER_COMMAND = {
  connect: 0x0001,
  capability: 0x0003,
  deviceInfo: 0x0029,
  setCapability: 0x0005,
  publicKey: 0x0021,
  aesKey: 0x0022,
  userAuth: 0x0027,
  status: 0x0200,
  realtime: 0x020a,
  history: 0x020c,
  fixedAllocation: 0x0205,
  chargingMode: 0x0206,
  portSwitch: 0x0207,
  portTimer: 0x0209,
  language: 0x0202,
  screenTimeout: 0x0203,
  screenBrightness: 0x0204,
  screenDirection: 0x020b,
  gyroscope: 0x020d,
  identification: 0x020f,
} as const

export type AnkerSettingKind = 'brightness' | 'screenTimeout' | 'screenDirection' | 'gyroscope' | 'identification' | 'language'

export interface AnkerPortTelemetry {
  id: AnkerPortId
  outputOn: boolean
  power: number | null
  voltage: number | null
  current: number | null
  cableCode: string | null
  cable: string | null
  charging: string | null
}

export type AnkerPhase = 'idle' | 'unsupported' | 'handshaking' | 'ready' | 'error'

export interface AnkerState {
  phase: AnkerPhase
  message: string
  productName: string | null
  serial: string | null
  firmware: string | null
  mac: string | null
  ports: AnkerPortTelemetry[]
  totalPower: number | null
  chargingMode: number | null
  fixedAllocation: number | null
  history: number[]
  lastUpdatedAt: number | null
  error: string | null
}

const EMPTY_PORTS: AnkerPortTelemetry[] = ANKER_PORTS.map((id) => ({
  id,
  outputOn: false,
  power: null,
  voltage: null,
  current: null,
  cableCode: null,
  cable: null,
  charging: null,
}))

export function createInitialAnkerState(): AnkerState {
  return {
    phase: 'idle',
    message: '尚未连接安克设备',
    productName: null,
    serial: null,
    firmware: null,
    mac: null,
    ports: EMPTY_PORTS.map((port) => ({ ...port })),
    totalPower: null,
    chargingMode: null,
    fixedAllocation: null,
    history: [],
    lastUpdatedAt: null,
    error: null,
  }
}

export function emptyPorts(): AnkerPortTelemetry[] {
  return EMPTY_PORTS.map((port) => ({ ...port }))
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/[^0-9a-fA-F]/g, '')
  const bytes = new Uint8Array(normalized.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function asciiToBytes(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff)
}

export function bytesToAscii(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
}

export function u16le(value: number): Uint8Array {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value & 0xffff, true)
  return bytes
}

export function u32le(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

export function timestampBytes(offsetSeconds = 0): Uint8Array {
  return u32le(Math.floor(Date.now() / 1000) + offsetSeconds)
}

export function xorChecksum(bytes: Uint8Array): number {
  return bytes.reduce((checksum, byte) => checksum ^ byte, 0)
}

export interface Tlv {
  type: number
  value: Uint8Array
}

export function buildTlv(tlvs: Tlv[]): Uint8Array {
  const length = tlvs.reduce((total, tlv) => total + 2 + tlv.value.length, 0)
  const buffer = new Uint8Array(length)
  let offset = 0
  for (const tlv of tlvs) {
    buffer[offset] = tlv.type
    buffer[offset + 1] = tlv.value.length
    buffer.set(tlv.value, offset + 2)
    offset += 2 + tlv.value.length
  }
  return buffer
}

export function parseTlv(payload: Uint8Array, offset = 0): Tlv[] {
  const result: Tlv[] = []
  let index = offset
  while (index + 1 < payload.length) {
    const type = payload[index]
    const length = payload[index + 1]
    if (index + 2 + length > payload.length) break
    result.push({ type, value: payload.slice(index + 2, index + 2 + length) })
    index += 2 + length
  }
  return result
}

export function tlvOffset(payload: Uint8Array): number {
  return payload.length > 0 && payload[0] === 0x00 ? 1 : 0
}

export function buildFrame(payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(4 + payload.length)
  header[0] = 0xff
  header[1] = 0x09
  header.set(u16le(header.length + 1), 2)
  header.set(payload, 4)
  const frame = new Uint8Array(header.length + 1)
  frame.set(header, 0)
  frame[frame.length - 1] = xorChecksum(header)
  return frame
}

export interface ParsedFrame {
  payload: Uint8Array
  command: number
  encrypted: boolean
  ack: boolean
}

export function parseFrame(frame: Uint8Array): ParsedFrame | null {
  if (frame.length < 10 || frame[0] !== 0xff || frame[1] !== 0x09) return null
  const declared = frame[2] | (frame[3] << 8)
  const total = Math.min(declared, frame.length)
  if (total < 10) return null
  const payload = frame.slice(4, total - 1)
  if (payload.length < 5) return null
  const flag = (payload[3] << 8) | payload[4]
  const encrypted = (flag & 0x4000) !== 0
  const ack = (flag & 0x0800) !== 0
  const command = flag & 0x37ff
  return { payload, command, encrypted, ack }
}

export function typedUInt8(value: number): Uint8Array {
  return new Uint8Array([0x01, value & 0xff])
}

export function typedByteArray(values: number[] | Uint8Array): Uint8Array {
  const list = Array.from(values, (value) => value & 0xff)
  return new Uint8Array([0x04, ...list])
}

export interface TypedValue {
  kind: number
  unsigned: number | null
  signed: number | null
  text: string | null
  bytes: Uint8Array
}

export function readTypedValue(raw: Uint8Array): TypedValue {
  if (raw.length === 0) {
    return { kind: 0xff, unsigned: null, signed: null, text: null, bytes: raw }
  }
  const kind = raw[0]
  const body = raw.slice(1)
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const result: TypedValue = { kind, unsigned: null, signed: null, text: null, bytes: body }
  if (kind === 0x00) {
    result.text = bytesToAscii(body).replace(/\0+$/g, '')
  } else if (kind === 0x01 && body.length >= 1) {
    result.unsigned = view.getUint8(0)
    result.signed = view.getInt8(0)
  } else if (kind === 0x02 && body.length >= 2) {
    result.unsigned = view.getUint16(0, true)
    result.signed = view.getInt16(0, true)
  } else if (kind === 0x03 && body.length >= 4) {
    result.unsigned = view.getUint32(0, true)
    result.signed = view.getInt32(0, true)
  }
  return result
}

export function readScalar(raw: Uint8Array): number | null {
  const decoded = readTypedValue(raw)
  if (decoded.unsigned !== null) return decoded.unsigned
  if (decoded.signed !== null) return decoded.signed
  return null
}

const CABLE_CAPABILITY: Record<string, string> = {
  '00': '3A-60W MAX',
  '01': '5A-100W MAX',
  '02': 'EPR-240W MAX',
}

const CHARGING_INFO: Record<string, string> = {
  '01': 'Apple PD 快充',
  '02': 'Samsung 快充',
  '03': 'Samsung 超级快充',
}

export interface PortPatch {
  outputOn?: boolean
  power?: number | null
  voltage?: number | null
  current?: number | null
  cableCode?: string | null
  cable?: string | null
  charging?: string | null
}

export interface RealtimeUpdate {
  ports: Partial<Record<AnkerPortId, PortPatch>>
  totalPower?: number
  chargingMode?: number
  fixedAllocation?: number
}

function applyCable(patch: PortPatch, raw: Uint8Array | undefined): void {
  if (!raw) return
  const decoded = readTypedValue(raw)
  const bytes = decoded.kind === 0x04 ? decoded.bytes : raw
  if (bytes.length < 2) return
  const capability = bytes[bytes.length - 2].toString(16).padStart(2, '0')
  const info = bytes[bytes.length - 1].toString(16).padStart(2, '0')
  const code = `${capability}${info}`.toUpperCase()
  patch.cableCode = code
  if (capability === '03') {
    patch.cable = null
    patch.charging = null
    return
  }
  patch.cable = CABLE_CAPABILITY[capability] ?? null
  patch.charging = CHARGING_INFO[info] ?? null
}

export function parseRealtime(payload: Uint8Array, command: number): RealtimeUpdate {
  const fields = new Map<number, Uint8Array>()
  for (const tlv of parseTlv(payload, tlvOffset(payload))) {
    fields.set(tlv.type, tlv.value)
  }

  const update: RealtimeUpdate = { ports: {} }

  const scalar = (type: number): number | null => {
    const raw = fields.get(type)
    return raw ? readScalar(raw) : null
  }

  if (command === ANKER_COMMAND.fixedAllocation) {
    const fixed = scalar(0xa2)
    if (fixed === 0 || fixed === 1) update.fixedAllocation = fixed
  }
  if (command === ANKER_COMMAND.chargingMode || command === 0x0303) {
    const mode = scalar(0xa2)
    if (mode === 0 || mode === 1 || mode === 4) update.chargingMode = mode
  }

  const isStatusSnapshot =
    command === ANKER_COMMAND.status || command === 0x0a00 || command === 0x0040 || command === 0x0405
  if (isStatusSnapshot) return update

  const structTypes: Record<AnkerPortId, number> = { C1: 0xa5, C2: 0xa6, C3: 0xa7 }
  const cableTypes: Record<AnkerPortId, number> = { C1: 0xac, C2: 0xad, C3: 0xae }
  let hasStruct = false

  for (const portId of ANKER_PORTS) {
    const raw = fields.get(structTypes[portId])
    if (!raw) continue
    const decoded = readTypedValue(raw)
    if (decoded.kind !== 0x04 || decoded.bytes.length < 7) continue
    hasStruct = true
    const data = decoded.bytes
    const mode = data[0]
    const voltage = (data[1] | (data[2] << 8)) / 1000
    const current = (data[3] | (data[4] << 8)) / 1000
    const power = (data[5] | (data[6] << 8)) / 100
    update.ports[portId] = {
      outputOn: mode !== 0,
      voltage,
      current,
      power,
    }
    applyCable(update.ports[portId] ?? {}, fields.get(cableTypes[portId]))
  }

  if (hasStruct) {
    if (update.ports.C1?.cableCode === undefined) applyCable((update.ports.C1 ??= {}), fields.get(0xac))
    if (update.ports.C2?.cableCode === undefined) applyCable((update.ports.C2 ??= {}), fields.get(0xad))
    if (update.ports.C3?.cableCode === undefined) applyCable((update.ports.C3 ??= {}), fields.get(0xae))
    const total = ANKER_PORTS.reduce((sum, port) => sum + (update.ports[port]?.power ?? 0), 0)
    update.totalPower = total
    return update
  }

  const voltageTypes: Record<AnkerPortId, number> = { C1: 0xa2, C2: 0xa3, C3: 0xa4 }
  const currentTypes: Record<AnkerPortId, number> = { C1: 0xa5, C2: 0xa6, C3: 0xa7 }
  const powerTypes: Record<AnkerPortId, number> = { C1: 0xb0, C2: 0xb1, C3: 0xb2 }

  for (const portId of ANKER_PORTS) {
    const voltageRaw = scalar(voltageTypes[portId])
    const currentRaw = scalar(currentTypes[portId])
    const powerRaw = scalar(powerTypes[portId])
    if (currentRaw === null && powerRaw === null) continue
    const voltage = voltageRaw === null ? null : voltageRaw / 10
    const current = currentRaw === null ? null : currentRaw / 10
    const power =
      powerRaw !== null ? powerRaw : voltage !== null && current !== null ? voltage * current : null
    const patch: PortPatch = {
      voltage,
      current,
      power,
      outputOn: power !== null && power > 0.2,
    }
    applyCable(patch, fields.get(cableTypes[portId]))
    update.ports[portId] = patch
  }

  const total = scalar(0xa8)
  if (total !== null) update.totalPower = total

  return update
}

export function portIndex(port: AnkerPortId): number {
  return PORT_INDEX[port]
}

export function portPowerTlv(port: AnkerPortId, on: boolean): Tlv[] {
  return [
    { type: 0xa1, value: new Uint8Array([0x21]) },
    { type: 0xa2, value: typedUInt8(portIndex(port)) },
    { type: 0xa3, value: typedUInt8(on ? 1 : 0) },
    { type: 0xfe, value: timestampBytes() },
  ]
}

export function portTimerTlv(port: AnkerPortId, seconds: number): Tlv[] {
  const timer = new Uint8Array(5)
  timer[0] = 0x04
  timer.set(u32le(seconds), 1)
  return [
    { type: 0xa1, value: new Uint8Array([0x21]) },
    { type: 0xa2, value: typedUInt8(portIndex(port)) },
    { type: 0xa3, value: timer },
    { type: 0xfe, value: timestampBytes() },
  ]
}

export function singleValueTlv(value: number): Tlv[] {
  return [
    { type: 0xa1, value: new Uint8Array([0x21]) },
    { type: 0xa2, value: typedUInt8(value) },
    { type: 0xfe, value: timestampBytes() },
  ]
}

export const SETTING_COMMANDS: Record<AnkerSettingKind, number> = {
  language: ANKER_COMMAND.language,
  screenTimeout: ANKER_COMMAND.screenTimeout,
  brightness: ANKER_COMMAND.screenBrightness,
  screenDirection: ANKER_COMMAND.screenDirection,
  gyroscope: ANKER_COMMAND.gyroscope,
  identification: ANKER_COMMAND.identification,
}

export interface DeviceIdentity {
  productName: string | null
  serial: string | null
  firmware: string | null
  mac: string | null
}

export function extractIdentity(payload: Uint8Array): DeviceIdentity {
  let offset = tlvOffset(payload)
  if (payload.length > 5 && payload[0] === 0x03 && payload[1] === 0x00) offset = 6
  const identity: DeviceIdentity = { productName: null, serial: null, firmware: null, mac: null }
  const looksLikeFirmware = (text: string) => /^v?\d+(?:\.\d+){1,5}$/i.test(text) || /^v\d/i.test(text)
  const looksLikeSerial = (text: string) => /^[A-Z0-9_-]{10,30}$/i.test(text) && !looksLikeFirmware(text)
  const looksLikeMac = (text: string) => /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i.test(text)
  const looksLikeProductName = (text: string) =>
    text.length >= 3 && text.length <= 40 && /anker|prime|a2687/i.test(text)

  for (const tlv of parseTlv(payload, offset)) {
    const text = bytesToAscii(tlv.value).replace(/\s+/g, ' ').trim()
    if (tlv.type === 0xa2 && looksLikeProductName(text)) identity.productName = text
    if (tlv.type === 0xa3 && looksLikeFirmware(text)) identity.firmware = text
    if (tlv.type === 0xa4 && looksLikeSerial(text)) identity.serial = text
    if (tlv.type === 0xa5 && tlv.value.length >= 6) {
      const mac = Array.from(tlv.value.slice(0, 6))
        .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
        .join(':')
      if (mac !== '00:00:00:00:00:00') identity.mac = mac
    }
    if (!identity.productName && looksLikeProductName(text)) identity.productName = text
    if (!identity.firmware && looksLikeFirmware(text)) identity.firmware = text
    if (!identity.serial && looksLikeSerial(text)) identity.serial = text
    if (!identity.mac && looksLikeMac(text)) identity.mac = text.replace(/-/g, ':').toUpperCase()
  }
  return identity
}
