import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { catalogTokens } from './config'
import { campsite } from './resources'

const SRC = fileURLToPath(new URL('../../', import.meta.url))

const COLOR_LITERAL = new RegExp(
  [
    String.raw`#[0-9a-fA-F]{3,8}\b`,
    String.raw`(?<![-\w])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`,
    String.raw`(?<![-\w])(?:white|black|red|green|blue|gray|grey|silver|maroon|purple|fuchsia|lime|olive|yellow|navy|teal|aqua|orange|pink|brown|gold|beige|ivory|tan|crimson|coral|salmon|khaki|violet|indigo|cyan|magenta)(?![-\w])`,
  ].join('|'),
  'i'
)

/**
 * Exact exceptions only, each with its reason. Like Pokémon terminology in
 * i18n, these are game data or depictions of real hardware, not interface
 * colors a theme should change.
 */
const EXCEPTIONS: {
  file: string
  selector?: RegExp
  property?: RegExp
  reason: string
}[] = [
  {
    file: 'index.css',
    property: /^--(text|text-h|bg|border)$/,
    reason: 'Root defaults beneath the theme, which overrides each one',
  },
  {
    file: 'pages/hub/gameCartridge.css',
    property: /^--arcade-version$/,
    reason: 'Game version colors',
  },
  {
    file: 'pages/pokestorage/arcade/arcadeZone.css',
    property: /^--arcade-version$/,
    reason: 'Game version colors',
  },
  {
    file: 'pages/pokestorage/camp/campPage.css',
    selector: /^\.storage-grid-source\[data-game='\w+'\]$/,
    reason: 'Game version colors',
  },
  {
    file: 'pages/hub/gameCartridge.css',
    selector: /^\.game-cartridge-(mark|label)$/,
    reason: 'GBA cartridge plastic and label art',
  },
  {
    file: 'pages/pokestorage/arcade/arcadeZone.css',
    selector:
      /^\.arcade-(game-card(::before|::after)?|cartridge-mark|cartridge-label)$/,
    reason: 'GBA cartridge plastic and label art',
  },
  {
    file: 'pages/pokestorage/arcade/arcadeStage.css',
    selector: /^\.arcade-border-screen(:fullscreen)?$/,
    reason: 'Emulator screen surround',
  },
  {
    file: 'pages/pokestorage/arcade/skins/delta/deltaSkin.css',
    selector:
      /^(\.delta-skin-backdrop|.*\.arcade-border-screen:not\(:fullscreen\))$/,
    reason: 'Emulator screen surround',
  },
  {
    file: 'pages/pokestorage/arcade/skins/delta/deltaSkin.css',
    selector: /^\.delta-skin-hit\[data-debug\]$/,
    reason: 'Skin hit-area debug overlay',
  },
]

/** Pre-existing references with no definition; they render as unset. */
const UNDEFINED_REFERENCES = new Map([
  ['--cab-paper', 'The Arcade message banner has never had a fill'],
])

function cssFiles(): { file: string; text: string }[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.css'))
    .sort()
    .map((file) => ({
      file: file.split('\\').join('/'),
      text: readFileSync(join(SRC, file), 'utf8'),
    }))
}

/** Every declaration with its innermost selector, ignoring comments. */
function declarations(text: string) {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: { selector: string; property: string; value: string }[] = []
  const selectors: string[] = []
  let buffer = ''
  const flush = () => {
    const separator = buffer.indexOf(':')
    if (separator > 0 && selectors.length) {
      found.push({
        selector: selectors[selectors.length - 1],
        property: buffer.slice(0, separator).trim(),
        value: buffer.slice(separator + 1).trim(),
      })
    }
    buffer = ''
  }
  for (const char of source) {
    if (char === '{') {
      selectors.push(buffer.split(/\s+/).join(' ').trim())
      buffer = ''
    } else if (char === '}') {
      flush()
      selectors.pop()
    } else if (char === ';') flush()
    else buffer += char
  }
  return found
}

function exceptionFor(file: string, selector: string, property: string) {
  return EXCEPTIONS.find(
    (exception) =>
      exception.file === file &&
      (!exception.selector || exception.selector.test(selector)) &&
      (!exception.property || exception.property.test(property))
  )
}

describe('page CSS colors', () => {
  const files = cssFiles()

  it('come from theme tokens, outside the listed exceptions', () => {
    const literals: string[] = []
    for (const { file, text } of files) {
      for (const { selector, property, value } of declarations(text)) {
        if (!COLOR_LITERAL.test(value)) continue
        if (exceptionFor(file, selector, property)) continue
        literals.push(`${file} ${selector} { ${property}: ${value} }`)
      }
    }
    expect(literals).toEqual([])
  })

  it('has no exception left without a matching color', () => {
    const used = new Set(
      files.flatMap(({ file, text }) =>
        declarations(text)
          .filter(({ value }) => COLOR_LITERAL.test(value))
          .map(({ selector, property }) =>
            exceptionFor(file, selector, property)
          )
      )
    )
    expect(EXCEPTIONS.filter((exception) => !used.has(exception))).toEqual([])
  })

  it('references only theme tokens or properties CSS defines', () => {
    // Components may set other properties inline, e.g. `--type` per chip.
    const themed = /^--(camp|pc|cab)-/
    const tokens = new Set(Object.keys(catalogTokens(campsite)))
    const defined = new Set(
      files.flatMap(({ text }) =>
        declarations(text)
          .map(({ property }) => property)
          .filter((property) => property.startsWith('--'))
      )
    )
    const referenced = new Set(
      files.flatMap(({ text }) =>
        [...text.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1])
      )
    )
    const missing = [...referenced].filter(
      (name) =>
        themed.test(name) &&
        !tokens.has(name) &&
        !defined.has(name) &&
        !UNDEFINED_REFERENCES.has(name)
    )
    expect(missing).toEqual([])
    for (const name of UNDEFINED_REFERENCES.keys()) {
      expect(tokens.has(name) || defined.has(name), name).toBe(false)
    }
  })

  it('uses every theme token', () => {
    const css = files.map(({ text }) => text).join('\n')
    const unused = Object.keys(catalogTokens(campsite)).filter(
      (name) => !css.includes(`var(${name})`) && !css.includes(`var(${name},`)
    )
    expect(unused).toEqual([])
  })
})
