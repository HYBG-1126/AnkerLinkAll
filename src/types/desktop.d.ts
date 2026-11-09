export {}

declare global {
  interface Window {
    ankerDesktop?: {
      platform: string
      electronVersion: string
      hidePanel: () => void
    }
  }
}
