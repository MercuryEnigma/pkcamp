import {
  MIN_GBA_SWITCH_FIRMWARE,
  compareFirmwareVersions,
} from './gbLinkProtocol.ts'

export interface GbLinkFirmwareRelease {
  version: string
  url: string
}

const LATEST_RELEASE_API =
  'https://api.github.com/repos/GB-Link/GBLink-Firmware/releases/latest'
const FETCH_TIMEOUT_MS = 5000

const FALLBACK: GbLinkFirmwareRelease = {
  version: MIN_GBA_SWITCH_FIRMWARE,
  url: `https://github.com/GB-Link/GBLink-Firmware/releases/tag/v${MIN_GBA_SWITCH_FIRMWARE}`,
}

/**
 * The firmware release to point users at: the latest stable release when it is
 * newer than the minimum for GBA-Switch trading, otherwise the minimum (which
 * is still marked pre-release upstream).
 */
export async function gbLinkFirmwareRelease(
  fetchImpl: typeof fetch = fetch
): Promise<GbLinkFirmwareRelease> {
  try {
    const response = await fetchImpl(LATEST_RELEASE_API, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return { ...FALLBACK }
    const release = (await response.json()) as {
      tag_name?: unknown
      html_url?: unknown
    }
    if (
      typeof release.tag_name !== 'string' ||
      typeof release.html_url !== 'string'
    ) {
      return { ...FALLBACK }
    }
    const version = release.tag_name.replace(/^v/, '')
    if (compareFirmwareVersions(version, MIN_GBA_SWITCH_FIRMWARE) > 0) {
      return { version, url: release.html_url }
    }
  } catch {
    // Offline, rate limited or timed out: use the known-good release.
  }
  return { ...FALLBACK }
}
