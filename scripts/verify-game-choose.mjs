import assert from 'node:assert/strict'
import {
  base,
  launch,
  openPlayer,
  checkMainScope,
  optionalBoot,
} from './arcade-browser.mjs'

const browser = await launch()
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await checkMainScope(page)
  await page.locator('.game-cartridge').first().waitFor()
  assert.equal(await page.locator('.game-cartridge').count(), 5)
  for (const game of ['ruby', 'sapphire', 'emerald', 'firered', 'leafgreen']) {
    const card = page.locator(`.game-cartridge[data-version="${game}"]`)
    assert.equal(await card.locator('.game-cartridge-save').count(), 1)
    assert.equal(await card.locator('.game-cartridge-rom').count(), 1)
  }
  await page.getByRole('button', { name: /^Ruby: .*Manage ROM\./ }).click()
  await page.getByRole('heading', { name: 'Ruby ROM', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page
    .getByRole('button', { name: 'Continue to the campsite', exact: true })
    .click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: /^Camp / }).waitFor()
  await openPlayer(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /^Camp / }).waitFor()
  await openPlayer(page)
  await optionalBoot(page)
  await page.getByRole('button', { name: 'Language', exact: true }).click()
  const spanishOption = page.getByRole('menuitemradio', {
    name: 'Español',
    exact: true,
  })
  if (await spanishOption.count()) {
    await page
      .getByRole('menuitemradio', { name: 'Español', exact: true })
      .click()
    await page.waitForFunction(
      () => document.querySelector('.site-page-game')?.textContent === 'Rubí'
    )
    await page.goto(base.href)
    for (const [id, name] of [
      ['ruby', 'Rubí'],
      ['sapphire', 'Zafiro'],
      ['emerald', 'Esmeralda'],
      ['firered', 'Rojo Fuego'],
      ['leafgreen', 'Verde Hoja'],
    ]) {
      const card = page.locator(`.game-cartridge[data-version="${id}"]`)
      await card
        .locator('.game-cartridge-name')
        .getByText(name, { exact: true })
        .waitFor()
      assert.equal(
        await card.locator('.game-cartridge-name').textContent(),
        name
      )
    }
    await page
      .locator('.game-cartridge[data-version="firered"] .game-cartridge-rom')
      .click()
    await page
      .getByRole('heading', { name: 'ROM de Rojo Fuego', exact: true })
      .waitFor()
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await page
      .locator('.game-cartridge[data-version="firered"] .game-cartridge-main')
      .click()
    await page
      .getByRole('heading', {
        name: 'Añadir una partida de Rojo Fuego',
        exact: true,
      })
      .waitFor()
    for (const route of ['hub', 'lab']) {
      await page.goto(new URL(`${route}/?game=firered`, base).href)
      await page.waitForFunction(
        () =>
          document.querySelector('.site-page-game')?.textContent ===
          'Rojo Fuego'
      )
    }
    await page.getByRole('button', { name: 'Idioma', exact: true }).click()
    await page
      .getByRole('menuitemradio', { name: 'English', exact: true })
      .click()
    await page.waitForFunction(
      () => document.querySelector('.site-page-game')?.textContent === 'FireRed'
    )
  } else {
    assert.deepEqual(await page.getByRole('menuitemradio').allTextContents(), [
      'English',
    ])
    await page.keyboard.press('Escape')
  }
  await context.close()

  const invalid = await browser.newPage()
  await invalid.goto(new URL('arcade/?game=pikachu', base).href)
  await invalid.locator('.game-cartridge').first().waitFor()
  console.log(
    'PASS: five cartridge selectors, translated ROM dialog, direct Arcade entry, return navigation, enabled language options, invalid game handling.'
  )
} finally {
  await browser.close()
}
