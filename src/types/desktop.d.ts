export {}

declare global {
  interface Window {
    ankerDesktop?: {
      platform: string
      electronVersion: string
      hidePanel: () => void
      rescanBluetooth?: (deviceId: string, deviceName: string) => Promise<boolean>
    }
    __ankerRescan?: (deviceId: string) => Promise<boolean>
  }
}
