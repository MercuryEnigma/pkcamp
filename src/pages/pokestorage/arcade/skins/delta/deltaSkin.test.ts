import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { defaultSkinArchive } from './defaultSkin'
import { loadDeltaSkin, normalizeDeltaSkin } from './normalizeDeltaSkin'
import { DeltaSkinError } from './parseDeltaSkin'
import { inputsAt, fitSkin, toPixels } from './skinGeometry'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

const landscape = {
  assets: { large: 'land.png' },
  mappingSize: { width: 1000, height: 500 },
  extendedEdges: { top: 5, bottom: 5, left: 5, right: 5 },
  screens: [{ outputFrame: { x: 300, y: 50, width: 400, height: 267 } }],
  items: [
    { inputs: ['a'], frame: { x: 800, y: 200, width: 80, height: 80 } },
    {
      inputs: ['b', 'someFutureInput'],
      frame: { x: 700, y: 300, width: 80, height: 80 },
      extendedEdges: { top: 0, bottom: 0, left: 0, right: 0 },
    },
    {
      inputs: { up: 'up', down: 'down', left: 'left', right: 'right' },
      frame: { x: 100, y: 200, width: 150, height: 150 },
    },
    { inputs: ['menu'], frame: { x: 0, y: 0, width: 10, height: 10 } },
  ],
}

function infoOf(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Skin',
    identifier: 'test.gba.skin',
    gameTypeIdentifier: 'com.rileytestut.delta.game.gba',
    representations: { iphone: { edgeToEdge: { landscape } } },
    ...overrides,
  }
}

function archive(info: unknown, extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    'info.json': strToU8(JSON.stringify(info)),
    'land.png': PNG,
    ...extra,
  })
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof DeltaSkinError ? error.code : String(error)
  }
  return null
}

