export type PortId = 'C1' | 'C2' | 'C3'

export interface DeviceProfile {
  name: string
  sn: string
  firmware: string
  model: string
}

export const MAX_OUTPUT_WATTS = 160
