import { describe, expect, it } from 'vitest'
import { gbLinkFirmwareRelease } from './gbLinkFirmwareRelease.ts'

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch
}

const fallback = {
  version: '2.2.7',
  url: 'https://github.com/GB-Link/GBLink-Firmware/releases/tag/v2.2.7',
}

describe('gbLinkFirmwareRelease', () => {
  it('uses the latest release when it is newer than the minimum', async () => {
    const release = await gbLinkFirmwareRelease(
      fakeFetch({ tag_name: 'v2.3.0', html_url: 'https://example.test/v2.3.0' })
    )
    expect(release).toEqual({
      version: '2.3.0',
      url: 'https://example.test/v2.3.0',
    })
  })

  it('falls back to 2.2.7 when the latest is older or equal', async () => {
    expect(
      await gbLinkFirmwareRelease(
        fakeFetch({
          tag_name: 'v2.2.3',
          html_url: 'https://example.test/v2.2.3',
        })
      )
    ).toEqual(fallback)
    expect(
      await gbLinkFirmwareRelease(
        fakeFetch({
          tag_name: 'v2.2.7',
          html_url: 'https://example.test/v2.2.7',
        })
      )
    ).toEqual(fallback)
  })

  it('falls back on HTTP and network errors', async () => {
    expect(await gbLinkFirmwareRelease(fakeFetch({}, false))).toEqual(fallback)
    const failing = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await gbLinkFirmwareRelease(failing)).toEqual(fallback)
  })
})