describe('loadDeltaSkin', () => {
  it('normalizes a valid GBA landscape skin', async () => {
    const skin = await loadDeltaSkin(archive(infoOf()))
    expect(skin).toMatchObject({
      name: 'Test Skin',
      system: 'gba',
      orientation: 'landscape',
      nativeWidth: 1000,
      nativeHeight: 500,
    })
    expect(skin.background.type).toBe('image/png')
    expect(skin.buttons).toHaveLength(4)
  })

  it('parses the screen frame', async () => {
    const skin = await loadDeltaSkin(archive(infoOf()))
    expect(skin.screen).toEqual({ x: 300, y: 50, width: 400, height: 267 })
  })

  it('parses buttons, extended edges, and the D-pad', async () => {
    const skin = await loadDeltaSkin(archive(infoOf()))
    const [a, b, dpad] = skin.buttons
    expect(a.inputs).toEqual(['a'])
    expect(a.hitArea).toEqual({ x: 795, y: 195, width: 90, height: 90 })
    // Unsupported inputs are dropped with a warning; the rest still works.
    expect(b.inputs).toEqual(['b'])
    expect(b.hitArea).toEqual(b.frame)
    expect(dpad.kind).toBe('dpad')
    expect(dpad.directions).toEqual({
      up: 'up',
      down: 'down',
      left: 'left',
      right: 'right',
    })
    // Delta's menu input becomes an Arcade action rather than being dropped.
    expect(skin.buttons[3]).toMatchObject({ inputs: [], actions: ['menu'] })
    expect(skin.warnings.length).toBeGreaterThan(0)
  })

  it('accepts a skin zipped inside a folder', async () => {
    const zip = zipSync({
      'My Skin/info.json': strToU8(JSON.stringify(infoOf())),
      'My Skin/land.png': PNG,
      '__MACOSX/My Skin/._info.json': PNG,
    })
    expect((await loadDeltaSkin(zip)).name).toBe('Test Skin')
  })

  it('rejects an archive that is not a zip', async () => {
    expect(await codeOf(loadDeltaSkin(new Uint8Array([1, 2, 3])))).toBe(
      'not-an-archive'
    )
  })

  it('rejects an archive without info.json', async () => {
    expect(await codeOf(loadDeltaSkin(zipSync({ 'land.png': PNG })))).toBe(
      'missing-info'
    )
  })

  it('rejects an info.json that is not JSON', async () => {
    const zip = zipSync({ 'info.json': strToU8('{nope') })
    expect(await codeOf(loadDeltaSkin(zip))).toBe('invalid-info')
  })

  it('rejects other systems', async () => {
    const info = infoOf({
      gameTypeIdentifier: 'com.rileytestut.delta.game.nes',
    })
    expect(await codeOf(loadDeltaSkin(archive(info)))).toBe(
      'unsupported-system'
    )
  })

  it('falls back to the other orientation when one is missing', async () => {
    const info = infoOf({
      representations: { iphone: { edgeToEdge: { portrait: landscape } } },
    })
    const skin = await loadDeltaSkin(archive(info))
    expect(skin.orientation).toBe('portrait')
    const portrait = await loadDeltaSkin(archive(info), {
      orientation: 'portrait',
    })
    expect(portrait.orientation).toBe('portrait')
  })

  it('prefers iPhone layouts on phones and iPad layouts elsewhere', async () => {
    const info = infoOf({
      representations: {
        ipad: {
          standard: {
            landscape: {
              ...landscape,
              mappingSize: { width: 800, height: 600 },
            },
          },
        },
        iphone: { edgeToEdge: { landscape } },
      },
    })
    expect((await loadDeltaSkin(archive(info))).nativeWidth).toBe(800)
    expect(
      (await loadDeltaSkin(archive(info), { device: 'phone' })).nativeWidth
    ).toBe(1000)
  })

  it('never uses split-view layouts', async () => {
    const info = infoOf({
      representations: { ipad: { splitView: { landscape } } },
    })
    expect(await codeOf(loadDeltaSkin(archive(info)))).toBe(
      'missing-orientation'
    )
  })

  it('requires a screen frame', async () => {
    const info = infoOf({
      representations: {
        iphone: {
          edgeToEdge: {
            landscape: {
              ...landscape,
              screens: [{ outputFrame: { x: 0, y: 0, width: 0, height: 0 } }],
            },
          },
        },
      },
    })
    expect(await codeOf(loadDeltaSkin(archive(info)))).toBe('missing-screen')
  })

  it('explains PDF-only artwork and missing artwork files', async () => {
    const pdf = infoOf({
      representations: {
        iphone: {
          edgeToEdge: {
            landscape: { ...landscape, assets: { resizable: 'land.pdf' } },
          },
        },
      },
    })
    expect(await codeOf(loadDeltaSkin(archive(pdf)))).toBe('unsupported-asset')
    const missing = infoOf({
      representations: {
        iphone: {
          edgeToEdge: {
            landscape: { ...landscape, assets: { large: 'gone.png' } },
          },
        },
      },
    })
    expect(await codeOf(loadDeltaSkin(archive(missing)))).toBe('missing-asset')
  })
})

describe('screens a skin leaves to the player', () => {
  const overlay = (orientation: 'landscape' | 'portrait') =>
    infoOf({
      representations: {
        iphone: {
          standard: {
            [orientation]: {
              assets: { resizable: 'art.pdf' },
              mappingSize: { width: 300, height: 200 },
              items: [
                {
                  inputs: ['a'],
                  frame: { x: 10, y: 20, width: 30, height: 30 },
                },
              ],
            },
          },
        },
      },
    })
  const withRaster = (info: unknown) =>
    archive(info, { 'art.pdf': PNG, 'art.pdf.raster.png': PNG })

  it('stacks the screen above portrait artwork', async () => {
    const skin = await loadDeltaSkin(withRaster(overlay('portrait')), {
      orientation: 'portrait',
    })
    expect(skin.screen).toEqual({ x: 0, y: 0, width: 300, height: 200 })
    expect(skin.artFrame).toEqual({ x: 0, y: 200, width: 300, height: 200 })
    expect(skin.nativeHeight).toBe(400)
    expect(skin.overlay).toBe(false)
    // Buttons move down with the artwork they belong to.
    expect(skin.buttons[0].frame.y).toBe(220)
  })

  it('lays landscape artwork over a game that fills the window', async () => {
    const skin = await loadDeltaSkin(withRaster(overlay('landscape')))
    expect(skin.overlay).toBe(true)
    expect(skin.nativeHeight).toBe(200)
    expect(skin.screen.width / skin.screen.height).toBeCloseTo(1.5)
    expect(skin.screen.x + skin.screen.width / 2).toBeCloseTo(150)
    expect(skin.screen.y + skin.screen.height / 2).toBeCloseTo(100)
    expect(skin.buttons[0].frame.y).toBe(20)
  })

  it('needs PDF artwork rasterized first', async () => {
    expect(
      await codeOf(
        loadDeltaSkin(archive(overlay('landscape'), { 'art.pdf': PNG }))
      )
    ).toBe('unsupported-asset')
  })
})

