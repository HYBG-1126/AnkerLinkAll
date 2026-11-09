import type { LogLevel } from '../ble/types'
import type { AnkerPortId, AnkerSettingKind, AnkerState, PortPatch, Tlv } from './protocol'
import {
  ANKER_AAD_HEX,
  ANKER_COMMAND,
  ANKER_INITIAL_KEY_HEX,
  ANKER_INITIAL_NONCE_HEX,
  ANKER_LOGIN_ID_HEX,
  ANKER_PORTS,
  SETTING_COMMANDS,
  asciiToBytes,
  buildFrame,
  buildTlv,
  emptyPorts,
  extractIdentity,
  hexToBytes,
  parseFrame,
  parseRealtime,
  parseTlv,
  portPowerTlv,
  portTimerTlv,
  singleValueTlv,
  timestampBytes,
  tlvOffset,
  typedByteArray,
} from './protocol'

const HANDSHAKE_TIMEOUT_MS = 6000
const HEARTBEAT_MS = 6000

interface SessionHooks {
  write: (packet: Uint8Array) => Promise<void>
  onUpdate: (patch: Partial<AnkerState>) => void
  log: (level: LogLevel, message: string) => void
}

interface PendingResponse {
  command: number
  acceptAny: boolean
  resolve: (plain: Uint8Array) => void
  reject: (error: Error) => void
  timer: number
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function asBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}

export class AnkerSession {
  private readonly hooks: SessionHooks
  private key: CryptoKey | null = null
  private nonce: Uint8Array | null = null
  private readonly aad = hexToBytes(ANKER_AAD_HEX)
  private clientKeyPair: CryptoKeyPair | null = null
  private pending: PendingResponse | null = null
  private phase: AnkerState['phase'] = 'idle'
  private stopped = false
  private writeChain: Promise<void> = Promise.resolve()
  private processChain: Promise<void> = Promise.resolve()
  private pollTimers: number[] = []
  private heartbeatTick = 0
  private ports = emptyPorts()
  private totalPower: number | null = null
  private chargingMode: number | null = null
  private readonly seenCommands = new Set<string>()
  private readonly seenWrites = new Set<string>()

  constructor(hooks: SessionHooks) {
    this.hooks = hooks
  }

  get ready(): boolean {
    return this.phase === 'ready'
  }

