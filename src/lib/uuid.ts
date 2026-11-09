const SIG_SUFFIX = '-0000-1000-8000-00805f9b34fb'

export function sigUuid(short: string): string {
  const hex = short.toLowerCase().replace(/^0x/, '').padStart(4, '0')
  return `0000${hex}${SIG_SUFFIX}`
}

export function normalizeUuid(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (/^[0-9a-f]{4}$/.test(trimmed)) return sigUuid(trimmed)
  if (/^0x[0-9a-f]{4}$/.test(trimmed)) return sigUuid(trimmed.slice(2))
  return trimmed
}

export function shortUuid(value: string): string {
  const normalized = normalizeUuid(value)
  if (normalized.startsWith('0000') && normalized.endsWith(SIG_SUFFIX)) {
    return `0x${normalized.slice(4, 8)}`
  }
  return normalized
}

export function isValidUuid(value: string): boolean {
  const normalized = normalizeUuid(value)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
}
