import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  controller: new AbortController(),
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  release: vi.fn(),
  setEvent: vi.fn(),
  decide: vi.fn(),
}))
vi.mock('../tradeDevice', () => ({
  esp32TradeDevice: {
    connect: async () => {},
    claimForGift: async () => ({
      transport: {},
      signal: mock.controller.signal,
      release: mock.release,
    }),
  },
}))
vi.mock(
  '../tradeDevice/vendor/gb-link-switch-ldn/gift/distribution.js',
  () => ({
    GiftDistribution: class extends EventTarget {
      start = mock.start
      stop = mock.stop
      setEvent = mock.setEvent
      decide = mock.decide
    },
  })
)
vi.mock('../tradeDevice/vendor/gb-link-switch-ldn/gift/events.js', () => ({
  findEvent: () => ({ id: 'test' }),
}))
import { openSwitchGift } from './switchGift'

const handlers = {
  onStatus: vi.fn(),
  onDecision: vi.fn(),
  onResult: vi.fn(),
  onFailed: vi.fn(),
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.controller = new AbortController()
})

it('waits for pending startup before stopping and releasing the ESP32', async () => {
  let finish!: () => void
  mock.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  const controller = new AbortController()
  const opening = openSwitchGift('test', handlers, {
    signal: controller.signal,
  })
  const rejected = expect(opening).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(mock.start).toHaveBeenCalledOnce())
  // The device reservation links this signal to the caller in production.
  controller.abort()
  mock.controller.abort()
  expect(mock.stop).not.toHaveBeenCalled()
  expect(mock.release).not.toHaveBeenCalled()
  finish()
  await rejected
  expect(mock.stop).toHaveBeenCalledOnce()
  expect(mock.release).toHaveBeenCalledOnce()
  expect(handlers.onFailed).not.toHaveBeenCalled()
})

it('shares shutdown and ignores subsequent gift changes', async () => {
  const link = await openSwitchGift('test', handlers)
  const stopping = link.stop()
  expect(link.stop()).toBe(stopping)
  link.setGift('test')
  link.decide(true)
  await stopping
  expect(mock.release).toHaveBeenCalledOnce()
  expect(mock.setEvent).not.toHaveBeenCalled()
  expect(mock.decide).not.toHaveBeenCalled()
})

it('reports a disconnected board after releasing its reservation', async () => {
  await openSwitchGift('test', handlers)
  mock.controller.abort()
  await vi.waitFor(() => expect(handlers.onFailed).toHaveBeenCalledOnce())
  expect(mock.release).toHaveBeenCalledOnce()
})
