import { describe, expect, it, vi } from 'vitest'
import {
  GbLinkFirmwareUpdater,
  latestGbLinkFirmware,
  prepareFirmware,
  type UpdateDependencies,
} from './gbLinkFirmwareUpdate'

function uf2() {
  const bytes = new Uint8Array(1024)
  for (let i = 0; i < 2; i++) {
    const view = new DataView(bytes.buffer, i * 512, 512)
    view.setUint32(0, 0x0a324655, true)
    view.setUint32(4, 0x9e5d5157, true)
    view.setUint32(8, 0x2000, true)
    view.setUint32(12, 0x10000000 + i * 256, true)
    view.setUint32(16, 256, true)
    view.setUint32(20, i, true)
    view.setUint32(24, 2, true)
    view.setUint32(28, 0xe48bff56, true)
    view.setUint32(508, 0x0ab16f30, true)
    bytes.fill(i + 3, i * 512 + 32, i * 512 + 288)
  }
  return bytes
}
const catalog = {
  gblink: [
    { version: '2.2.3', uf2: 'assets/firmware/gblink.v2.2.3.uf2' },
    {
      version: '2.2.7',
      beta: true,
      uf2: 'assets/firmware/beta.gblink.v2.2.7.uf2',
    },
  ],
}
function fixture(current = '2.2.3', automaticBoot = true) {
  let restarted = false
  let written = false
  const bootDevice = { vendorId: 0x2e8a, productId: 3, serialNumber: 'adapter' }
  const reboot = vi.fn(async () => {})
  const boot = {
    device: { opened: true, close: vi.fn(async () => {}) },
    connect: vi.fn(async () => ({ reboot })),
    disconnect: vi.fn(async () => {}),
    flashEraseAndWrite: vi.fn(async () => {
      written = true
    }),
    flashRead: vi.fn(async () => prepareFirmware(uf2()).data),
  }
  const deps: UpdateDependencies = {
    device: {
      state: 'disconnected',
      connect: vi.fn(async () => {
        deps.device.state = 'connected'
      }),
      disconnect: vi.fn(async () => {
        deps.device.state = 'disconnected'
      }),
      firmwareVersion: vi.fn(async () => (written ? '2.2.7' : current)),
      rebootToBootloader: vi.fn(async () => {
        restarted = true
        deps.device.state = 'disconnected'
      }),
    },
    usb: {
      getDevices: vi.fn(async () =>
        automaticBoot && restarted ? [bootDevice] : []
      ),
      requestDevice: vi.fn(async () => bootDevice),
    },
    fetch: vi.fn(async (input) =>
      String(input).endsWith('.json')
        ? new Response(JSON.stringify(catalog))
        : new Response(uf2().slice().buffer)
    ),
    boot: vi.fn(() => boot),
    wait: async () => {},
  }
  const callbacks = { status: vi.fn(), current: vi.fn(), latest: vi.fn() }
  return {
    deps,
    boot,
    callbacks,
    reboot,
    updater: new GbLinkFirmwareUpdater(deps),
  }
}

