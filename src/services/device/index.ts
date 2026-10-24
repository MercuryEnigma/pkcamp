import { gbLinkTradeDevice } from '../tradeDevice'

/**
 * The page-facing hardware service. Device-specific implementations stay
 * behind this object so screens do not choose a transport themselves.
 */
export const device = {
  get supported() {
    return gbLinkTradeDevice.supported
  },
  get state() {
    return gbLinkTradeDevice.state
  },
  connect(options?: Parameters<typeof gbLinkTradeDevice.connect>[0]) {
    return gbLinkTradeDevice.connect(options)
  },
  disconnect() {
    return gbLinkTradeDevice.disconnect()
  },
  readSave(options: Parameters<typeof gbLinkTradeDevice.readSave>[0]) {
    return gbLinkTradeDevice.readSave(options)
  },
  readRom(options: Parameters<typeof gbLinkTradeDevice.readRom>[0]) {
    return gbLinkTradeDevice.readRom(options)
  },
  readBios(options: Parameters<typeof gbLinkTradeDevice.readBios>[0]) {
    return gbLinkTradeDevice.readBios(options)
  },
  writeSave(options: Parameters<typeof gbLinkTradeDevice.writeSave>[0]) {
    return gbLinkTradeDevice.writeSave(options)
  },
}
