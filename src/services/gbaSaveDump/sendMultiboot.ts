import { GB_LINK_COMMAND, GB_LINK_MODE } from '../tradeDevice/gbLinkProtocol'
import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport'
import { delay, GbLinkWords } from './gbLinkWords'
import { multiboot } from './multiboot'

/** Shared adapter setup for programs that boot into GBA RAM. */
export async function sendMultiboot(
  transport: GbLinkTransport,
  rom: Uint8Array,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void
) {
  const link = new GbLinkWords(transport, signal)
  try {
    signal.throwIfAborted()
    await transport.sendCommand(GB_LINK_COMMAND.cancel)
    await transport.sendCommand(GB_LINK_COMMAND.setVoltage3V3)
    await transport.sendCommand(
      GB_LINK_COMMAND.setMode,
      new Uint8Array([GB_LINK_MODE.gbLink])
    )
    await delay(100, signal)
    await transport.sendCommand(
      GB_LINK_COMMAND.setTimingConfig,
      new Uint8Array([36, 0, 0, 4])
    )
    link.drain()
    await multiboot(link, rom, signal, onProgress)
  } finally {
    link.dispose()
    await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
  }
}

export function decodeBundledRom(dataUrl: string): Uint8Array {
  return Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) =>
    c.charCodeAt(0)
  )
}
