import { useSyncExternalStore } from 'react'
import { bleManager } from '../lib/ble/manager'

export function useBle() {
  const state = useSyncExternalStore(bleManager.subscribe, bleManager.getSnapshot, bleManager.getSnapshot)
  return { state, manager: bleManager }
}
