import assert from 'node:assert/strict'
import { launch, openPlayer, checkMainScope } from './arcade-browser.mjs'

const browser = await launch()
try {
  for (let run = 0; run < 20; run++) {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await openPlayer(page)
      assert.equal(
        await page.evaluate(() => navigator.serviceWorker.controller !== null),
        true
      )
      assert.equal(
        await page.evaluate(() =>
          sessionStorage.getItem('pkcamp:arcade:isolation-reload')
        ),
        null
      )
      await page.reload()
      await page.waitForFunction(() => crossOriginIsolated)
      await checkMainScope(page)
    } finally {
      await context.close()
    }
  }
  console.log(
    'PASS: 20 fresh isolated player visits, refreshes, and main-app scope checks.'
  )
} finally {
  await browser.close()
}
