import assert from 'node:assert/strict'
import { launch, openPlayer } from './arcade-browser.mjs'

const browser = await launch()
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [1920, 1080],
    [667, 375],
    [850, 600],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 900,
    })
    try {
      const page = await context.newPage()
      await openPlayer(page)
      const metrics = await page.evaluate(() => {
        const box = (selector) =>
          document.querySelector(selector).getBoundingClientRect()
        const screen = box('.arcade-screen')
        const a = box('.arcade-controller-round--a')
        const l = box('.arcade-controller-shoulder--l')
        const r = box('.arcade-controller-shoulder--r')
        const select = box('.arcade-controller-system button')
        const guide = box('.arcade-guide-button')
        const controls = [
          ...document.querySelectorAll(
            '.arcade-controller-button, .arcade-controller-dpad-arm'
          ),
        ].map((button) => {
          const rect = button.getBoundingClientRect()
          return {
            label: button.getAttribute('aria-label'),
            width: rect.width,
            height: rect.height,
          }
        })
        return {
          pageWidth: document.documentElement.scrollWidth,
          ratio: screen.width / screen.height,
          controls,
          alignment: {
            rRight: r.right - a.right,
            rTop: r.top - screen.top,
            lTop: l.top - screen.top,
            shoulderWidth: l.width - r.width,
            selectBottom: select.bottom - screen.bottom,
            guideBottom: guide.bottom - screen.bottom,
          },
        }
      })
      assert.ok(
        metrics.pageWidth <= width + 1,
        `${width}×${height}: page overflow`
      )
      assert.ok(Math.abs(metrics.ratio - 1.5) < 0.01, 'Display must be 3:2')
      if (width < 900) {
        for (const button of metrics.controls) {
          assert.ok(
            button.width >= 43.9 && button.height >= 43.9,
            `Small touch target: ${JSON.stringify(button)}`
          )
        }
      }
      if (width >= 896 && height > 512) {
        for (const [edge, delta] of Object.entries(metrics.alignment)) {
          assert.ok(
            Math.abs(delta) <= 1,
            `Desktop ${edge} misaligned by ${delta}px`
          )
        }
      }
      await page
        .getByRole('button', { name: 'Menu', exact: true })
        .first()
        .click()
      for (const view of [null, 'Controls', 'Advanced options']) {
        if (view)
          await page.getByRole('button', { name: view, exact: true }).click()
        const size = await page.locator('dialog[open]').evaluate((dialog) => ({
          width: dialog.clientWidth,
          content: dialog.scrollWidth,
          height: dialog.getBoundingClientRect().height,
        }))
        assert.ok(
          size.content <= size.width + 1 && size.height <= height,
          `Menu overflow at ${width}×${height}`
        )
        if (view === 'Advanced options') {
          const opacity = await page
            .getByRole('button', { name: 'Download ROM', exact: true })
            .evaluate((button) => getComputedStyle(button).opacity)
          assert.equal(
            opacity,
            '0.4',
            'Menu disabled styling must stay independent of player styles'
          )
        }
        if (view)
          await page
            .getByRole('button', { name: '‹ Menu', exact: true })
            .click()
      }
      console.log(
        `PASS: ${width}×${height}, 3:2 display, controller targets, three menu views.`
      )
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
