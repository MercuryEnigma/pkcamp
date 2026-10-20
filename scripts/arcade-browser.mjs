import assert from 'node:assert/strict'
import { chromium } from 'playwright'

export const base = new URL(
  process.env.ARCADE_BASE_URL ?? 'http://127.0.0.1:4173/pkcamp/'
)
export const game = process.env.ARCADE_GAME ?? 'ruby'
export const playerUrl = new URL(`arcade/?game=${game}`, base).href

export function launch() {
  return chromium.launch({
    channel: process.env.ARCADE_BROWSER_CHANNEL ?? 'chrome',
    headless: true,
  })
}

export async function openPlayer(page) {
  await page.goto(playerUrl)
  // Wait for the page's own reload, never mask first-visit bugs with reload().
  await page.waitForFunction(() => crossOriginIsolated, undefined, {
    timeout: 15_000,
  })
  await page.locator('.arcade-stage').waitFor()
  await page.getByText('Loading…', { exact: true }).waitFor({ state: 'hidden' })
}

export async function checkMainScope(page) {
  await page.goto(new URL('?zone=arcade', base).href)
  assert.deepEqual(
    await page.evaluate(() => ({
      isolated: crossOriginIsolated,
      controlled: Boolean(navigator.serviceWorker.controller),
    })),
    { isolated: false, controlled: false }
  )
}

export async function optionalBoot(page) {
  if (!process.env.ARCADE_ROM) {
    console.log(
      'SKIP real-core boot: set ARCADE_ROM (and optional ARCADE_SAVE).'
    )
    return
  }
  await page
    .locator('input[type=file][accept=".gba"]')
    .setInputFiles(process.env.ARCADE_ROM)
  await page
    .getByRole('button', { name: 'Insert ROM', exact: true })
    .waitFor({ state: 'hidden' })
  if (process.env.ARCADE_SAVE) {
    const imported = page.waitForEvent('console', {
      predicate: (message) =>
        /\[arcade\] (SAV selected|Blank SAV)/.test(message.text()),
    })
    await page
      .locator('input[type=file][accept=".sav"]')
      .setInputFiles(process.env.ARCADE_SAVE)
    await imported
  }
  const started = page.waitForEvent('console', {
    predicate: (message) => message.text().includes('[arcade] mGBA started'),
    timeout: 30_000,
  })
  await page.locator('.arcade-power').click()
  await started
  await page.getByRole('button', { name: 'Menu', exact: true }).first().click()
  await page.getByRole('button', { name: /Keep playing/ }).click()
  console.log(
    'Real mGBA boot and pause/resume passed in isolated temporary browser storage.'
  )
}