  async start(): Promise<boolean> {
    if (this.phase === 'handshaking' || this.phase === 'ready') return this.phase === 'ready'
    this.stopped = false
    this.phase = 'handshaking'
    this.hooks.onUpdate({ phase: 'handshaking', message: '正在建立安克安全会话…', error: null })
    this.hooks.log('info', 'A2687：开始 AES-GCM / ECDH 会话握手')

    try {
      await this.setupInitialKey()
      this.clientKeyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      )
      const rawClient = new Uint8Array(
        await window.crypto.subtle.exportKey('raw', this.clientKeyPair.publicKey),
      )
      if (rawClient.length !== 65 || rawClient[0] !== 0x04) {
        throw new Error('无法生成 P-256 客户端公钥')
      }
      const clientCoordinates = rawClient.slice(1)

      const ts1 = timestampBytes()
      await this.sendCommand(0x01, ANKER_COMMAND.connect, [{ type: 0xa1, value: ts1 }], true, HANDSHAKE_TIMEOUT_MS, true)
      await delay(100)
      await this.sendCommand(
        0x01,
        ANKER_COMMAND.capability,
        [
          { type: 0xa1, value: ts1 },
          { type: 0xa3, value: new Uint8Array([0x20]) },
          { type: 0xa4, value: new Uint8Array([0x00, 0xf0]) },
        ],
        true,
        HANDSHAKE_TIMEOUT_MS,
        true,
      )
      await delay(100)
      const infoResponse = await this.sendCommand(
        0x01,
        ANKER_COMMAND.deviceInfo,
        [{ type: 0xa1, value: ts1 }],
        true,
      )
      if (infoResponse) {
        const identity = extractIdentity(infoResponse)
        this.hooks.onUpdate(identity)
        if (identity.productName) this.hooks.log('info', `A2687：设备型号 ${identity.productName}`)
        if (identity.serial) this.hooks.log('info', `A2687：设备序列号 ${identity.serial}`)
      }
      await delay(100)

      const ts2 = timestampBytes()
      await this.sendCommand(
        0x01,
        ANKER_COMMAND.setCapability,
        [
          { type: 0xa1, value: ts2 },
          { type: 0xa3, value: new Uint8Array([0x20]) },
          { type: 0xa4, value: new Uint8Array([0x29, 0x01]) },
          { type: 0xa5, value: new Uint8Array([0x44]) },
          { type: 0xa6, value: new Uint8Array([0x02]) },
        ],
        true,
        HANDSHAKE_TIMEOUT_MS,
        true,
      )
      await delay(120)

      const publicKeyResponse = await this.sendCommand(
        0x01,
        ANKER_COMMAND.publicKey,
        [{ type: 0xa1, value: clientCoordinates }],
        true,
      )
      if (!publicKeyResponse) throw new Error('设备未返回 P-256 公钥')
      const devicePoint = parseTlv(publicKeyResponse, tlvOffset(publicKeyResponse)).find(
        (tlv) => tlv.type === 0xa1 && tlv.value.length === 64,
      )?.value
      if (!devicePoint) throw new Error('设备公钥格式无效')
      await this.deriveSessionKey(devicePoint)
      await delay(120)

      await this.sendCommand(
        0x01,
        ANKER_COMMAND.aesKey,
        [
          { type: 0xa1, value: timestampBytes() },
          { type: 0xa3, value: hexToBytes('808fffff') },
          { type: 0xa5, value: asciiToBytes('CST-8') },
        ],
        false,
      )
      await delay(120)
      await this.sendCommand(
        0x01,
        ANKER_COMMAND.userAuth,
        [
          { type: 0xa1, value: timestampBytes() },
          { type: 0xa2, value: hexToBytes(ANKER_LOGIN_ID_HEX) },
        ],
        false,
      )
      await delay(150)
      if (this.stopped) return false

      this.phase = 'ready'
      this.hooks.onUpdate({ phase: 'ready', message: '安克会话已建立，正在读取实时数据' })
      this.hooks.log('success', 'A2687：安全会话建立完成，开始接收真实遥测')

      await this.requestStatus().catch((error) => {
        this.hooks.log('warn', `A2687：状态请求失败：${describeError(error)}`)
      })
      await this.requestTelemetry().catch((error) => {
        this.hooks.log('warn', `A2687：首次遥测请求失败：${describeError(error)}`)
      })
      this.startPolling()
      return true
    } catch (error) {
      if (this.stopped) return false
      const message = describeError(error)
      this.phase = 'error'
      this.stopPolling()
      this.hooks.onUpdate({ phase: 'error', message: `安克会话握手失败：${message}`, error: message })
      this.hooks.log('error', `A2687：会话握手失败：${message}`)
      return false
    }
  }

  stop(): void {
    this.stopped = true
    this.phase = 'idle'
    this.stopPolling()
    this.rejectPending(new Error('会话已关闭'))
    this.key = null
    this.nonce = null
    this.clientKeyPair = null
    this.ports = emptyPorts()
    this.totalPower = null
    this.chargingMode = null
  }

  handleNotification(bytes: Uint8Array): void {
    this.processChain = this.processChain
      .then(() => this.processNotification(bytes))
      .catch((error) => {
        this.hooks.log('warn', `A2687：通知解析失败：${describeError(error)}`)
      })
  }

  async requestTelemetry(): Promise<void> {
    if (!this.ready) return
    await this.sendCommand(
      0x0f,
      ANKER_COMMAND.realtime,
      [
        { type: 0xa1, value: new Uint8Array([0x21]) },
        { type: 0xa2, value: hexToBytes('045553') },
        { type: 0xa3, value: typedByteArray(hexToBytes(ANKER_LOGIN_ID_HEX)) },
        { type: 0xa5, value: new Uint8Array([0x01, 0x01]) },
        { type: 0xfe, value: timestampBytes() },
      ],
      false,
    )
  }

  async requestStatus(): Promise<void> {
    if (!this.ready) return
    await this.sendCommand(
      0x0f,
      ANKER_COMMAND.status,
      [
        { type: 0xa1, value: new Uint8Array([0x21]) },
        { type: 0xfe, value: timestampBytes() },
      ],
      false,
    )
  }

  async setPortPower(port: AnkerPortId, on: boolean): Promise<void> {
    await this.ensureReady()
    await this.sendCommand(0x0f, ANKER_COMMAND.portSwitch, portPowerTlv(port, on), false)
    this.hooks.log('success', `A2687：${port} 输出${on ? '开启' : '关闭'}指令已发送`)
    await delay(200)
    await this.requestStatus().catch(() => undefined)
  }

  async setPortTimer(port: AnkerPortId, seconds: number): Promise<void> {
    await this.ensureReady()
    await this.sendCommand(0x0f, ANKER_COMMAND.portTimer, portTimerTlv(port, seconds), false)
    this.hooks.log('success', `A2687：${port} 定时已设为 ${Math.round(seconds / 60)} 分钟`)
  }

  async setChargingMode(mode: 0 | 1 | 4): Promise<void> {
    await this.ensureReady()
    await this.sendCommand(0x0f, ANKER_COMMAND.chargingMode, singleValueTlv(mode), false)
    this.chargingMode = mode
    this.hooks.onUpdate({ chargingMode: mode })
    this.hooks.log('success', `A2687：充电模式已切换为 ${mode}`)
    await delay(200)
    await this.requestStatus().catch(() => undefined)
  }

  async setSetting(kind: AnkerSettingKind, value: number): Promise<void> {
    await this.ensureReady()
    await this.sendCommand(0x0f, SETTING_COMMANDS[kind], singleValueTlv(value), false)
    this.hooks.log('success', `A2687：设置 ${kind} = ${value} 已发送`)
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) throw new Error('安克会话尚未就绪')
  }

  private startPolling(): void {
    this.stopPolling()
    this.heartbeatTick = 0
    this.pollTimers.push(
      window.setInterval(() => {
        if (!this.ready) return
        this.heartbeatTick += 1
        void this.requestTelemetry().catch((error) => {
          this.hooks.log('warn', `A2687：心跳遥测失败：${describeError(error)}`)
        })
        if (this.heartbeatTick % 2 === 0) {
          void this.requestStatus().catch(() => undefined)
        }
      }, HEARTBEAT_MS),
    )
  }

  private stopPolling(): void {
    for (const timer of this.pollTimers) window.clearInterval(timer)
    this.pollTimers = []
  }

  private async setupInitialKey(): Promise<void> {
    await this.importKey(hexToBytes(ANKER_INITIAL_KEY_HEX), hexToBytes(ANKER_INITIAL_NONCE_HEX))
  }

  private async deriveSessionKey(deviceCoordinates: Uint8Array): Promise<void> {
    if (!this.clientKeyPair) throw new Error('客户端密钥尚未生成')
    const rawDevice = new Uint8Array(65)
    rawDevice[0] = 0x04
    rawDevice.set(deviceCoordinates, 1)
    const deviceKey = await window.crypto.subtle.importKey(
      'raw',
      rawDevice,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    )
    const shared = new Uint8Array(
      await window.crypto.subtle.deriveBits(
        { name: 'ECDH', public: deviceKey },
        this.clientKeyPair.privateKey,
        256,
      ),
    )
    if (shared.length !== 32) throw new Error(`ECDH 共享密钥长度异常：${shared.length}`)
    await this.importKey(shared.slice(0, 16), shared.slice(16, 28))
    this.hooks.log('success', 'A2687：已通过 ECDH 派生会话密钥')
  }

  private async importKey(keyBytes: Uint8Array, nonce: Uint8Array): Promise<void> {
    if (keyBytes.length !== 16) throw new Error(`会话密钥必须为 16 字节，实际 ${keyBytes.length}`)
    if (nonce.length !== 12) throw new Error(`GCM nonce 必须为 12 字节，实际 ${nonce.length}`)
    this.key = await window.crypto.subtle.importKey(
      'raw',
      asBuffer(keyBytes),
      { name: 'AES-GCM', length: 128 },
      false,
      ['encrypt', 'decrypt'],
    )
    this.nonce = nonce
  }

  private async encrypt(plain: Uint8Array): Promise<Uint8Array> {
    if (!this.key || !this.nonce) throw new Error('加密上下文未初始化')
    const cipher = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: asBuffer(this.nonce),
        additionalData: asBuffer(this.aad),
        tagLength: 128,
      },
      this.key,
      asBuffer(plain),
    )
    return new Uint8Array(cipher)
  }

  private async decrypt(cipher: Uint8Array): Promise<Uint8Array> {
    if (!this.key || !this.nonce) throw new Error('解密上下文未初始化')
    const plain = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: asBuffer(this.nonce),
        additionalData: asBuffer(this.aad),
        tagLength: 128,
      },
      this.key,
      asBuffer(cipher),
    )
    return new Uint8Array(plain)
  }

  private async sendCommand(
    group: number,
    command: number,
    tlvs: Tlv[],
    expectResponse: boolean,
    timeoutMs = HANDSHAKE_TIMEOUT_MS,
    acceptAnyResponse = false,
  ): Promise<Uint8Array | null> {
    if (this.stopped) throw new Error('会话已关闭')
    const cipher = await this.encrypt(buildTlv(tlvs))
    const payload = new Uint8Array(5 + cipher.length)
    payload.set(
      [0x03, 0x00, group, ((command >> 8) & 0xff) | 0x40, command & 0xff],
      0,
    )
    payload.set(cipher, 5)
    const frame = buildFrame(payload)

    if (!this.seenWrites.has(`${group}:${command}`)) {
      this.seenWrites.add(`${group}:${command}`)
      this.hooks.log(
        'info',
        `A2687：发送 0x${command.toString(16).padStart(4, '0')}（group 0x${group.toString(16).padStart(2, '0')}，${frame.length} 字节）`,
      )
    }

    const response = expectResponse
      ? this.armResponse(command, timeoutMs, acceptAnyResponse)
      : null
    try {
      await this.queueWrite(frame)
    } catch (error) {
      if (response) this.cancelPending()
      throw error
    }
    if (!response) return null
    return await response
  }

  private armResponse(
    command: number,
    timeoutMs: number,
    acceptAny: boolean,
  ): Promise<Uint8Array> {
    this.cancelPending()
    const promise = new Promise<Uint8Array>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pending?.command === command) this.pending = null
        reject(new Error(`等待设备响应 0x${command.toString(16).padStart(4, '0')} 超时`))
      }, timeoutMs)
      this.pending = { command, acceptAny, resolve, reject, timer }
    })
    return promise
  }

  private cancelPending(): void {
    if (!this.pending) return
    window.clearTimeout(this.pending.timer)
    this.pending = null
  }

  private rejectPending(error: Error): void {
    if (!this.pending) return
    window.clearTimeout(this.pending.timer)
    const pending = this.pending
    this.pending = null
    pending.reject(error)
  }

  private queueWrite(frame: Uint8Array): Promise<void> {
    const task = this.writeChain.then(
      () => this.hooks.write(frame),
      () => this.hooks.write(frame),
    )
    this.writeChain = task.catch(() => undefined)
    return task
  }

  private async processNotification(bytes: Uint8Array): Promise<void> {
    if (this.stopped) return
    const parsed = parseFrame(bytes)
    if (!parsed) return

    const commandKey = `${parsed.command.toString(16)}:${parsed.encrypted ? 'enc' : 'plain'}`
    const firstSeen = !this.seenCommands.has(commandKey)
    if (firstSeen) {
      this.seenCommands.add(commandKey)
      this.hooks.log(
        'info',
        `A2687：收到 0x${parsed.command.toString(16).padStart(4, '0')}（${parsed.payload.length} 字节，${parsed.encrypted ? '加密' : '明文'}）`,
      )
    }

    let plain: Uint8Array
    if (parsed.encrypted) {
      if (!this.key) return
      try {
        plain = await this.decrypt(parsed.payload.slice(5))
      } catch {
        if (firstSeen) {
          this.hooks.log(
            'warn',
            `A2687：0x${parsed.command.toString(16).padStart(4, '0')} 解密失败，会话密钥可能已失效`,
          )
        }
        return
      }
    } else {
      plain = parsed.payload.slice(5)
    }

    if (
      this.pending &&
      (this.pending.acceptAny || this.pending.command === parsed.command)
    ) {
      const pending = this.pending
      window.clearTimeout(pending.timer)
      this.pending = null
      pending.resolve(plain)
    }

    if (this.phase !== 'ready') return
    this.applyTelemetry(parsed.command, plain)
  }

  private applyTelemetry(command: number, plain: Uint8Array): void {
    const relevant =
      command === 0x0300 ||
      command === ANKER_COMMAND.realtime ||
      command === ANKER_COMMAND.status ||
      command === ANKER_COMMAND.fixedAllocation ||
      command === ANKER_COMMAND.chargingMode ||
      command === 0x0303 ||
      command === 0x0a00 ||
      command === 0x0040 ||
      command === 0x0405 ||
      command === 0x0410
    if (!relevant) return

    const update = parseRealtime(plain, command)
    const patches = update.ports
    const hasPortPatch = Object.keys(patches).length > 0
    if (!hasPortPatch && update.totalPower === undefined && update.chargingMode === undefined) {
      return
    }

    if (hasPortPatch) {
      this.ports = this.ports.map((port) => {
        const patch: PortPatch | undefined = patches[port.id]
        return patch ? { ...port, ...patch } : port
      })
    }

    if (update.totalPower !== undefined) {
      this.totalPower = update.totalPower
    } else if (hasPortPatch) {
      const measured = this.ports.map((port) => port.power).filter((power): power is number => power !== null)
      this.totalPower = measured.length > 0 ? measured.reduce((sum, power) => sum + power, 0) : null
    }

    if (update.chargingMode !== undefined) this.chargingMode = update.chargingMode

    const patch: Partial<AnkerState> = {
      ports: this.ports,
      totalPower: this.totalPower,
      chargingMode: this.chargingMode,
      lastUpdatedAt: Date.now(),
    }
    if (update.fixedAllocation !== undefined) patch.fixedAllocation = update.fixedAllocation
    this.hooks.onUpdate(patch)
  }
}

export function isAnkerPortId(value: string): value is AnkerPortId {
  return (ANKER_PORTS as readonly string[]).includes(value)
}
