import { i18n } from '../i18n'
import { gbLinkTradeDevice } from '../tradeDevice'
import { decodeBundledRom, sendMultiboot } from '../gbaSaveDump/sendMultiboot'
import type { GbaDumperOptions } from '../gbaSaveDump/readGbaSave'
import romUrl from './vendor/Poke_Transporter_GB_v1.2.1.gba?url&inline'

export const TRANSPORTER_SHA256 =
  '1875fe0a1e747eabd0943dd32f1eec6611e5a1d3e947acacda4bb7621721cbde'

export async function verifyTransporter(rom: Uint8Array) {
  if (rom.length !== 124024)
    throw new Error(
      i18n.t('services:launch.pokeTransporterRomHasAnUnexpectedSize')
    )
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', rom.slice().buffer)
  )
  if (
    Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('') !==
    TRANSPORTER_SHA256
  ) {
    throw new Error(
      i18n.t(
        'services:launch.pokeTransporterRomVerificationFailedReloadPkcampBeforeRetrying'
      )
    )
  }
}

export async function launchTransporter(options: GbaDumperOptions) {
  const rom = decodeBundledRom(romUrl)
  options.onStatus?.(i18n.t('services:launch.verifyingPokeTransporterGbV121'))
  await verifyTransporter(rom)
  options.signal.throwIfAborted()
  const lease = gbLinkTradeDevice.claim(options.signal)
  try {
    options.onStatus?.(
      i18n.t('services:launch.waitingForTheGbaInMultibootMode')
    )
    await sendMultiboot(lease.transport, rom, lease.signal, options.onProgress)
  } finally {
    lease.free()
  }
}