describe('GB-Link automatic firmware update', () => {
  it('does not reboot or flash after cancellation during preparation', async () => {
    const { updater, deps, callbacks, boot } = fixture()
    const controller = new AbortController()
    callbacks.latest.mockImplementation(() => controller.abort())
    await expect(
      updater.run(callbacks, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(deps.device.rebootToBootloader).not.toHaveBeenCalled()
    expect(boot.flashEraseAndWrite).not.toHaveBeenCalled()
  })

  it('finishes verification and reboot if cancellation arrives during a flash', async () => {
    const { updater, callbacks, boot, reboot, deps } = fixture()
    const controller = new AbortController()
    boot.flashEraseAndWrite.mockImplementationOnce(async () =>
      controller.abort()
    )
    await expect(
      updater.run(callbacks, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(boot.flashRead).toHaveBeenCalledOnce()
    expect(reboot).toHaveBeenCalledOnce()
    expect(boot.disconnect).toHaveBeenCalledOnce()
    expect(deps.device.connect).toHaveBeenCalledOnce()
  })

  it('shows the most recent compatible build and its beta status', async () => {
    const { deps } = fixture()
    expect(await latestGbLinkFirmware(deps.fetch)).toMatchObject({
      version: '2.2.7',
      beta: true,
    })
  })

  it('does not reboot or flash an adapter already on the latest version', async () => {
    const { updater, deps, callbacks, boot } = fixture('2.2.7')
    expect(await updater.run(callbacks)).toBe('current')
    expect(callbacks.current).toHaveBeenCalledWith('2.2.7')
    expect(deps.device.rebootToBootloader).not.toHaveBeenCalled()
    expect(boot.flashEraseAndWrite).not.toHaveBeenCalled()
  })

  it('downloads before reboot, writes, reads back, and verifies the reconnected version', async () => {
    const { updater, deps, callbacks, boot, reboot } = fixture()
    expect(await updater.run(callbacks)).toBe('updated')
    expect(boot.flashEraseAndWrite).toHaveBeenCalledWith(
      0x10000000,
      prepareFirmware(uf2()).data
    )
    expect(boot.flashRead).toHaveBeenCalledWith(0x10000000, 512)
    expect(reboot).toHaveBeenCalledWith(500)
    expect(deps.device.connect).toHaveBeenLastCalledWith({
      previouslyGrantedOnly: true,
    })
    expect(callbacks.current).toHaveBeenLastCalledWith('2.2.7')
  })

  it('resumes the same image after the bootloader permission prompt', async () => {
    const { updater, deps, callbacks, boot } = fixture('2.2.3', false)
    expect(await updater.run(callbacks)).toBe('select')
    expect(boot.flashEraseAndWrite).not.toHaveBeenCalled()
    expect(updater.nextAction).toBe('select')
    expect(await updater.run(callbacks)).toBe('updated')
    expect(deps.usb.requestDevice).toHaveBeenCalledOnce()
    expect(deps.device.rebootToBootloader).toHaveBeenCalledOnce()
  })

  it('leaves firmware untouched when the release check fails', async () => {
    const { updater, deps, callbacks } = fixture()
    deps.fetch = vi.fn(async () => new Response('', { status: 503 }))
    await expect(updater.run(callbacks)).rejects.toThrow('Could not check')
    expect(deps.device.rebootToBootloader).not.toHaveBeenCalled()
  })

  it('does not reboot after failed read-back verification and allows retry', async () => {
    const { updater, boot, callbacks, reboot } = fixture()
    boot.flashRead.mockResolvedValueOnce(new Uint8Array(512))
    await expect(updater.run(callbacks)).rejects.toThrow('verification failed')
    expect(reboot).not.toHaveBeenCalled()
    expect(updater.nextAction).toBe('select')
    expect(boot.disconnect).toHaveBeenCalled()
  })

  it('does not flash if another bootloader was already attached', async () => {
    const { updater, deps, callbacks, boot } = fixture()
    deps.usb.getDevices = vi.fn(async () => [
      { vendorId: 0x2e8a, productId: 3, serialNumber: 'other' },
    ])
    expect(await updater.run(callbacks)).toBe('select')
    expect(boot.flashEraseAndWrite).not.toHaveBeenCalled()
  })

  it('rejects incomplete, duplicated, and wrong-family firmware blocks', () => {
    expect(() => prepareFirmware(uf2().slice(0, 512))).toThrow()
    const wrongFamily = uf2()
    new DataView(wrongFamily.buffer).setUint32(28, 0, true)
    expect(() => prepareFirmware(wrongFamily)).toThrow()
    const duplicate = uf2()
    new DataView(duplicate.buffer).setUint32(512 + 20, 0, true)
    expect(() => prepareFirmware(duplicate)).toThrow()
  })
})
