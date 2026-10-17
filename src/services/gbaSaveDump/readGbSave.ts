import { GB_LINK_COMMAND, GB_LINK_MODE } from '../tradeDevice/gbLinkProtocol'
import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport'
import { delay, GbLinkWords } from './gbLinkWords'
import { decodeBundledRom, sendMultiboot } from './sendMultiboot'
import type { GbaDumperOptions } from './readGbaSave'
import dumperUrl from './vendor/gb-cart-doctor/gba-switch-to-gbc_mb.gba?url&inline'

// Port of pinned Cart Doctor web/dump_receiver_fast.js (GPL-3.0).
const SECTIONS = [0, 8, 32, 128, 512, 256, 2]

export async function receiveGbSave(
  link: Pick<GbLinkWords, 'exchangeBytes'>,
  options: GbaDumperOptions
): Promise<Uint8Array> {
  const byte = async (value = 0) =>
    (await link.exchangeBytes(new Uint8Array([value])))[0]
  const deadline = Date.now() + 120_000
  let count = 0
  while (!count) {
    options.signal.throwIfAborted()
    if (Date.now() >= deadline)
      throw new Error(
        'No save dump started. Reset the GBA and try again, then press B in the dumper.'
      )
    if ((await byte()) !== 0xf5) continue
    const type = await byte()
    const size = await byte()
    const checksum = await byte()
    if (checksum !== (0xf5 ^ type ^ size) || type !== 2 || !SECTIONS[size]) {
      await byte(0)
      continue
    }
    count = SECTIONS[size]
    await byte(1)
  }
  const result = new Uint8Array(count * 256)
  for (let section = 0; section < count; section++) {
    let accepted = false
    for (let attempt = 0; attempt < 5 && !accepted; attempt++) {
      options.signal.throwIfAborted()
      const data = await link.exchangeBytes(new Uint8Array(256))
      const expected = data.reduce((checksum, value) => checksum ^ value, 0)
      accepted = (await byte()) === expected
      await byte(accepted ? 1 : 0)
      if (accepted) result.set(data, section * 256)
    }
    if (!accepted)
      throw new Error(
        'The GB/GBC save checksum repeatedly failed. No download was created; reset and retry.'
      )
    options.onProgress?.((section + 1) * 256, result.length)
  }
  return result
}

export async function readGbSave(
  transport: GbLinkTransport,
  options: GbaDumperOptions
) {
  options.onStatus?.('Sending the GB/GBC backup tool…')
  await sendMultiboot(transport, decodeBundledRom(dumperUrl), options.signal)
  const link = new GbLinkWords(transport, options.signal)
  try {
    await delay(2000, options.signal)
    await transport.sendCommand(
      GB_LINK_COMMAND.setMode,
      new Uint8Array([GB_LINK_MODE.gbLink])
    )
    await transport.sendCommand(GB_LINK_COMMAND.setVoltage5V)
    await delay(100, options.signal)
    await transport.sendCommand(
      GB_LINK_COMMAND.setTimingConfig,
      new Uint8Array([50, 0, 0, 1])
    )
    await delay(100, options.signal)
    link.drain()
    options.onStatus?.(
      'Wait for the GBC screen. Insert your GB/GBC game, then press B to back up its save.'
    )
    return await receiveGbSave(link, options)
  } finally {
    link.dispose()
    await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
    await transport.sendCommand(GB_LINK_COMMAND.setVoltage3V3).catch(() => {})
  }
}
