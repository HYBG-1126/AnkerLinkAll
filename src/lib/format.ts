export function toHex(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(separator)
}

export function fromHex(input: string): Uint8Array {
  const cleaned = input.replace(/0x/gi, '').replace(/[\s,:;-]/g, '')
  if (cleaned.length === 0) throw new Error('指令不能为空')
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error('包含非法十六进制字符')
  if (cleaned.length % 2 !== 0) throw new Error('十六进制长度必须为偶数')
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/\0+$/, '')
}

export function printableAscii(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.')).join('')
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString('zh-CN', { hour12: false })
  return `${time}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

export function formatByteCount(count: number): string {
  return count === 1 ? '1 字节' : `${count} 字节`
}
