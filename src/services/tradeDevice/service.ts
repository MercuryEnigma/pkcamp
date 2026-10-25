import { i18n } from '../i18n'
import {
  Esp32TradeDevice,
  type Esp32TradeDeviceDependencies,
} from './esp32TradeDevice.ts'
import { GbLinkTradeDevice } from './gbLinkTradeDevice.ts'
import {
  CampSiteTradeDevice,
  SaveBackupTradeDevice,
} from './localTradeDevice.ts'
import {
  TRADE_DEVICE_IDS,
  type TradeDevice,
  type TradeDeviceId,
} from './types.ts'

export class TradeDeviceService {
  private readonly devices: Map<TradeDeviceId, TradeDevice>

  constructor(devices: readonly TradeDevice[]) {
    this.devices = new Map(devices.map((device) => [device.id, device]))
    for (const id of TRADE_DEVICE_IDS) {
      if (!this.devices.has(id))
        throw new Error(
          i18n.t('services:service.missingTradeDevice', { id: id })
        )
    }
  }

  list(): TradeDevice[] {
    return TRADE_DEVICE_IDS.map((id) => this.get(id))
  }

  get(id: TradeDeviceId): TradeDevice {
    const device = this.devices.get(id)
    if (!device)
      throw new Error(i18n.t('services:service.unknownTradeDevice', { id: id }))
    return device
  }
}

export function createTradeDeviceService(options?: {
  esp32?: Esp32TradeDeviceDependencies
}): TradeDeviceService {
  return new TradeDeviceService([
    new Esp32TradeDevice(options?.esp32),
    new GbLinkTradeDevice(),
    new SaveBackupTradeDevice(),
    new CampSiteTradeDevice(),
  ])
}

export const esp32TradeDevice = new Esp32TradeDevice()
export const gbLinkTradeDevice = new GbLinkTradeDevice()
export const saveBackupTradeDevice = new SaveBackupTradeDevice()
export const campSiteTradeDevice = new CampSiteTradeDevice()
export const tradeDeviceService = new TradeDeviceService([
  esp32TradeDevice,
  gbLinkTradeDevice,
  saveBackupTradeDevice,
  campSiteTradeDevice,
])
