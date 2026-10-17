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
