import { afterEach, expect, it, vi } from 'vitest'
import { BrowserGbLinkTransport } from './gbLinkTransport'

afterEach(() => vi.unstubAllGlobals())

it('does not open a serial chooser after the USB chooser is cancelled', async () => {
  const requestPort = vi.fn()
  vi.stubGlobal('navigator', {
    usb: {
      requestDevice: async () => {
        throw new DOMException('No device selected', 'NotFoundError')
      },
    },
    serial: { requestPort },
  })
  await expect(new BrowserGbLinkTransport().open()).rejects.toMatchObject({
    name: 'NotFoundError',
  })
  expect(requestPort).not.toHaveBeenCalled()
})

it('ignores a USB selection that finishes after cancellation', async () => {
  let choose!: (device: unknown) => void
  const selected = new Promise((resolve) => {
    choose = resolve
  })
  const open = vi.fn()
  const requestPort = vi.fn()
  vi.stubGlobal('navigator', {
    usb: { requestDevice: () => selected },
    serial: { requestPort },
  })
  const controller = new AbortController()
  const opening = new BrowserGbLinkTransport().open({
    signal: controller.signal,
  })
  const rejected = expect(opening).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  choose({ open })
  await rejected
  expect(open).not.toHaveBeenCalled()
  expect(requestPort).not.toHaveBeenCalled()
})

/**
 * A GB-Link whose reads, like WebUSB's, stay pending until the device is
 * closed or `unplug()` makes them fail.
 */
function fakeUsbDevice() {
  let unplug!: () => void
  const unplugged = new Promise<never>((_, reject) => {
    unplug = () => reject(new DOMException('Device lost', 'NetworkError'))
  })
  unplugged.catch(() => {})
  return {
    vendorId: 0x2fe3,
    productId: 0x0100,
    configuration: { configurationValue: 1 },
    open: vi.fn(async () => {}),
    selectConfiguration: vi.fn(async () => {}),
    claimInterface: vi.fn(async () => {}),
    transferIn: vi.fn(() => unplugged),
    transferOut: vi.fn(async () => ({ status: 'ok' })),
    close: vi.fn(async () => unplug()),
    unplug,
  }
}

it('reconnects to an already permitted GB-Link without the chooser', async () => {
  const device = fakeUsbDevice()
  const requestDevice = vi.fn()
  vi.stubGlobal('navigator', {
    usb: { getDevices: async () => [device], requestDevice },
  })
  const transport = new BrowserGbLinkTransport()
  await transport.open()
  expect(transport.attached).toBe(true)
  expect(requestDevice).not.toHaveBeenCalled()
  await transport.close()
})

it('falls back to the chooser when no GB-Link is permitted yet', async () => {
  const device = fakeUsbDevice()
  const requestDevice = vi.fn(async () => device)
  vi.stubGlobal('navigator', {
    usb: { getDevices: async () => [], requestDevice },
  })
  const transport = new BrowserGbLinkTransport()
  await transport.open()
  expect(requestDevice).toHaveBeenCalledOnce()
  expect(transport.attached).toBe(true)
  await transport.close()
})

it('reports a link that drops on its own, but not one it closes', async () => {
  const device = fakeUsbDevice()
  vi.stubGlobal('navigator', {
    usb: { getDevices: async () => [device], requestDevice: vi.fn() },
  })
  const transport = new BrowserGbLinkTransport()
  const detached = vi.fn()
  transport.onDetach(detached)
  await transport.open()
  device.unplug()
  await vi.waitFor(() => expect(detached).toHaveBeenCalledOnce())
  expect(transport.attached).toBe(false)

  const again = new BrowserGbLinkTransport()
  const quiet = vi.fn()
  again.onDetach(quiet)
  vi.stubGlobal('navigator', {
    usb: { getDevices: async () => [fakeUsbDevice()], requestDevice: vi.fn() },
  })
  await again.open()
  await again.close()
  expect(quiet).not.toHaveBeenCalled()
})

it('closes while USB reads are still pending', async () => {
  const device = fakeUsbDevice()
  vi.stubGlobal('navigator', {
    usb: { getDevices: async () => [device], requestDevice: vi.fn() },
  })
  const transport = new BrowserGbLinkTransport()
  await transport.open()
  await transport.close()
  expect(device.close).toHaveBeenCalledOnce()
  expect(transport.attached).toBe(false)
})