describe('default skin', () => {
  it.each(['portrait', 'landscape'] as const)(
    'has every control in %s, with Restart and Speed beside Menu',
    (orientation) => {
      const skin = normalizeDeltaSkin(defaultSkinArchive(), { orientation })
      expect(skin.orientation).toBe(orientation)
      expect(skin.warnings).toEqual([])
      expect(skin.background.type).toBe('image/svg+xml')
      const held = new Set(skin.buttons.flatMap((button) => button.inputs))
      expect([...held].sort()).toEqual(
        ['a', 'b', 'l', 'r', 'select', 'start'].sort()
      )
      expect(skin.buttons.some((button) => button.kind === 'dpad')).toBe(true)
      const byAction = (action: string) =>
        skin.buttons.find((button) => button.actions.includes(action as never))
      const [restart, menu, speed] = ['restart', 'menu', 'speed'].map(byAction)
      expect(restart && menu && speed).toBeTruthy()
      // Same row, Menu in the middle.
      expect(restart!.frame.x + restart!.frame.width).toBeLessThanOrEqual(
        menu!.frame.x
      )
      expect(menu!.frame.x + menu!.frame.width).toBeLessThanOrEqual(
        speed!.frame.x
      )
      expect(restart!.frame.y).toBe(menu!.frame.y)
      expect(speed!.frame.y).toBe(menu!.frame.y)
    }
  )
})

describe('Arcade actions', () => {
  it('maps the special inputs onto Arcade actions', async () => {
    const frame = landscape.items[0].frame
    const info = infoOf({
      representations: {
        iphone: {
          edgeToEdge: {
            landscape: {
              ...landscape,
              items: ['quickLoad', 'quickSave', 'toggleFastForward'].map(
                (input) => ({ inputs: [input], frame })
              ),
            },
          },
        },
      },
    })
    const skin = await loadDeltaSkin(archive(info))
    expect(skin.buttons.map((button) => button.actions[0])).toEqual([
      'restart',
      'guide',
      'speed',
    ])
    expect(skin.warnings).toEqual([])
  })
})

describe('skin geometry', () => {
  const skin = { nativeWidth: 1000, nativeHeight: 500 }

  it('fits and centers while keeping the aspect ratio', () => {
    expect(fitSkin(skin, 500, 500)).toEqual({
      scale: 0.5,
      offsetX: 0,
      offsetY: 125,
      width: 500,
      height: 250,
    })
    expect(fitSkin(skin, 2000, 500).offsetX).toBe(500)
  })

  it('maps skin rects to pixels', () => {
    const transform = fitSkin(skin, 500, 500)
    expect(
      toPixels(transform, { x: 100, y: 100, width: 200, height: 50 })
    ).toEqual({ x: 50, y: 175, width: 100, height: 25 })
  })

  it('hit-tests buttons, extended edges, and the D-pad grid', async () => {
    const loaded = await loadDeltaSkin(archive(infoOf()))
    expect(inputsAt(loaded, 840, 240).buttons).toEqual(['a'])
    expect(inputsAt(loaded, 797, 240).buttons).toEqual(['a']) // extended edge
    expect(inputsAt(loaded, 790, 240).buttons).toEqual([])
    expect(inputsAt(loaded, 175, 275).buttons).toEqual([]) // pad center
    expect(inputsAt(loaded, 175, 205).buttons).toEqual(['up'])
    expect(inputsAt(loaded, 105, 345).buttons.sort()).toEqual(['down', 'left'])
  })
})
