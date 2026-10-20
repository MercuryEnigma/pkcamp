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
  await page.locator('.arcade-game-card').first().waitFor()
  assert.equal(await page.locator('.arcade-game-card').count(), 5)
  for (const label of ['Ruby', 'Sapphire', 'Emerald', 'FireRed', 'LeafGreen']) {
    const card = page.getByRole('button', { name: new RegExp(label) })
    assert.equal(await card.locator('.arcade-game-rom').count(), 1)
    assert.equal(await card.locator('.arcade-game-save').count(), 1)
  }
  await page.getByRole('button', { name: /^Ruby/ }).click()
  await page.waitForFunction(() => crossOriginIsolated)
  await page.getByRole('button', { name: /Exit$/ }).click()
  await page.locator('.arcade-game-card').first().waitFor()
  await openPlayer(page)
  await optionalBoot(page)
  // Private files and account credentials never leave this fresh context.
  await context.close()
  const invalid = await browser.newPage()
  await invalid.goto(new URL('arcade/?game=pikachu', base).href)
  await invalid
    .getByText('No game chosen', { exact: true })
    .waitFor({ state: 'attached' })
  await invalid.getByRole('button', { name: 'Choose a game' }).click()
  await invalid.locator('.arcade-game-card').first().waitFor()
  console.log(
    'PASS: five cartridge selectors, direct entry, return navigation, invalid game handling.'
  )
} finally {
  await browser.close()
}
