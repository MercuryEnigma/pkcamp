import cabinet from './cabinet/campsite.json'
import camp from './camp/campsite.json'
import common from './common/campsite.json'
import pc from './pc/campsite.json'
import cabinetNight from './cabinet/night.json'
import campNight from './camp/night.json'
import commonNight from './common/night.json'
import pcNight from './pc/night.json'

/** Campsite is the source of truth for namespace and token types. */
export const campsite = {
  cabinet: cabinet,
  camp: camp,
  common: common,
  pc: pc,
}

/** Every theme defines every Campsite token; there is no per-token fallback. */
export type ThemeCatalog = {
  [Namespace in keyof typeof campsite]: Record<
    keyof (typeof campsite)[Namespace],
    string
  >
}

export const resources = {
  campsite: campsite,
  night: {
    cabinet: cabinetNight,
    camp: campNight,
    common: commonNight,
    pc: pcNight,
  },
} satisfies Record<string, ThemeCatalog>

export type ThemeId = keyof typeof resources

/** CSS custom property prefixes; `common` tokens keep their existing names. */
export const prefixes: Record<keyof ThemeCatalog, string> = {
  cabinet: '--cab-',
  camp: '--camp-',
  common: '--',
  pc: '--pc-',
}
