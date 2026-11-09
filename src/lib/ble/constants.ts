import { sigUuid } from '../uuid'

export const ANKER_NAME_PREFIXES = [
  'Anker',
  'anker',
  'Anker_',
  'Soundcore',
  'soundcore',
  'Eufy',
  'eufy',
  'Nebula',
  'AnkerMake',
]

export const UUIDS = {
  genericAccess: sigUuid('1800'),
  genericAttribute: sigUuid('1801'),
  deviceInformation: sigUuid('180a'),
  batteryService: sigUuid('180f'),
  deviceName: sigUuid('2a00'),
  batteryLevel: sigUuid('2a19'),
  manufacturerName: sigUuid('2a29'),
  modelNumber: sigUuid('2a24'),
  serialNumber: sigUuid('2a25'),
  firmwareRevision: sigUuid('2a26'),
  hardwareRevision: sigUuid('2a27'),
  softwareRevision: sigUuid('2a28'),
}

export const STANDARD_SERVICE_UUIDS = [
  UUIDS.genericAccess,
  UUIDS.genericAttribute,
  UUIDS.deviceInformation,
  UUIDS.batteryService,
]

export const SERVICE_NAMES: Record<string, string> = {
  [UUIDS.genericAccess]: '通用访问服务',
  [UUIDS.genericAttribute]: '通用属性服务',
  [UUIDS.deviceInformation]: '设备信息服务',
  [UUIDS.batteryService]: '电池服务',
}

export const CHARACTERISTIC_NAMES: Record<string, string> = {
  [UUIDS.deviceName]: '设备名称',
  [UUIDS.batteryLevel]: '电量',
  [UUIDS.manufacturerName]: '厂商名称',
  [UUIDS.modelNumber]: '型号',
  [UUIDS.serialNumber]: '序列号',
  [UUIDS.firmwareRevision]: '固件版本',
  [UUIDS.hardwareRevision]: '硬件版本',
  [UUIDS.softwareRevision]: '软件版本',
}

// 安克私有 GATT 服务 UUID 请按具体产品协议补充，例如：
// export const VENDOR_SERVICE_UUIDS = ['0000ffe0-0000-1000-8000-00805f9b34fb']
export const VENDOR_SERVICE_UUIDS: string[] = []
