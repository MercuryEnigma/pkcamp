import type { DeltaInfo } from './deltaTypes'
import type { DeltaSkinArchive } from './parseDeltaSkin'
import infoSource from './default/info.json?raw'
import landscapeArt from './default/landscape.svg?raw'
import portraitArt from './default/portrait.svg?raw'

/**
 * The skin pkCamp ships, as plain Delta skin data with original artwork and
 * Restart and Speed beside Menu. It goes through the same normalizer as an
 * imported skin.
 */
export function defaultSkinArchive(): DeltaSkinArchive {
  const encode = (text: string) => new TextEncoder().encode(text)
  return {
    info: JSON.parse(infoSource) as DeltaInfo,
    files: new Map([
      ['landscape.svg', encode(landscapeArt)],
      ['portrait.svg', encode(portraitArt)],
    ]),
  }
}
